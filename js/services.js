// Background services that run while the dashboard is open:
//   - medicine alarms (rings at the scheduled time, repeats until marked taken)
//   - family wellbeing check-in (rings if "I'm OK" is not tapped before the timer ends)
import { load, save } from './store.js';
import { emit, getAlarmPrefs, primaryContact, getContacts, telHref, waHref, state } from './core.js';
import { toast, uid } from './ui.js';
import Alarm from './alarm.js';
import { icon } from './icons.js';

const today = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
const toMin = (hhmm) => { const [h, m] = String(hhmm || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
const MAX_REPEATS = 3;
const REPEAT_MIN = 10;

// ---- Medicines -------------------------------------------------------------
export const getMeds = () => load('meds', []);
const saveMeds = (list) => { save('meds', list); emit('meds'); };

export function addMed({ name, dose, time }) {
  const list = getMeds();
  list.push({ id: uid(), name, dose, time, on: true, lastFired: null, lastTaken: null, snoozeUntil: null, repeats: 0 });
  list.sort((a, b) => toMin(a.time) - toMin(b.time));
  saveMeds(list);
}
export function removeMed(id) { saveMeds(getMeds().filter((m) => m.id !== id)); }
export function toggleMed(id) {
  saveMeds(getMeds().map((m) => (m.id === id ? { ...m, on: !m.on } : m)));
}
export function markTaken(id) {
  saveMeds(getMeds().map((m) => (m.id === id ? { ...m, lastTaken: today(), snoozeUntil: null, repeats: 0 } : m)));
  toast('Marked as taken ✓');
}
export function undoTaken(id) {
  saveMeds(getMeds().map((m) => (m.id === id ? { ...m, lastTaken: null } : m)));
}
export function snoozeMed(id, minutes) {
  saveMeds(getMeds().map((m) => (m.id === id ? { ...m, snoozeUntil: Date.now() + minutes * 60000 } : m)));
  toast(`Snoozed for ${minutes} minutes`);
}

function patchMed(id, patch) { saveMeds(getMeds().map((m) => (m.id === id ? { ...m, ...patch } : m))); }

function fireMed(m) {
  const prefs = getAlarmPrefs().medicine;
  patchMed(m.id, { lastFired: today(), snoozeUntil: null });
  const timeLabel = `scheduled for ${m.time}`;
  Alarm.start({
    kind: 'medicine', key: 'med-' + m.id,
    title: `Time for ${m.name}`,
    message: [m.dose, timeLabel].filter(Boolean).join(' · '),
    tone: prefs.tone, durationSec: prefs.duration,
    actions: [
      { label: 'Mark as taken', tone: 'light', iconSvg: icon('check', 20), onClick: () => markTaken(m.id), stop: true },
      { label: 'Snooze 5 min', tone: 'ghost', iconSvg: icon('clock', 20), onClick: () => snoozeMed(m.id, 5), stop: true },
    ],
    onStop(reason) {
      // Silenced or unanswered: ring again soon unless it was taken or snoozed.
      if (reason !== 'timeout' && reason !== 'user') return;
      const cur = getMeds().find((x) => x.id === m.id);
      if (!cur || cur.lastTaken === today() || cur.snoozeUntil) return;
      if ((cur.repeats || 0) < MAX_REPEATS) {
        patchMed(m.id, { repeats: (cur.repeats || 0) + 1, snoozeUntil: Date.now() + REPEAT_MIN * 60000 });
        toast(`${m.name} will remind you again in ${REPEAT_MIN} min unless you mark it as taken.`, 5000);
      }
    },
  });
}

function checkMeds() {
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  for (const m of getMeds()) {
    if (!m.on || m.lastTaken === today()) continue;
    if (m.snoozeUntil) { if (Date.now() >= m.snoozeUntil) fireMed(m); continue; }
    const due = toMin(m.time);
    // Grace of 45 minutes so a throttled background tab still rings once it wakes up.
    if (m.lastFired !== today() && mins >= due && mins - due <= 45) fireMed(m);
  }
}

export const medStatus = (m) => {
  if (m.lastTaken === today()) return 'taken';
  const mins = new Date().getHours() * 60 + new Date().getMinutes();
  if (m.snoozeUntil) return 'snoozed';
  if (m.lastFired === today()) return 'due';
  return mins > toMin(m.time) + 45 ? 'missed' : 'upcoming';
};

// ---- Family wellbeing check-in ------------------------------------------------
export const EVERY_OPTIONS = [
  { min: 1, label: '1 min (test)' },
  { min: 30, label: '30 minutes' },
  { min: 60, label: '1 hour' },
  { min: 120, label: '2 hours' },
  { min: 240, label: '4 hours' },
  { min: 480, label: '8 hours' },
];
export const everyLabel = (min) => (EVERY_OPTIONS.find((o) => o.min === min) || { label: `${min} min` }).label;

export const getWellbeing = () => load('wellbeing', null);
const saveWellbeing = (w) => { save('wellbeing', w); emit('wellbeing'); };

export function startWellbeing({ who, everyMin }) {
  saveWellbeing({ who, everyMin, endsAt: Date.now() + everyMin * 60000, status: 'running', missedAt: null });
}
export function imOk() {
  const w = getWellbeing();
  if (!w) return;
  if (Alarm.activeKind() === 'wellbeing') Alarm.stop('api');
  saveWellbeing({ ...w, endsAt: Date.now() + w.everyMin * 60000, status: 'running', missedAt: null });
  toast(`Great, next check-in in ${everyLabel(w.everyMin)}.`);
}
export function stopWellbeing() { saveWellbeing(null); }

function contactFor(who) {
  const list = getContacts();
  const q = String(who || '').trim().toLowerCase();
  if (q) {
    const hit = list.find((c) => c.name.toLowerCase().includes(q) || (c.relation || '').toLowerCase().includes(q));
    if (hit) return hit;
  }
  return primaryContact();
}

function fireWellbeing(w) {
  const prefs = getAlarmPrefs().wellbeing;
  const c = contactFor(w.who);
  saveWellbeing({ ...w, status: 'missed', missedAt: Date.now(), endsAt: null });
  const who = w.who || 'Your family member';
  const msg = `${who} did not tap “I'm OK” within ${everyLabel(w.everyMin)}. Please call or message them now.`;
  const acts = [];
  if (c) {
    acts.push({ label: `Call ${c.name}`, tone: 'light', iconSvg: icon('phone', 20), href: telHref(c.phone), stop: true });
    acts.push({ label: 'WhatsApp', tone: 'ghost', iconSvg: icon('chat', 20), href: waHref(c.phone, `Hi, ${who} hasn't checked in on PulseSync. Are you able to check on them?`), external: true });
  }
  acts.push({ label: 'They are OK', tone: 'ghost', iconSvg: icon('check', 20), onClick: () => imOk(), stop: true });
  acts.push({ label: 'Call 108', tone: 'ghost', iconSvg: icon('ambulance', 20), href: 'tel:108', stop: true });
  Alarm.start({
    kind: 'wellbeing', key: 'wb',
    title: `${who} hasn't checked in`,
    message: msg,
    tone: prefs.tone, durationSec: prefs.duration,
    actions: acts,
  });
}

function checkWellbeing() {
  const w = getWellbeing();
  if (w && w.status === 'running' && w.endsAt && Date.now() >= w.endsAt) fireWellbeing(w);
}

// ---- Tests (full alarm with the person's chosen tone and duration) ----------------
export function testAlarm(kind) {
  const prefs = getAlarmPrefs()[kind];
  Alarm.start({
    kind: 'test', key: 'test-' + kind,
    title: kind === 'medicine' ? 'Medicine alarm (test)' : 'Family check-in alarm (test)',
    message: 'This is a test of your chosen tone and duration. Nothing was sent.',
    tone: prefs.tone, durationSec: prefs.duration, stopLabel: 'Stop test',
  });
}

// ---- Start everything --------------------------------------------------------------
let started = false;
export function startServices() {
  if (started) return;
  started = true;
  const tick = () => {
    if (!state.user) return;
    checkMeds();
    checkWellbeing();
    emit('tick');
  };
  setInterval(tick, 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') tick(); });
}
