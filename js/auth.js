// ============================================================================
//  PASTE YOUR FIREBASE WEB APP CONFIG HERE
//  Firebase console → Project settings → Your apps → Web app → "firebaseConfig"
//  Then enable Authentication → Sign-in method → Email/Password and Google.
//  Also add your Netlify domain under Authentication → Settings → Authorized domains.
// ============================================================================
export const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  appId: 'YOUR_APP_ID',
};
// ============================================================================

const SDK = 'https://www.gstatic.com/firebasejs/10.14.1';

const isConfigured = () =>
  ['apiKey', 'authDomain', 'projectId', 'appId'].every((k) => {
    const v = firebaseConfig[k];
    return v && !String(v).includes('YOUR_');
  });

// 'firebase' = real auth. 'demo' = Firebase not configured yet (accounts live only in this browser).
// 'error'   = Firebase is configured but its library could not be loaded.
let mode = isConfigured() ? 'firebase' : 'demo';
let fb = null;
let auth = null;
let current; // undefined = not known yet, null = signed out, object = signed in
let initPromise = null;
const subs = new Set();

export const authMode = () => mode;

const shape = (u) =>
  u ? {
    uid: u.uid,
    email: u.email || '',
    name: u.displayName || u.name || (u.email ? u.email.split('@')[0] : 'there'),
    photo: u.photoURL || '',
  } : null;

function emit(u) {
  current = u;
  subs.forEach((cb) => { try { cb(u); } catch (e) { console.error(e); } });
}

export function init() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    if (mode === 'firebase') {
      try {
        const [appM, authM] = await Promise.all([
          import(`${SDK}/firebase-app.js`),
          import(`${SDK}/firebase-auth.js`),
        ]);
        fb = authM;
        auth = authM.getAuth(appM.initializeApp(firebaseConfig));
        authM.onAuthStateChanged(auth, (u) => emit(shape(u)));
      } catch (e) {
        console.error('Firebase could not be loaded', e);
        mode = 'error';
        emit(null);
      }
      return;
    }
    emit(shape(readSession()));
  })();
  return initPromise;
}

/** Subscribe to sign-in state. cb(user|null) fires once the state is known, then on every change. */
export function onUser(cb) {
  subs.add(cb);
  if (current !== undefined) cb(current);
  init();
  return () => subs.delete(cb);
}

// ---- Public actions -------------------------------------------------------
export async function signUp(name, email, password) {
  await init();
  assertUsable();
  if (mode === 'firebase') {
    const cred = await fb.createUserWithEmailAndPassword(auth, email, password);
    if (name) await fb.updateProfile(cred.user, { displayName: name });
    emit(shape(auth.currentUser));
    return shape(auth.currentUser);
  }
  return demoSignUp(name, email, password);
}

export async function signIn(email, password) {
  await init();
  assertUsable();
  if (mode === 'firebase') {
    const cred = await fb.signInWithEmailAndPassword(auth, email, password);
    return shape(cred.user);
  }
  return demoSignIn(email, password);
}

export async function signInGoogle() {
  await init();
  assertUsable();
  if (mode !== 'firebase') throw authErr('demo/google-unavailable');
  const provider = new fb.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const cred = await fb.signInWithPopup(auth, provider);
  return shape(cred.user);
}

export async function resetPassword(email) {
  await init();
  assertUsable();
  if (mode === 'firebase') return fb.sendPasswordResetEmail(auth, email);
  const users = readUsers();
  if (!users[email.toLowerCase()]) throw authErr('auth/user-not-found');
  return true; // demo: nothing to send
}

export async function logout() {
  await init();
  if (mode === 'firebase' && auth) { await fb.signOut(auth); return; }
  localStorage.removeItem(SESSION_KEY);
  emit(null);
}

/** Firebase ID token for calling the chatbot function (null in demo mode). */
export async function getIdToken() {
  try { return auth && auth.currentUser ? await auth.currentUser.getIdToken() : null; } catch { return null; }
}

