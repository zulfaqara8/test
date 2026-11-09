// Shared UI helpers: escaping, toasts, modal dialogs.
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const uid = () => Math.random().toString(36).slice(2, 10);

export const fmtTime = (d = new Date()) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export const inr = (n) => '₹' + Number(n).toLocaleString('en-IN');

// ---- Toasts -----------------------------------------------------------------
let toastBox;
export function toast(msg, ms = 3400) {
  if (!toastBox) {
    toastBox = document.createElement('div');
    toastBox.className = 'toasts';
    toastBox.setAttribute('aria-live', 'polite');
    document.body.appendChild(toastBox);
  }
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  toastBox.appendChild(t);
  requestAnimationFrame(() => t.classList.add('in'));
  setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 300); }, ms);
}

// ---- Modal ------------------------------------------------------------------
let current = null;

export function closeModal(result) {
  if (!current) return;
  const { bg, prevFocus, onClose, onKey } = current;
  current = null;
  if (onKey) document.removeEventListener('keydown', onKey);
  bg.classList.remove('in');
  setTimeout(() => bg.remove(), 160);
  document.documentElement.classList.remove('modal-open');
  try { prevFocus && prevFocus.focus && prevFocus.focus(); } catch { /* noop */ }
  if (onClose) onClose(result);
}

/**
 * openModal({ title, html, dismissible, onMount(el, api), onClose(result) })
 * Returns { el, close }.
 */
export function openModal({ title = '', html = '', dismissible = true, onMount, onClose, size = '' } = {}) {
  if (current) closeModal('replaced');
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `
    <div class="modal ${size}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      ${title ? `<header class="modal-h"><h3>${esc(title)}</h3>${dismissible ? '<button type="button" class="modal-x" aria-label="Close">×</button>' : ''}</header>` : ''}
      <div class="modal-b">${html}</div>
    </div>`;
  document.body.appendChild(bg);
  document.documentElement.classList.add('modal-open');
  const el = bg.querySelector('.modal');
  current = { bg, prevFocus: document.activeElement, onClose, onKey: null };
  const api = { el, close: closeModal };

  if (dismissible) {
    bg.addEventListener('mousedown', (e) => { if (e.target === bg) closeModal('backdrop'); });
    const x = bg.querySelector('.modal-x');
    x && x.addEventListener('click', () => closeModal('x'));
    // Escape works even if keyboard focus has not moved into the dialog yet.
    const onKey = (e) => { if (e.key === 'Escape' && current && current.bg === bg) closeModal('esc'); };
    document.addEventListener('keydown', onKey);
    current.onKey = onKey;
  }
  // keep keyboard focus inside the dialog
  bg.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const f = [...el.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])')].filter((n) => n.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  requestAnimationFrame(() => bg.classList.add('in'));
  if (onMount) onMount(el, api);
  const auto = el.querySelector('[autofocus]') || el.querySelector('input,select,textarea,button.btn');
  setTimeout(() => auto && auto.focus({ preventScroll: true }), 60);
  return api;
}

export const modalOpen = () => !!current;

/** Promise-based confirm dialog. */
export function confirmDialog({ title = 'Are you sure?', text = '', okLabel = 'Confirm', danger = false } = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (v) => { if (!settled) { settled = true; resolve(v); } };
    openModal({
      title,
      html: `<p class="muted">${esc(text)}</p>
        <div class="modal-actions"><button class="btn btn-ghost" data-r="no" type="button">Cancel</button>
        <button class="btn ${danger ? 'btn-red' : 'btn-blue'}" data-r="yes" type="button">${esc(okLabel)}</button></div>`,
      onMount(el) {
        el.querySelector('[data-r="yes"]').addEventListener('click', () => { done(true); closeModal('yes'); });
        el.querySelector('[data-r="no"]').addEventListener('click', () => { done(false); closeModal('no'); });
      },
      onClose() { done(false); },
    });
  });
}
