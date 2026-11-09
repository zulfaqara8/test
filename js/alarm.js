// PulseSync alarm engine
// One engine for SOS alerts, medicine alarms and family check-in alarms.
//
// While an alarm is active it:
//   - loops a loud synthesized tone (Web Audio, through a limiter so it is as loud as the device allows)
//   - vibrates the phone in a repeating pattern
//   - keeps the screen awake (Screen Wake Lock)
//   - shows a full-screen alert with a big Stop button
//   - posts a system notification that stays until dismissed (requireInteraction)
//   - flashes the browser tab title
//
// A web page cannot override Do Not Disturb or the phone's silent switch. Notification permission,
// installing the app to the home screen and allowing PulseSync in your DND exceptions give the best result.

export const TONES = {
  siren: { label: 'Emergency siren', hint: 'Rising and falling, the loudest' },
  beep: { label: 'Digital beeps', hint: 'Fast triple beeps' },
  bell: { label: 'Hospital bell', hint: 'Ringing bell strikes' },
  pulse: { label: 'Heartbeat pulse', hint: 'Deep two-tone pulse' },
};

export const DURATIONS = [
  { sec: 10, label: '10 seconds' },
  { sec: 30, label: '30 seconds' },
  { sec: 60, label: '60 seconds' },
  { sec: 0, label: 'Until I stop it' },
];

const PRIORITY = { sos: 3, wellbeing: 2, medicine: 1, test: 0 };

// ---------------------------------------------------------------------------
// Tone synthesis. Returns one seamless loop cycle as Float32Array (pure function, no browser APIs).
// ---------------------------------------------------------------------------
export function synth(tone, sr = 44100) {
  const TAU = Math.PI * 2;
  const make = (seconds) => new Float32Array(Math.round(sr * seconds));
  let out;

  if (tone === 'beep') {
    out = make(0.9);
    const starts = [0, 0.22, 0.44];
    for (const s0 of starts) {
      const a = Math.round(s0 * sr), len = Math.round(0.13 * sr);
      for (let i = 0; i < len; i++) {
        const env = Math.min(1, i / (0.004 * sr), (len - i) / (0.006 * sr));
        const p = TAU * 1500 * (i / sr);
        out[a + i] = Math.tanh(2.2 * (0.7 * Math.sign(Math.sin(p)) + 0.3 * Math.sin(p * 3))) * env;
      }
    }
  } else if (tone === 'bell') {
    out = make(2.0);
    const partials = [[660, 1, 3.0], [1320, 0.6, 4.2], [1820, 0.45, 5.5], [2640, 0.3, 7.5], [3500, 0.18, 10]];
    for (const s0 of [0, 0.5, 1.0]) {
      const a = Math.round(s0 * sr);
      for (let i = 0; a + i < out.length; i++) {
        const t = i / sr;
        let v = 0;
        for (const [f, amp, decay] of partials) v += amp * Math.exp(-t * decay) * Math.sin(TAU * f * t);
        const atk = Math.min(1, i / (0.002 * sr));
        out[a + i] += v * atk;
      }
    }
    const fade = Math.round(0.05 * sr);
    for (let i = 0; i < fade; i++) out[out.length - 1 - i] *= i / fade;
    for (let i = 0; i < out.length; i++) out[i] = Math.tanh(1.5 * out[i]);
  } else if (tone === 'pulse') {
    out = make(1.2);
    const thumps = [[0, 700], [0.28, 960]];
    for (const [s0, f] of thumps) {
      const a = Math.round(s0 * sr), len = Math.round(0.2 * sr);
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const env = Math.min(1, i / (0.003 * sr), (len - i) / (0.02 * sr));
        const body = Math.sin(TAU * 140 * t) * Math.exp(-t * 14);
        const edge = Math.sign(Math.sin(TAU * f * t)) * 0.6 + Math.sin(TAU * f * 2 * t) * 0.3;
        out[a + i] = Math.tanh(2 * (edge + body * 1.3)) * env;
      }
    }
  } else {
    // 'siren' (default): sweeps 620 Hz -> 1300 Hz -> 620 Hz. Total phase is forced to a whole number of
    // cycles so the loop point has no click.
    out = make(1.6);
    const n = out.length;
    const freq = (i) => { const u = i / n; const tri = u < 0.5 ? u * 2 : 2 - u * 2; return 620 + 680 * tri; };
    let total = 0;
    for (let i = 0; i < n; i++) total += (TAU * freq(i)) / sr;
    const k = (Math.round(total / TAU) * TAU) / total;
    let ph = 0;
    for (let i = 0; i < n; i++) {
      ph += (TAU * freq(i) * k) / sr;
      out[i] = Math.tanh(1.8 * (0.62 * Math.sign(Math.sin(ph)) + 0.38 * Math.sin(ph)));
    }
  }

  let peak = 0;
  for (let i = 0; i < out.length; i++) peak = Math.max(peak, Math.abs(out[i]));
  if (peak > 0) { const g = 0.96 / peak; for (let i = 0; i < out.length; i++) out[i] *= g; }
  return out;
}

