// Dashboard shell: sign-in guard, navigation, top-bar status pills and page routing.
import { onUser, logout } from './auth.js';
import { state, setUser, nav, on, requestGPS } from './core.js';
import { icon } from './icons.js';
import { $, esc, toast } from './ui.js';
import Alarm from './alarm.js';
import { startServices } from './services.js';
import { renderEmergency } from './pages-emergency.js';
import { renderHealth } from './pages-health.js';
import { renderFamily } from './pages-family.js';
import { renderCare } from './pages-care.js';
import { renderCommunity } from './pages-community.js';
import { renderFeedback } from './pages-feedback.js';
import { initChatbot } from './chatbot.js';

const ROUTES = [
  { path: '/dashboard', label: 'Emergency', short: 'Emergency', icon: 'siren', render: renderEmergency },
  { path: '/dashboard/health', label: 'My Health ID', short: 'Health ID', icon: 'idcard', render: renderHealth },
  { path: '/dashboard/family', label: 'Family & Meds', short: 'Family', icon: 'users', render: renderFamily },
  { path: '/dashboard/care', label: 'Care at Home', short: 'Care', icon: 'home', render: renderCare },
  { path: '/dashboard/community', label: 'Community', short: 'Community', icon: 'heart', render: renderCommunity },
  { path: '/dashboard/feedback', label: 'Feedback', short: 'Feedback', icon: 'msg', render: renderFeedback },
];

const view = $('#view');
let cleanup = null;
let booted = false;

const currentRoute = () => {
  const p = location.pathname.replace(/\/+$/, '') || '/dashboard';
  return ROUTES.find((r) => r.path === p) || ROUTES[0];
};

function renderNav() {
  const here = currentRoute().path;
  const link = (r, text) => `<a href="${r.path}" ${r.path === here ? 'aria-current="page"' : ''}>${icon(r.icon, 20)}<span>${esc(text)}</span></a>`;
  $('#sideNav').innerHTML = ROUTES.map((r) => link(r, r.label)).join('');
  $('#tabBar').innerHTML = ROUTES.map((r) => link(r, r.short)).join('');
}

function render() {
  if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } cleanup = null; }
  const route = currentRoute();
  if (location.pathname.replace(/\/+$/, '') !== route.path) history.replaceState(null, '', route.path);
  document.title = `${route.label} — PulseSync AI`;
  renderNav();
  view.innerHTML = '';
  try {
    cleanup = route.render(view) || null;
  } catch (e) {
    console.error(e);
    view.innerHTML = '<section class="page"><div class="card"><h2>This page could not load</h2><p class="muted">Please refresh. In an emergency, call 108.</p></div></section>';
  }
  window.scrollTo(0, 0);
}

nav.go = (path) => {
  if (location.pathname !== path) history.pushState(null, '', path);
  render();
};

// Keep navigation inside the app without a full page load.
document.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target.closest('a[href]');
  if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
  const u = new URL(a.href, location.origin);
  if (u.origin !== location.origin || !u.pathname.startsWith('/dashboard')) return;
  e.preventDefault();
  nav.go(u.pathname);
});
window.addEventListener('popstate', render);

// ---- Top bar status pills ---------------------------------------------------------
function renderGps() {
  const g = state.gps;
  const pill = $('#gpsPill');
  pill.className = 'pill-s';
  let text = 'GPS off';
  if (g.status === 'asking') text = 'Finding GPS…';
  else if (g.status === 'on') { text = `GPS on · ±${g.acc} m`; pill.classList.add('on'); }
  else if (g.status === 'denied') { text = 'GPS blocked'; pill.classList.add('warn'); }
  else if (g.status === 'unavailable') { text = 'GPS unavailable'; pill.classList.add('warn'); }
  pill.querySelector('span').textContent = text;
  pill.title = g.status === 'denied' ? 'Allow location in your browser settings' : 'Turn on GPS so alerts carry your location';
}

function renderNet() {
  const pill = $('#netPill');
  const off = !navigator.onLine;
  pill.classList.toggle('off', off);
  pill.querySelector('span').textContent = off ? 'Offline · SMS fallback ready' : 'Network · 5 sample hospitals';
}

function renderAudioBar() {
  const s = Alarm.status();
  const bar = $('#audioBar');
  const needAudio = !s.audio;
  const needNotif = s.notifications === 'default';
  bar.hidden = !(needAudio || needNotif);
  if (bar.hidden) return;
  $('#audioMsg').textContent = needAudio
    ? 'Tap once to turn on alarm sound, so SOS and medicine alarms can ring.'
    : 'Allow notifications so alarms also show on your lock screen.';
  $('#audioBtn').textContent = needAudio ? 'Turn on sound' : 'Allow notifications';
}

// ---- Boot ------------------------------------------------------------------------------
function boot(user) {
  setUser(user);
  $('#boot').hidden = true;
  $('#app').hidden = false;
  $('#whoName').textContent = user.name;
  $('#logoutBtn').innerHTML = `${icon('logout', 15)} Sign out`;
  $('#call108').innerHTML = `${icon('phone', 18)} Call 108`;
  $('#top108').innerHTML = `${icon('phone', 16)} 108`;

  $('#logoutBtn').addEventListener('click', async () => {
    try { await logout(); } finally { location.replace('/login'); }
  });
  $('#gpsPill').addEventListener('click', async () => {
    const g = await requestGPS();
    if (g.status === 'denied') toast('Location is blocked. Allow it in your browser settings, then try again.', 5000);
  });
  $('#audioBtn').addEventListener('click', async () => { await Alarm.enable(); renderAudioBar(); });

  on('gps', renderGps);
  renderGps(); renderNet(); renderAudioBar();
  window.addEventListener('online', () => { renderNet(); toast('Back online.'); });
  window.addEventListener('offline', () => { renderNet(); toast('You are offline. SOS can still go to your family by SMS.', 5000); });
  document.addEventListener('psa:audio', renderAudioBar);
  on('tick', renderAudioBar);

  render();
  startServices();
  initChatbot();

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
}

onUser((user) => {
  if (!user) {
    location.replace(`/login?next=${encodeURIComponent(location.pathname + location.search)}`);
    return;
  }
  if (booted) return;
  booted = true;
  boot(user);
});
