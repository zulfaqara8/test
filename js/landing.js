import { icon } from './icons.js';

// ---- Feature cards ---------------------------------------------------------
const FEATURES = [
  ['ambulance', 'Paramedics & ambulance', 'Nearest ALS or BLS unit assigned by severity, tracked live on the map.'],
  ['shield', 'Police & helplines', '108, 112, 100, 101 and the women helpline, one tap each.', 'blue'],
  ['hospital', 'Hospital network', 'Live beds, ICU and ventilators. Shows ECHS and cashless hospitals.'],
  ['card', 'Medical history & ABHA', 'Blood group, allergies, past history, ABHA and ECHS IDs on one card.', 'blue'],
  ['shieldcheck', 'Health insurance linking', 'Send a cashless approval request while you are on the way.'],
  ['users', 'Closest family', 'WhatsApp, SMS or call your closest family with live location and medical card.', 'blue'],
  ['drop', 'Nearby blood banks', 'Find blood banks on the map and answer urgent donor requests.'],
  ['bell', 'Medicine alarms', 'Loud, customisable reminders (tone and duration) with a “taken” tracker.', 'blue'],
  ['clock', 'Family wellbeing', 'Safety check-in timer for elders who live alone, with a loud alert if missed.'],
  ['steth', 'Nursing & doctors', 'Book nurses, doctors and paramedics for care at home.', 'blue'],
  ['heart', 'Community', 'Medical fundraisers where donors pay families directly by UPI.'],
  ['pin', 'GPS everywhere', 'Accurate location goes with every alert, booking and request.', 'blue'],
  ['siren', 'Loud SOS alarm', 'A full-screen alert with a long, loud siren, vibration and notification.', 'blue', true],
  ['lock', 'Accidental-touch lock', 'SOS asks for a reason and gives a 5-second cancel window before it sends.', 'blue', true],
  ['bot', 'AI assistant', 'Ask for first-aid guidance or help with the app, any time.', 'blue', true],
  ['shieldcheck', 'Secure sign-in', 'Email or Google sign-in keeps your medical card tied to your account.', 'blue', true],
];

const grid = document.getElementById('featureGrid');
if (grid) {
  grid.innerHTML = FEATURES.map(([ic, title, text, tone, isNew]) => `
    <article class="card reveal${isNew ? ' new' : ''}">
      <div class="ico ${tone || ''}">${icon(ic, 22)}</div>
      <h3>${title}${isNew ? '<span class="new-tag">NEW</span>' : ''}</h3>
      <p>${text}</p>
    </article>`).join('');
}

// ---- Nav shadow on scroll --------------------------------------------------
const nav = document.getElementById('nav');
const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 8);
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });

// ---- Live response card animation -----------------------------------------
const timerEl = document.getElementById('liveTimer');
const hrEl = document.getElementById('hr');
const steps = [...document.querySelectorAll('#track li')];
let secs = 165; // T+02:45
const pad = (n) => String(n).padStart(2, '0');
setInterval(() => {
  secs = secs >= 359 ? 165 : secs + 1;
  if (timerEl) timerEl.textContent = `T+${pad(Math.floor(secs / 60))}:${pad(secs % 60)}`;
  if (hrEl) hrEl.textContent = String(110 + Math.round(Math.sin(secs / 3) * 3 + Math.random() * 2));
  // ER step lights up once the ambulance has been out a while
  const erOn = secs % 40 > 20;
  steps[3]?.classList.toggle('on', erOn);
}, 1000);

// ---- Reveal on scroll ------------------------------------------------------
const items = document.querySelectorAll('.reveal, .steps li, .trio article, .team li, .tags div');
items.forEach((el) => el.classList.add('reveal'));
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.12 });
  items.forEach((el) => io.observe(el));
} else {
  items.forEach((el) => el.classList.add('in'));
}

// Register the service worker early so notifications work after sign-in
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