// ---------------------------------------------------------------------------
// Audio plumbing
// ---------------------------------------------------------------------------
let ctx = null;
let master = null;
const buffers = {};

function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* iOS 17+ only */ }
    // Drive the signal hard into a limiter: raises the perceived loudness without harsh digital clipping.
    master = ctx.createGain();
    master.gain.value = 1.7;
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -4;
    lim.knee.value = 0;
    lim.ratio.value = 20;
    lim.attack.value = 0.001;
    lim.release.value = 0.06;
    master.connect(lim);
    lim.connect(ctx.destination);
  }
  return ctx;
}

function bufferFor(tone) {
  const c = getCtx();
  const key = tone + '@' + c.sampleRate;
  if (!buffers[key]) {
    const data = synth(tone, c.sampleRate);
    const b = c.createBuffer(1, data.length, c.sampleRate);
    b.copyToChannel(data, 0);
    buffers[key] = b;
  }
  return buffers[key];
}

/** Starts looping a tone. seconds = 0 means until stopped. Returns a stop() function. */
function playLoop(tone, seconds) {
  const c = getCtx();
  if (!c) return () => {};
  if (c.state === 'suspended') c.resume().catch(() => {});
  const src = c.createBufferSource();
  src.buffer = bufferFor(tone in TONES ? tone : 'siren');
  src.loop = true;
  const g = c.createGain();
  src.connect(g);
  g.connect(master);
  const t0 = c.currentTime + 0.03;
  src.start(t0);
  if (seconds > 0) src.stop(t0 + seconds); // sample-accurate, even if the tab is throttled
  return () => {
    try { g.gain.cancelScheduledValues(c.currentTime); g.gain.setValueAtTime(0, c.currentTime); src.stop(); } catch { /* already stopped */ }
    setTimeout(() => { try { g.disconnect(); } catch { /* noop */ } }, 120);
  };
}

/** Call from a click/tap: unlocks audio and asks for notification permission. */
export async function enable() {
  const c = getCtx();
  if (c) {
    try { await c.resume(); } catch { /* ignore */ }
    // play a near-silent blip so mobile browsers mark audio as allowed
    const b = c.createBuffer(1, 441, c.sampleRate);
    const s = c.createBufferSource();
    s.buffer = b; s.connect(c.destination); s.start();
  }
  let notif = 'unsupported';
  if ('Notification' in window) {
    notif = Notification.permission;
    if (notif === 'default') { try { notif = await Notification.requestPermission(); } catch { /* ignore */ } }
  }
  const st = status();
  document.dispatchEvent(new CustomEvent('psa:audio', { detail: st }));
  return st;
}

export function status() {
  return {
    audio: !!ctx && ctx.state === 'running',
    notifications: 'Notification' in window ? Notification.permission : 'unsupported',
  };
}

// Unlock audio on the first interaction anywhere on the page.
['pointerdown', 'keydown', 'touchstart'].forEach((ev) =>
  window.addEventListener(ev, () => {
    const c = getCtx();
    if (c && c.state === 'suspended') c.resume().then(() => document.dispatchEvent(new CustomEvent('psa:audio', { detail: status() }))).catch(() => {});
  }, { passive: true }),
);

