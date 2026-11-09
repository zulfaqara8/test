// Floating AI assistant. Calls /api/chat (a Netlify Function that holds the API key).
// If the function is not set up or the person is offline, it falls back to built-in first-aid and app answers.
import { getIdToken } from './auth.js';
import { icon } from './icons.js';
import { FIRST_AID } from './data.js';
import { esc, $ } from './ui.js';
import { openSosDialog } from './sos.js';

const DANGER = /chest (pain|tight|pressure)|heart attack|not breathing|stopped breathing|can'?t breathe|cannot breathe|gasping|unconscious|unresponsive|not waking|collapsed|heavy bleeding|bleeding (a lot|heavily|badly)|won'?t stop bleeding|stroke|face droop|slurred|seizure|convuls|poison|overdose|snake ?bite|choking|choked|drown|electrocut|suicid|self[- ]harm|kill myself/i;

const CHIPS = ['Chest pain: what do I do?', 'How does SOS work?', 'Set a medicine alarm', 'First aid for a burn'];

const APP_HELP = [
  { re: /sos|panic|accident(al)? (press|touch)|cancel/i, text: 'Tap the red SOS button, pick what is happening (this is required), then confirm. You get a 5-second countdown where you can cancel. After it ends, the alarm rings, AI triage runs, and you can call or message your closest family in one tap. Call 108 for a real ambulance.' },
  { re: /alarm|medicine|medication|tablet|pill|remind/i, text: 'Open Family & Meds. Add the medicine name, dose and time. Under the list you can pick the alarm tone and how long it rings (10, 30, 60 seconds or until you stop it), and press Test sound. Keep the tab open, and tap “Turn on sound” once so the alarm can ring.' },
  { re: /family|check-?in|wellbeing|alone|elder/i, text: 'Family & Meds has a wellbeing check-in. Enter who is at home and how often they should tap “I’m OK”. If they miss it, a loud alarm rings with one-tap call and WhatsApp buttons for your closest contact.' },
  { re: /card|abha|echs|insur|cashless|policy/i, text: 'My Health ID holds your blood group, allergies, conditions, ABHA, ECHS and insurance details. “Send card” shares it with a hospital, and “Cashless request” prepares an approval message for your insurer. Data stays on this device.' },
  { re: /hospital|bed|icu|blood bank|ventilator/i, text: 'The Emergency page lists nearby hospitals with beds, ICU and ventilators (sample data in this prototype), and the “Blood bank” and “Nearest hospital” tiles open the map.' },
  { re: /dnd|do not disturb|silent|loud|volume/i, text: 'A website cannot override Do Not Disturb. Install PulseSync to your home screen, allow it in your phone’s Do Not Disturb exceptions, and keep the alarm volume up. SOS alerts ring at the loudest level the device allows.' },
  { re: /login|sign ?in|account|password|logout|sign ?out/i, text: 'Use the Sign out button at the bottom of the left menu. To sign back in, use your email and password or Continue with Google on the login page.' },
];

function offlineAnswer(q) {
  const t = q.toLowerCase();
  const aid = [
    [/chest|heart|cardiac/, 'Heart attack'], [/bleed|blood loss|cut|wound/, 'Bleeding'], [/chok/, 'Choking'],
    [/unconscious|faint|not waking|collapse/, 'Unconscious'], [/burn|scald/, 'Burn'], [/stroke|face droop|slurred/, 'Stroke'],
  ].find(([re]) => re.test(t));
  if (aid) {
    const steps = FIRST_AID[aid[1]];
    return `First aid for ${aid[1].toLowerCase()} (basic guidance, not a diagnosis):\n${steps.map((s) => `- ${s}`).join('\n')}\nA doctor confirms every critical decision. Always call 108 or 112 first for an emergency.`;
  }
  const app = APP_HELP.find((a) => a.re.test(q));
  if (app) return app.text;
  return 'I can explain first aid basics (heart attack, bleeding, choking, burns, stroke, someone not responding) and how to use PulseSync. In an emergency, call 108 or 112 now. A doctor confirms every critical medical decision.';
}

// Tiny safe formatter: escapes first, then supports "- " lists and **bold**.
function format(text) {
  const lines = String(text).split(/\n+/).map((l) => l.trim()).filter(Boolean);
  let html = '';
  let inList = false;
  for (const raw of lines) {
    const m = raw.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/);
    const body = esc(m ? m[1] : raw).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    if (m) { if (!inList) { html += '<ul>'; inList = true; } html += `<li>${body}</li>`; }
    else { if (inList) { html += '</ul>'; inList = false; } html += `<p>${body}</p>`; }
  }
  if (inList) html += '</ul>';
  return html;
}