function assertUsable() {
  if (mode === 'error') throw authErr('auth/network-request-failed');
}

// ---- Friendly error text --------------------------------------------------
const MESSAGES = {
  'auth/invalid-email': "That email address doesn't look right.",
  'auth/missing-email': 'Enter your email address.',
  'auth/missing-password': 'Enter your password.',
  'auth/email-already-in-use': 'An account with this email already exists. Try signing in instead.',
  'auth/weak-password': 'Use a password with at least 6 characters.',
  'auth/invalid-credential': 'Email or password is incorrect.',
  'auth/invalid-login-credentials': 'Email or password is incorrect.',
  'auth/wrong-password': 'Email or password is incorrect.',
  'auth/user-not-found': 'No account found with that email.',
  'auth/user-disabled': 'This account has been disabled.',
  'auth/too-many-requests': 'Too many attempts. Wait a minute and try again.',
  'auth/popup-closed-by-user': 'Sign-in was cancelled.',
  'auth/cancelled-popup-request': 'Sign-in was cancelled.',
  'auth/popup-blocked': 'Your browser blocked the Google pop-up. Allow pop-ups for this site and try again.',
  'auth/network-request-failed': 'Could not reach the sign-in service. Check your internet connection.',
  'auth/unauthorized-domain': "This website's domain isn't authorised in Firebase yet (Authentication → Settings → Authorized domains).",
  'auth/operation-not-allowed': "This sign-in method isn't enabled in Firebase yet (Authentication → Sign-in method).",
  'auth/invalid-api-key': 'The Firebase API key in js/auth.js is not valid.',
  'demo/google-unavailable': 'Google sign-in needs Firebase. Paste your Firebase config into js/auth.js to turn it on.',
};
export const friendlyError = (e) => MESSAGES[e && e.code] || 'Something went wrong. Please try again.';

function authErr(code) { const e = new Error(code); e.code = code; return e; }

// ---- Demo mode (only when Firebase is not configured) ----------------------
// Accounts are stored in this browser's localStorage. This exists so the prototype can be demonstrated
// before Firebase is connected. It is NOT secure authentication.
const USERS_KEY = 'psa_demo_users';
const SESSION_KEY = 'psa_demo_session';

function readUsers() { try { return JSON.parse(localStorage.getItem(USERS_KEY) || '{}'); } catch { return {}; } }
function readSession() { try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; } }

async function hashPw(pw, salt) {
  try {
    if (!crypto || !crypto.subtle) throw 0;
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 60000, hash: 'SHA-256' }, key, 256);
    return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    let h = 5381; const s = salt + pw;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return 'x' + (h >>> 0).toString(16);
  }
}

const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

async function demoSignUp(name, email, password) {
  email = (email || '').trim().toLowerCase();
  if (!validEmail(email)) throw authErr('auth/invalid-email');
  if (!password) throw authErr('auth/missing-password');
  if (password.length < 6) throw authErr('auth/weak-password');
  const users = readUsers();
  if (users[email]) throw authErr('auth/email-already-in-use');
  const salt = Math.random().toString(36).slice(2);
  const uid = 'demo-' + Math.random().toString(36).slice(2, 10);
  users[email] = { uid, name: (name || '').trim(), salt, hash: await hashPw(password, salt) };
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  return startSession(uid, email, users[email].name);
}

async function demoSignIn(email, password) {
  email = (email || '').trim().toLowerCase();
  if (!validEmail(email)) throw authErr('auth/invalid-email');
  if (!password) throw authErr('auth/missing-password');
  const u = readUsers()[email];
  if (!u || (await hashPw(password, u.salt)) !== u.hash) throw authErr('auth/invalid-credential');
  return startSession(u.uid, email, u.name);
}

function startSession(uid, email, name) {
  const s = { uid, email, name: name || email.split('@')[0] };
  localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  emit(shape(s));
  return shape(s);
}
