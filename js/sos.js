// SOS flow: confirm with a required reason -> 5 second cancel countdown -> triage + dispatch + loud alarm.
// Family is reached three ways, one tap each: call, WhatsApp (with live location) and SMS to every contact.
import {
  state, emit, nav, getContacts, primaryContact, telHref, smsHref, waHref, sosMessage,
  requestGPS, watchGPS, hasFix, getProfile,
} from './core.js';
import { save, remove } from './store.js';
import { openModal, closeModal, esc, toast, uid } from './ui.js';
import { SOS_REASONS, HOSPITALS } from './data.js';
import { triage } from './triage.js';
import Alarm from './alarm.js';
import { icon } from './icons.js';

const COUNTDOWN_SECONDS = 5;

// ---------------------------------------------------------------------------
// Step 1: confirmation with a required reason
// ---------------------------------------------------------------------------
function suggestReason(text) {
  const t = String(text || '');
  if (/chest|heart|cardiac/i.test(t)) return 'heart';
  if (/breath|choking|asthma/i.test(t)) return 'breathing';
  if (/accident|crash|injur|bleed|fell|fall|fracture/i.test(t)) return 'accident';
  return null;
}

export function openSosDialog({ text = '' } = {}) {
  if (state.sos) { nav.go('/dashboard'); toast('An SOS is already active.'); return; }
  const contacts = getContacts();
  const main = primaryContact();
  const suggested = suggestReason(text);

  const who = contacts.length
    ? `<p class="sos-who ok">${icon('users', 16)}<span>Will alert <b>${esc(main.name)}</b>${contacts.length > 1 ? ` and ${contacts.length - 1} other contact${contacts.length > 2 ? 's' : ''}` : ''}.</span></p>`
    : `<p class="sos-who warn">${icon('alert', 16)}<span>No family contact saved yet. <a href="/dashboard/family" data-nav>Add one</a> so they can be called. You can still send this SOS.</span></p>`;

  let chosen = null;

  openModal({
    title: 'Confirm SOS',
    html: `
      <p class="sos-note">Pressed by mistake? Close this window and nothing will be sent.</p>
      <div class="label" id="rl">What is happening? <span class="req">Required</span></div>
      <div class="reason-grid" role="radiogroup" aria-labelledby="rl">
        ${SOS_REASONS.map((r) => `
          <button type="button" class="reason" role="radio" aria-checked="false" data-r="${r.id}">
            ${icon(r.icon, 22)}<span>${esc(r.label)}</span>${suggested === r.id ? '<em>Suggested</em>' : ''}
          </button>`).join('')}
      </div>
      <div class="field" style="margin-top:14px">
        <label for="sosDetails">More details (optional)</label>
        <textarea class="textarea" id="sosDetails" rows="2" placeholder="e.g. My father has chest pain and is sweating">${esc(text)}</textarea>
      </div>
      ${who}
      <p class="sos-hint" id="sosHint">Choose what is happening to continue.</p>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost btn-lg" data-act="cancel">Cancel</button>
        <button type="button" class="btn btn-red btn-lg" id="sosGo" disabled>${icon('siren', 18)} Send SOS</button>
      </div>`,
    onMount(el) {
      const go = el.querySelector('#sosGo');
      el.querySelectorAll('.reason').forEach((b) => b.addEventListener('click', () => {
        chosen = b.dataset.r;
        el.querySelectorAll('.reason').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
        go.disabled = false;
        el.querySelector('#sosHint').hidden = true;
      }));
      el.querySelector('[data-act="cancel"]').addEventListener('click', () => closeModal('cancel'));
      el.querySelector('[data-nav]')?.addEventListener('click', (e) => { e.preventDefault(); closeModal('nav'); nav.go('/dashboard/family'); });
      go.addEventListener('click', () => {
        if (!chosen) return;
        const details = el.querySelector('#sosDetails').value.trim();
        closeModal('confirmed');
        setTimeout(() => runCountdown({ reason: chosen, details }), 180);
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Step 2: 5 second countdown the user can cancel
// ---------------------------------------------------------------------------
function runCountdown({ reason, details }) {
  const label = SOS_REASONS.find((r) => r.id === reason).label;
  let timer = null;
  let finished = false;
  const end = Date.now() + COUNTDOWN_SECONDS * 1000;

  openModal({
    title: 'Sending SOS…',
    dismissible: false, // only the Cancel button stops it, so a stray tap outside can never cancel (or fire) by accident
    html: `
      <div class="cd" aria-live="assertive">
        <svg viewBox="0 0 120 120" aria-hidden="true"><circle class="cd-bg" cx="60" cy="60" r="52"/><circle class="cd-fg" cx="60" cy="60" r="52"/></svg>
        <span id="cdNum">${COUNTDOWN_SECONDS}</span>
      </div>
      <p class="cd-text">SOS goes out in <b id="cdSec">${COUNTDOWN_SECONDS}</b> seconds</p>
      <p class="muted cd-sub">${esc(label)}${details ? ' · ' + esc(details.slice(0, 80)) : ''}</p>
      <button type="button" class="btn btn-ghost btn-lg btn-block" data-act="abort">${icon('x', 18)} Cancel, I don't need help</button>
      <button type="button" class="btn btn-red btn-block cd-now" data-act="now">Send now</button>`,
    onMount(el) {
      const num = el.querySelector('#cdNum');
      const sec = el.querySelector('#cdSec');
      const fire = () => {
        if (finished) return;
        finished = true;
        clearInterval(timer);
        closeModal('fired');
        fireSos({ reason, details });
      };
      timer = setInterval(() => {
        const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
        num.textContent = left; sec.textContent = left;
        try { navigator.vibrate && left > 0 && navigator.vibrate(40); } catch { /* noop */ }
        if (Date.now() >= end) fire();
      }, 100);
      el.querySelector('[data-act="abort"]').addEventListener('click', () => {
        finished = true; clearInterval(timer); closeModal('aborted'); toast('SOS cancelled. Nothing was sent.');
      });
      el.querySelector('[data-act="now"]').addEventListener('click', fire);
    },
    onClose() { clearInterval(timer); },
  });
}

// ---------------------------------------------------------------------------
// Step 3: SOS fires
// ---------------------------------------------------------------------------
export function sosLinks() {
  const s = state.sos;
  const main = primaryContact();
  const contacts = getContacts();
  const reasonText = s ? [s.reasonLabel, s.details].filter(Boolean).join(': ') : '';
  const body = sosMessage({ reasonText, triageResult: s ? { level: s.level, levelName: s.levelName, hospital: s.hospital } : null });
  return {
    call: main ? telHref(main.phone) : '',
    wa: waHref(main ? main.phone : '', body),
    sms: contacts.length ? smsHref(contacts.map((c) => c.phone), body) : '',
    body,
  };
}

function markDone(key) {
  if (!state.sos) return;
  state.sos.done = { ...(state.sos.done || {}), [key]: Date.now() };
  save('sos', state.sos);
  emit('sos');
}

export function sosActions({ forOverlay = false } = {}) {
  const main = primaryContact();
  const contacts = getContacts();
  const acts = [];
  if (main) {
    acts.push({ key: 'call', label: `Call ${main.name}`, iconSvg: icon('phone', 20), hrefFn: () => sosLinks().call, onClick: () => markDone('call'), stop: forOverlay, tone: 'light' });
    acts.push({ key: 'wa', label: 'WhatsApp my location', iconSvg: icon('chat', 20), hrefFn: () => sosLinks().wa, external: true, onClick: () => markDone('wa'), tone: 'ghost' });
    acts.push({ key: 'sms', label: contacts.length > 1 ? `SMS all ${contacts.length} contacts` : 'Send SMS', iconSvg: icon('msg', 20), hrefFn: () => sosLinks().sms, onClick: () => markDone('sms'), tone: 'ghost' });
  } else {
    acts.push({ key: 'add', label: 'Add a family contact', iconSvg: icon('userplus', 20), onClick: () => { Alarm.stop('action'); nav.go('/dashboard/family'); }, tone: 'light' });
  }
  acts.push({ key: '108', label: 'Call 108 (ambulance)', iconSvg: icon('ambulance', 20), href: 'tel:108', onClick: () => markDone('108'), stop: forOverlay, tone: 'ghost' });
  return acts;
}

function overlayDetail(s) {
  const loc = s.location ? `GPS locked (±${s.location.acc} m)` : 'Finding GPS…';
  return `
    <div class="alarm-grid">
      <div><small>Severity</small><b>Level ${s.level} · ${esc(s.levelName)}</b></div>
      <div><small>Ambulance</small><b>${s.ambulance.type} · about ${s.ambulance.etaMin} min</b></div>
      <div><small>Hospital</small><b>${esc(s.hospital ? s.hospital.name : '—')}</b></div>
      <div><small>Location</small><b>${esc(loc)}</b></div>
    </div>
    <p class="alarm-note">Dispatch is simulated in this prototype. For a real ambulance, call 108.</p>`;
}

function fireSos({ reason, details }) {
  const reasonLabel = SOS_REASONS.find((r) => r.id === reason).label;
  const t = triage({ text: details, reason, hospitals: HOSPITALS });
  const h = t.hospital;
  const sos = {
    id: uid(), startedAt: Date.now(), reason, reasonLabel, details,
    level: t.level, levelName: t.levelName, label: t.label, cat: t.cat,
    ambulance: t.ambulance, hospitalEtaMin: t.hospitalEtaMin,
    hospital: h ? { id: h.id, name: h.name, area: h.area, km: h.km, icu: h.icu } : null,
    location: null, done: {},
  };
  state.sos = sos;
  save('sos', sos);
  emit('sos');
  nav.go('/dashboard');

  // Location can take a few seconds, so it never blocks the alarm.
  requestGPS().then(() => {
    if (!state.sos || state.sos.id !== sos.id) return;
    if (hasFix()) { state.sos.location = { lat: state.gps.lat, lng: state.gps.lng, acc: state.gps.acc }; save('sos', state.sos); }
    emit('sos');
    Alarm.update({ detailHTML: overlayDetail(state.sos) });
    watchGPS(true);
  });

  Alarm.start({
    kind: 'sos', key: 'sos',
    title: 'SOS ACTIVE',
    message: `Level ${sos.level} · ${sos.levelName}: ${sos.label}`,
    detailHTML: overlayDetail(sos),
    tone: 'siren',
    durationSec: 60,
    actions: sosActions({ forOverlay: true }),
    stopLabel: 'Stop alarm',
  });
}

export function endSos() {
  if (Alarm.activeKind() === 'sos') Alarm.stop('api');
  state.sos = null;
  remove('sos');
  watchGPS(false);
  emit('sos');
  toast('SOS ended. Stay safe.');
}

/** Lets a person hear and see exactly what a family member's SOS alert looks like. */
export function testFamilyAlert() {
  Alarm.start({
    kind: 'test', key: 'test-family',
    title: 'Family SOS alert (test)',
    message: 'This is how an SOS alert from a family member looks and sounds. Nothing was sent.',
    tone: 'siren', durationSec: 15, stopLabel: 'Stop test',
  });
}