export function initChatbot() {
  if (document.getElementById('cbFab')) return;
  const fab = document.createElement('button');
  fab.id = 'cbFab'; fab.type = 'button'; fab.className = 'cb-fab';
  fab.setAttribute('aria-haspopup', 'dialog'); fab.setAttribute('aria-expanded', 'false');
  fab.innerHTML = `${icon('bot', 20)}<span>Ask PulseSync</span>`;
  document.body.appendChild(fab);

  const panel = document.createElement('section');
  panel.className = 'cb'; panel.hidden = true; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'PulseSync assistant');
  panel.innerHTML = `
    <header class="cb-h"><span class="dot" aria-hidden="true">${icon('bot', 18)}</span>
      <div><b>PulseSync Assistant</b><small>First aid basics &amp; app help</small></div>
      <button class="icon-btn" type="button" id="cbClose" aria-label="Close assistant">${icon('x')}</button></header>
    <div class="cb-msgs" id="cbMsgs" aria-live="polite"></div>
    <div class="cb-chips" id="cbChips">${CHIPS.map((c) => `<button type="button" class="chip" data-chip="${esc(c)}">${esc(c)}</button>`).join('')}</div>
    <form class="cb-in" id="cbForm">
      <textarea class="input" id="cbText" rows="1" maxlength="600" placeholder="Ask a question…" aria-label="Your question"></textarea>
      <button class="btn btn-blue" type="submit" id="cbSend" aria-label="Send">${icon('send', 17)}</button>
    </form>
    <p class="cb-note">Not a doctor and can make mistakes. In an emergency, call 108 or 112.</p>`;
  document.body.appendChild(panel);

  const msgs = $('#cbMsgs', panel);
  const text = $('#cbText', panel);
  const history = [];
  let busy = false;
  let notedOffline = false;

  const add = (role, content, cls = '') => {
    const d = document.createElement('div');
    d.className = `msg ${role === 'user' ? 'u' : 'b'} ${cls}`.trim();
    d.innerHTML = format(content);
    msgs.appendChild(d);
    msgs.scrollTop = msgs.scrollHeight;
    return d;
  };

  const sosBubble = () => {
    const d = document.createElement('div');
    d.className = 'msg b sos';
    d.innerHTML = `<p><b>This may be an emergency.</b> Call 108 or 112 now. Don't wait for this chat.</p>
      <div class="chips"><a class="btn btn-red btn-sm" href="tel:108">${icon('phone', 15)} Call 108</a>
      <button class="btn btn-ghost btn-sm" type="button" data-sos>${icon('siren', 15)} Open SOS</button></div>`;
    d.querySelector('[data-sos]').addEventListener('click', () => { close(); openSosDialog({}); });
    msgs.appendChild(d);
    msgs.scrollTop = msgs.scrollHeight;
  };

  function open() {
    panel.hidden = false; fab.hidden = true; fab.setAttribute('aria-expanded', 'true');
    if (!msgs.children.length) add('bot', 'Hi, I can explain first aid basics and show you around PulseSync.\n- I can’t diagnose or replace a doctor.\n- For a real emergency, call 108 or 112 first.');
    setTimeout(() => text.focus(), 40);
  }
  function close() { panel.hidden = true; fab.hidden = false; fab.setAttribute('aria-expanded', 'false'); fab.focus(); }
  fab.addEventListener('click', open);
  $('#cbClose', panel).addEventListener('click', close);
  panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  async function ask(q) {
    if (busy || !q.trim()) return;
    busy = true;
    $('#cbChips', panel).hidden = true;
    add('user', q);
    history.push({ role: 'user', content: q });
    if (DANGER.test(q)) sosBubble();

    const typing = document.createElement('div');
    typing.className = 'msg b';
    typing.innerHTML = '<span class="typing" aria-label="Assistant is typing"><i></i><i></i><i></i></span>';
    msgs.appendChild(typing);
    msgs.scrollTop = msgs.scrollHeight;

    let reply = '';
    let note = '';
    try {
      const token = await getIdToken();
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ messages: history.slice(-8) }),
      });
      if (res.status === 429) { reply = 'You are asking quickly. Please wait a minute and try again.'; }
      else if (res.status === 401) { reply = 'Please sign in again to use the assistant.'; }
      else if (!res.ok) throw new Error('status ' + res.status);
      else reply = (await res.json()).reply || '';
      if (!reply) throw new Error('empty');
    } catch {
      reply = offlineAnswer(q);
      if (!notedOffline) { notedOffline = true; note = 'The AI assistant is not connected right now, so this is a built-in answer.'; }
    }
    typing.remove();
    add('bot', reply);
    if (note) { const n = add('bot', note); n.style.opacity = '.7'; n.style.fontSize = '12.5px'; }
    history.push({ role: 'assistant', content: reply });
    busy = false;
    text.focus();
  }

  $('#cbForm', panel).addEventListener('submit', (e) => {
    e.preventDefault();
    const q = text.value.trim();
    text.value = '';
    text.style.height = '';
    ask(q);
  });
  text.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#cbForm', panel).requestSubmit(); } });
  text.addEventListener('input', () => { text.style.height = 'auto'; text.style.height = Math.min(100, text.scrollHeight) + 'px'; });
  $('#cbChips', panel).addEventListener('click', (e) => { const c = e.target.closest('[data-chip]'); if (c) ask(c.dataset.chip); });
}
