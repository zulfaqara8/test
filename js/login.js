import { onUser, authMode, signIn, signUp, signInGoogle, resetPassword, friendlyError, init } from './auth.js';

const $ = (id) => document.getElementById(id);

// Only ever send people back into the dashboard.
function safeNext(raw) {
  try {
    const u = new URL(raw || '/dashboard', location.origin);
    if (u.origin === location.origin && u.pathname.startsWith('/dashboard')) return u.pathname + u.search;
  } catch { /* fall through */ }
  return '/dashboard';
}
const next = safeNext(new URLSearchParams(location.search).get('next'));

let signingUp = false;

function setMode(up) {
  signingUp = up;
  $('tabIn').setAttribute('aria-selected', String(!up));
  $('tabUp').setAttribute('aria-selected', String(up));
  $('nameField').hidden = !up;
  $('formTitle').textContent = up ? 'Create your account' : 'Welcome back';
  $('formSub').textContent = up ? 'It takes a few seconds. Your data stays tied to your account.' : 'Sign in to open your dashboard.';
  $('submit').textContent = up ? 'Create account' : 'Sign in';
  $('forgot').hidden = up;
  $('password').autocomplete = up ? 'new-password' : 'current-password';
  showError('');
  showOk('');
}

function showError(msg) { const el = $('err'); el.textContent = msg; el.hidden = !msg; }
function showOk(msg) { const el = $('ok'); el.textContent = msg; el.hidden = !msg; }
function busy(on) {
  ['submit', 'google', 'forgot'].forEach((id) => { $(id).disabled = on; });
  $('submit').dataset.label = $('submit').dataset.label || $('submit').textContent;
  if (on) $('submit').textContent = signingUp ? 'Creating account…' : 'Signing in…';
  else $('submit').textContent = signingUp ? 'Create account' : 'Sign in';
}

$('tabIn').addEventListener('click', () => setMode(false));
$('tabUp').addEventListener('click', () => setMode(true));

$('eye').addEventListener('click', () => {
  const pw = $('password');
  const show = pw.type === 'password';
  pw.type = show ? 'text' : 'password';
  $('eye').textContent = show ? 'Hide' : 'Show';
  $('eye').setAttribute('aria-pressed', String(show));
  $('eye').setAttribute('aria-label', show ? 'Hide password' : 'Show password');
});

$('form').addEventListener('submit', async (e) => {
  e.preventDefault();
  showError(''); showOk('');
  const email = $('email').value.trim();
  const password = $('password').value;
  if (!email) return showError('Enter your email address.');
  if (!password) return showError('Enter your password.');
  if (signingUp && password.length < 6) return showError('Use a password with at least 6 characters.');
  busy(true);
  try {
    if (signingUp) await signUp($('name').value.trim(), email, password);
    else await signIn(email, password);
    // onUser() below performs the redirect once the session is active.
  } catch (err) {
    showError(friendlyError(err));
    busy(false);
  }
});

$('google').addEventListener('click', async () => {
  showError(''); showOk('');
  busy(true);
  try { await signInGoogle(); } catch (err) { showError(friendlyError(err)); busy(false); }
});

$('forgot').addEventListener('click', async () => {
  showError(''); showOk('');
  const email = $('email').value.trim();
  if (!email) return showError('Type your email above, then tap “Forgot password?”.');
  busy(true);
  try {
    await resetPassword(email);
    showOk(authMode() === 'firebase' ? 'Password reset email sent. Check your inbox (and spam).' : 'Demo mode: no email is sent. Create a new account instead.');
  } catch (err) { showError(friendlyError(err)); }
  busy(false);
});

// Redirect as soon as a session exists (also handles "already signed in").
onUser((user) => { if (user) location.replace(next); });

(async function banner() {
  await init();
  const b = $('banner');
  const m = authMode();
  if (m === 'demo') {
    b.hidden = false;
    b.textContent = 'Demo mode: Firebase is not connected yet, so accounts are kept only in this browser. Add your Firebase config in js/auth.js for real sign-in and Google login.';
  } else if (m === 'error') {
    b.hidden = false; b.className = 'banner bad';
    b.textContent = 'Could not load the sign-in service. Check your internet connection and refresh.';
  }
})();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
