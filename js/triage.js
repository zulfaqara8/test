// Prototype triage engine (rule-based). It scores severity from the words a person types or speaks plus the
// reason they pick in the SOS box, then picks an ICU-aware hospital and an ambulance type.
// It only assists: a doctor confirms every critical decision.

const RULES = [
  { level: 1, cat: 'cardiac', label: 'Suspected heart attack', re: /chest (pain|tight|pressure)|heart attack|cardiac|pain (in|down) (the )?(left )?arm|crushing/i },
  { level: 1, cat: 'respiratory', label: 'Severe breathing difficulty', re: /not breathing|stopped breathing|can'?t breathe|cannot breathe|struggling to breathe|gasping|blue lips|choking|choked/i },
  { level: 1, cat: 'neuro', label: 'Unresponsive or neurological emergency', re: /unconscious|unresponsive|not waking|won'?t wake|collapsed|seizure|convuls|\bfits?\b|stroke|face droop|slurred|paralys/i },
  { level: 1, cat: 'trauma', label: 'Severe bleeding or major trauma', re: /severe bleeding|heavy bleeding|bleeding (a lot|heavily|badly)|won'?t stop bleeding|stab|gunshot|amputat|crush(ed)? injur/i },
  { level: 1, cat: 'other', label: 'Poisoning, overdose or self-harm risk', re: /overdose|poison|drown|electrocut|snake ?bite|self[- ]harm|suicid/i },
  { level: 2, cat: 'trauma', label: 'Serious injury', re: /head injury|road accident|accident|crash|hit by|fell from|fall from|fracture|bone|broken|deep cut|burn/i },
  { level: 2, cat: 'respiratory', label: 'Breathing trouble', re: /short(ness)? of breath|difficulty breathing|wheez|asthma attack|breathless/i },
  { level: 2, cat: 'other', label: 'Pregnancy or child emergency', re: /pregnan|labou?r|delivery|contractions|infant|baby|newborn|child.*(fever|vomit|fit)|(fever|vomit).*child/i },
  { level: 2, cat: 'other', label: 'Severe symptoms', re: /vomiting blood|blood in (stool|urine)|severe pain|fainted|fainting|very high fever|allergic reaction|swelling (of )?(face|throat)/i },
  { level: 3, cat: 'other', label: 'Needs prompt medical care', re: /vomit|fever|dizz|infection|pain|cut|asthma|rash|diarrh/i },
  { level: 4, cat: 'other', label: 'Minor problem', re: /sprain|headache|cough|cold|sore|minor|scratch/i },
];

// What the reason picked in the SOS box guarantees at minimum.
const REASON_FLOOR = {
  heart: { level: 1, cat: 'cardiac', label: 'Suspected heart attack' },
  breathing: { level: 2, cat: 'respiratory', label: 'Breathing trouble' },
  accident: { level: 2, cat: 'trauma', label: 'Accident or injury' },
  other: { level: 3, cat: 'other', label: 'Needs medical assessment' },
};

export const LEVEL_NAMES = { 1: 'Critical', 2: 'Emergency', 3: 'Urgent', 4: 'Semi-urgent', 5: 'Non-urgent' };

export function pickHospital(cat, level, hospitals) {
  const needsTag = cat === 'cardiac' ? 'Cardiac' : (cat === 'trauma' || cat === 'neuro') ? 'Trauma' : null;
  let best = null;
  for (const h of hospitals) {
    if (level <= 2 && h.icu <= 0) continue;          // critical patients need a free ICU bed
    if (cat === 'respiratory' && h.vent <= 0) continue; // and a ventilator for breathing emergencies
    if (h.beds <= 0) continue;
    let score = h.km;
    if (needsTag && !h.tags.includes(needsTag)) score += 8;
    score -= Math.min(h.icu, 5) * 0.25;               // small bonus for spare ICU capacity
    if (!best || score < best.score) best = { h, score };
  }
  return best ? best.h : [...hospitals].sort((a, b) => a.km - b.km)[0];
}

export function triage({ text = '', reason = 'other', hospitals = [] } = {}) {
  const words = String(text || '');
  let hit = null;
  for (const r of RULES) if (r.re.test(words)) { if (!hit || r.level < hit.level) hit = r; }
  const floor = REASON_FLOOR[reason] || REASON_FLOOR.other;

  let level = floor.level, cat = floor.cat, label = floor.label;
  if (hit && hit.level < level) { level = hit.level; cat = hit.cat; label = hit.label; }
  else if (hit && hit.level === level && floor.cat === 'other') { cat = hit.cat; label = hit.label; }
  // explicit "not breathing" style words always escalate a breathing/other report
  if (/not breathing|stopped breathing|unconscious|unresponsive/i.test(words)) level = 1;

  const hospital = pickHospital(cat, level, hospitals);
  const als = level <= 2;
  const ambEta = [4, 6, 9, 12, 15][level - 1];
  return {
    level,
    levelName: LEVEL_NAMES[level],
    cat,
    label,
    ambulance: { type: als ? 'ALS' : 'BLS', typeName: als ? 'Advanced Life Support' : 'Basic Life Support', etaMin: ambEta },
    hospital,
    hospitalEtaMin: hospital ? Math.max(4, Math.round(hospital.km * 2.3)) : null,
  };
}