// ---------------------------------------------------------------------------
// Preview ("Test sound")
// ---------------------------------------------------------------------------
let previewStop = null;
let previewTimer = null;
export function preview(tone, seconds = 4) {
  stopPreview();
  getCtx();
  previewStop = playLoop(tone, seconds);
  previewTimer = setTimeout(stopPreview, seconds * 1000 + 100);
}
export function stopPreview() {
  if (previewStop) { previewStop(); previewStop = null; }
  clearTimeout(previewTimer);
}

// ---------------------------------------------------------------------------
// Full alarm
// ---------------------------------------------------------------------------
let active = null;      // { opts, stopAudio, ... }
const queue = [];
let overlay = null;
let wakeLock = null;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function buildOverlay() {
  const el = document.createElement('div');
  el.className = 'alarm-ov';
  el.setAttribute('role', 'alertdialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-labelledby', 'alTitle');
  el.setAttribute('aria-describedby', 'alMsg');
  el.hidden = true;
  el.innerHTML = `
    <div class="alarm-in">
      <div class="alarm-ring" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 18v-6a5 5 0 0 1 10 0v6"/><path d="M5 21h14M12 2v2M3.5 6.5l1.4 1.4M20.5 6.5l-1.4 1.4"/><path d="M5 18h14v3H5z"/></svg></div>
      <p class="alarm-kind" id="alKind"></p>
      <h2 id="alTitle"></h2>
      <p class="alarm-msg" id="alMsg"></p>
      <div class="alarm-detail" id="alDetail"></div>
      <div class="alarm-actions" id="alActions"></div>
      <button type="button" class="alarm-stop" id="alStop">Stop alarm</button>
      <p class="alarm-timer" id="alTimer" aria-live="off"></p>
    </div>`;
  document.body.appendChild(el);
  el.querySelector('#alStop').addEventListener('click', () => stop('user'));
  el.addEventListener('keydown', (e) => { if (e.key === 'Escape') stop('user'); });
  return el;
}

const KIND_LABEL = { sos: 'EMERGENCY ALERT', wellbeing: 'FAMILY CHECK-IN MISSED', medicine: 'MEDICINE REMINDER', test: 'TEST ALERT' };

async function lockScreen() {
  try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } catch { wakeLock = null; }
}
document.addEventListener('visibilitychange', () => {
  if (active && document.visibilityState === 'visible' && (!wakeLock || wakeLock.released)) lockScreen();
});

async function postNotification(title, body, tag) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return null;
  const opts = {
    body, tag, renotify: true, requireInteraction: true, silent: false,
    vibrate: [600, 250, 600, 250, 900],
    icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', data: { url: '/dashboard' },
  };
  try {
    if ('serviceWorker' in navigator) {
      const reg = await Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(() => r(null), 1500))]);
      if (reg) {
        await reg.showNotification(title, opts);
        return { close: async () => { try { (await reg.getNotifications({ tag })).forEach((n) => n.close()); } catch { /* noop */ } } };
      }
    }
  } catch { /* fall back below */ }
  try { const n = new Notification(title, opts); return { close: () => n.close() }; } catch { return null; }
}

function renderActions(opts) {
  const box = overlay.querySelector('#alActions');
  box.innerHTML = '';
  (opts.actions || []).forEach((a, idx) => {
    const cls = `btn btn-lg ${a.tone === 'ghost' ? 'btn-ghost' : a.tone === 'blue' ? 'btn-blue' : 'btn-light'}`;
    const el = document.createElement(a.href || a.hrefFn ? 'a' : 'button');
    el.className = cls;
    const hasLink = a.href || a.hrefFn;
    if (hasLink) { el.href = a.hrefFn ? a.hrefFn() : a.href; if (a.external) { el.target = '_blank'; el.rel = 'noopener'; } } else el.type = 'button';
    el.innerHTML = (a.iconSvg || '') + `<span>${esc(a.label)}</span>`;
    el.addEventListener('click', (e) => {
      if (a.hrefFn) el.href = a.hrefFn(); // evaluate at tap time so GPS and contacts are current
      try { a.onClick && a.onClick(e); } catch (err) { console.error(err); }
      if (a.stop) setTimeout(() => stop('action'), 50);
    });
    box.appendChild(el);
  });
}

