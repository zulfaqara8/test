// Shared runtime state and helpers for the dashboard pages.
import { load, save, setNS } from './store.js';

export const bus = new EventTarget();
export const emit = (name, detail) => bus.dispatchEvent(new CustomEvent(name, { detail }));
export const on = (name, fn) => { const h = (e) => fn(e.detail); bus.addEventListener(name, h); return () => bus.removeEventListener(name, h); };

export const state = {
  user: null,
  gps: { status: 'off', lat: null, lng: null, acc: null, ts: 0 }, // off | asking | on | denied | unavailable
  sos: null,
};

/** Navigation function, set by the router in app.js. */
export const nav = { go: (path) => { location.href = path; } };

export function setUser(u) {
  state.user = u;
  setNS(u.uid);
  state.sos = load('sos', null);
}

export const firstName = () => (state.user && state.user.name ? state.user.name.split(' ')[0] : 'there');

// ---- Family contacts -------------------------------------------------------
export const getContacts = () => load('contacts', []);
export const saveContacts = (list) => { save('contacts', list); emit('contacts'); };
export const primaryContact = () => { const c = getContacts(); return c.find((x) => x.primary) || c[0] || null; };

/** Normalise a phone number for tel:, sms: and WhatsApp links. Assumes India (+91) for 10-digit numbers. */
export function normPhone(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  if (d.length === 10) d = '91' + d;
  return { digits: d, tel: '+' + d, wa: d };
}
export const validPhone = (raw) => String(raw || '').replace(/\D/g, '').length >= 7;

export const telHref = (num) => {
  const n = normPhone(num);
  return n ? `tel:${n.tel}` : `tel:${String(num).replace(/[^\d+]/g, '')}`;
};
export const smsHref = (nums, body) => {
  const list = (Array.isArray(nums) ? nums : [nums]).map((n) => (normPhone(n) || {}).tel).filter(Boolean);
  return `sms:${list.join(',')}?body=${encodeURIComponent(body)}`;
};
export const waHref = (num, text) => {
  const n = normPhone(num);
  return `https://wa.me/${n ? n.wa : ''}?text=${encodeURIComponent(text)}`;
};

// ---- Medical profile -------------------------------------------------------
export const PROFILE_KEYS = ['name', 'age', 'gender', 'blood', 'allergies', 'conditions', 'medicines', 'pastHistory', 'surgeries', 'abha', 'echs', 'insurer', 'policy', 'helpline'];

export function getProfile() {
  const saved = load('profile', {});
  return { name: (state.user && state.user.name) || '', ...saved };
}
export const setProfile = (p) => { save('profile', p); emit('profile'); };
export function profileCompleteness(p = getProfile()) {
  const filled = PROFILE_KEYS.filter((k) => String(p[k] ?? '').trim() !== '').length;
  return Math.round((filled / PROFILE_KEYS.length) * 100);
}

export function medicalCardText(p = getProfile()) {
  const line = (k, v) => (String(v ?? '').trim() ? `${k}: ${v}` : null);
  return [
    '🩺 EMERGENCY MEDICAL CARD (PulseSync AI)',
    line('Name', p.name),
    line('Age', p.age ? `${p.age} yrs` : ''),
    line('Gender', p.gender),
    line('Blood group', p.blood),
    line('Allergies', p.allergies),
    line('Conditions', p.conditions),
    line('Regular medicines', p.medicines),
    line('Past medical history', p.pastHistory),
    line('Past surgeries / hospital stays', p.surgeries),
    line('ABHA', p.abha),
    line('ECHS', p.echs),
    line('Insurer', p.insurer),
    line('Policy', p.policy),
  ].filter(Boolean).join('\n');
}

// ---- Alarm preferences -----------------------------------------------------
const DEFAULT_ALARMS = {
  medicine: { tone: 'bell', duration: 30 },
  wellbeing: { tone: 'siren', duration: 60 },
};
export function getAlarmPrefs() {
  const s = load('alarmPrefs', {});
  return {
    medicine: { ...DEFAULT_ALARMS.medicine, ...(s.medicine || {}) },
    wellbeing: { ...DEFAULT_ALARMS.wellbeing, ...(s.wellbeing || {}) },
  };
}
export function setAlarmPref(kind, patch) {
  const all = getAlarmPrefs();
  all[kind] = { ...all[kind], ...patch };
  save('alarmPrefs', all);
  emit('alarmPrefs');
  return all;
}

// ---- GPS -------------------------------------------------------------------
let watchId = null;

function applyPosition(pos) {
  state.gps = { status: 'on', lat: pos.coords.latitude, lng: pos.coords.longitude, acc: Math.round(pos.coords.accuracy || 0), ts: Date.now() };
  emit('gps', state.gps);
}

export function requestGPS() {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) { state.gps = { ...state.gps, status: 'unavailable' }; emit('gps', state.gps); return resolve(state.gps); }
    state.gps = { ...state.gps, status: 'asking' };
    emit('gps', state.gps);
    navigator.geolocation.getCurrentPosition(
      (pos) => { applyPosition(pos); resolve(state.gps); },
      (err) => {
        state.gps = { ...state.gps, status: err && err.code === 1 ? 'denied' : 'unavailable' };
        emit('gps', state.gps);
        resolve(state.gps);
      },
      { enableHighAccuracy: true, timeout: 9000, maximumAge: 15000 },
    );
  });
}

/** Keep the position fresh (used while an SOS is active). */
export function watchGPS(on = true) {
  if (!('geolocation' in navigator)) return;
  if (!on) { if (watchId != null) navigator.geolocation.clearWatch(watchId); watchId = null; return; }
  if (watchId != null) return;
  watchId = navigator.geolocation.watchPosition(applyPosition, () => {}, { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 });
}

export const hasFix = () => state.gps.status === 'on' && state.gps.lat != null;
export const mapsLink = () => (hasFix() ? `https://maps.google.com/?q=${state.gps.lat},${state.gps.lng}` : '');
export function mapsSearch(query) {
  if (hasFix()) return `https://www.google.com/maps/search/${encodeURIComponent(query)}/@${state.gps.lat},${state.gps.lng},14z`;
  return `https://www.google.com/maps/search/${encodeURIComponent(query + ' near me')}`;
}
export const locationText = () => (hasFix() ? `Live location: ${mapsLink()} (±${state.gps.acc} m)` : 'Location: GPS is off, please call me');

// ---- Messages --------------------------------------------------------------
export function sosMessage({ who, reasonText, triageResult } = {}) {
  const p = getProfile();
  const name = who || p.name || (state.user && state.user.name) || 'Someone';
  const parts = [`🚨 SOS from ${name}`];
  if (reasonText) parts.push(`Problem: ${reasonText}`);
  if (triageResult) {
    parts.push(`AI severity: Level ${triageResult.level} (${triageResult.levelName}). A doctor will confirm.`);
    if (triageResult.hospital) parts.push(`Heading to: ${triageResult.hospital.name}`);
  }
  parts.push(locationText());
  if (p.blood) parts.push(`Blood group: ${p.blood}`);
  if (p.allergies) parts.push(`Allergies: ${p.allergies}`);
  parts.push('Sent with PulseSync AI. Please call back or come now.');
  return parts.join('\n');
}
