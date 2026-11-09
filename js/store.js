// Tiny localStorage helper. Data is namespaced per signed-in account so two people sharing a device
// never see each other's medical card or contacts.
let NS = 'guest';

export const setNS = (uid) => { NS = uid || 'guest'; };

export function load(key, fallback = null) {
  try {
    const raw = localStorage.getItem(`psa:${NS}:${key}`);
    return raw == null ? fallback : JSON.parse(raw);
  } catch { return fallback; }
}

export function save(key, value) {
  try { localStorage.setItem(`psa:${NS}:${key}`, JSON.stringify(value)); return true; } catch { return false; }
}

export function remove(key) {
  try { localStorage.removeItem(`psa:${NS}:${key}`); } catch { /* noop */ }
}