function begin(opts) {
  if (!overlay) overlay = buildOverlay();
  const sec = opts.durationSec ?? (opts.kind === 'sos' ? 60 : 30);
  const endsAt = sec > 0 ? Date.now() + sec * 1000 : 0;

  overlay.dataset.kind = opts.kind;
  overlay.querySelector('#alKind').textContent = KIND_LABEL[opts.kind] || 'ALERT';
  overlay.querySelector('#alTitle').textContent = opts.title || 'Alert';
  overlay.querySelector('#alMsg').textContent = opts.message || '';
  overlay.querySelector('#alDetail').innerHTML = opts.detailHTML || '';
  overlay.querySelector('#alStop').textContent = opts.stopLabel || 'Stop alarm';
  renderActions(opts);
  overlay.hidden = false;
  document.documentElement.classList.add('alarm-on');

  const cur = {
    opts, endsAt,
    stopAudio: playLoop(opts.tone || 'siren', sec),
    vibe: null, notif: null, titleTimer: null, tick: null, baseTitle: document.title,
  };

  if (navigator.vibrate) {
    const pat = [600, 250, 600, 250, 900, 500];
    try { navigator.vibrate(pat); } catch { /* noop */ }
    cur.vibe = setInterval(() => { try { navigator.vibrate(pat); } catch { /* noop */ } }, 3100);
  }
  lockScreen();
  postNotification(opts.title || 'PulseSync alert', opts.message || '', 'psa-' + opts.kind).then((n) => { cur.notif = n; if (active !== cur && n) n.close(); });

  let flip = false;
  cur.titleTimer = setInterval(() => { flip = !flip; document.title = flip ? '🚨 ' + (opts.title || 'ALERT') : cur.baseTitle; }, 800);

  const timerEl = overlay.querySelector('#alTimer');
  const updateTimer = () => {
    if (!endsAt) { timerEl.textContent = 'Rings until you stop it'; return; }
    const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
    timerEl.textContent = `Stops by itself in ${left}s`;
    if (left <= 0) stop('timeout');
  };
  updateTimer();
  cur.tick = setInterval(updateTimer, 250);

  active = cur;
  setTimeout(() => { const b = overlay.querySelector('#alStop'); b && b.focus({ preventScroll: true }); }, 50);
  return cur;
}

export function start(opts) {
  opts = { kind: 'medicine', ...opts };
  stopPreview();
  if (active) {
    const pa = PRIORITY[active.opts.kind] ?? 0;
    const pn = PRIORITY[opts.kind] ?? 0;
    if (pn > pa) {
      const prev = active.opts;
      end('preempted');
      if (prev.kind !== 'test') queue.unshift(prev);
    } else {
      if (!queue.some((q) => q.key && q.key === opts.key)) queue.push(opts);
      return { queued: true };
    }
  }
  begin(opts);
  return { stop: (why) => stop(why || 'api') };
}

export function update(patch) {
  if (!active || !overlay) return;
  if (patch.message != null) overlay.querySelector('#alMsg').textContent = patch.message;
  if (patch.detailHTML != null) overlay.querySelector('#alDetail').innerHTML = patch.detailHTML;
}

function end(reason) {
  if (!active) return;
  const cur = active;
  active = null;
  try { cur.stopAudio(); } catch { /* noop */ }
  clearInterval(cur.vibe); clearInterval(cur.tick); clearInterval(cur.titleTimer);
  try { navigator.vibrate && navigator.vibrate(0); } catch { /* noop */ }
  document.title = cur.baseTitle;
  if (cur.notif) cur.notif.close();
  if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
  if (overlay) overlay.hidden = true;
  document.documentElement.classList.remove('alarm-on');
  try { cur.opts.onStop && cur.opts.onStop(reason); } catch (e) { console.error(e); }
}

export function stop(reason = 'user') {
  end(reason);
  if (reason !== 'preempted' && queue.length) {
    const next = queue.shift();
    setTimeout(() => { if (!active) begin(next); }, 700);
  }
}

export const isActive = () => !!active;
export const activeKind = () => (active ? active.opts.kind : null);

export const Alarm = { TONES, DURATIONS, start, stop, update, preview, stopPreview, enable, status, isActive, activeKind, synth };
export default Alarm;
