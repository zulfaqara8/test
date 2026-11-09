// Medical card and cashless-approval dialogs shared by the Emergency and Health ID pages.
import { getProfile, medicalCardText, waHref, telHref, state } from './core.js';
import { openModal, closeModal, esc, toast } from './ui.js';
import { icon } from './icons.js';
import { HOSPITALS } from './data.js';

async function shareOrCopy({ title, text, onShared }) {
  if (navigator.share) {
    try { await navigator.share({ title, text }); onShared && onShared(); return; } catch (e) { if (e && e.name === 'AbortError') return; }
  }
  window.open(waHref('', text), '_blank', 'noopener');
}

async function copy(text, okMsg) {
  try { await navigator.clipboard.writeText(text); toast(okMsg); } catch { toast('Could not copy. Select the text and copy it by hand.'); }
}

export function openCardModal() {
  const text = medicalCardText();
  openModal({
    title: 'Send medical card to a hospital',
    html: `
      <div class="field"><label for="hSel">Hospital</label>
        <select class="select" id="hSel">${HOSPITALS.map((h) => `<option>${esc(h.name)}</option>`).join('')}</select></div>
      <pre class="card-pre" style="margin-top:12px">${esc(text)}</pre>
      <p class="fine">Your card is only shared when you tap a button below. Hospital desks are samples in this prototype, so the card goes through your phone's share menu or WhatsApp.</p>
      <div class="modal-actions"><button class="btn btn-ghost" data-a="copy" type="button">${icon('copy', 16)} Copy</button>
      <button class="btn btn-blue" data-a="share" type="button">${icon('send', 16)} Share</button></div>`,
    onMount(el) {
      const msg = () => `${text}\n\nSent to: ${el.querySelector('#hSel').value}`;
      el.querySelector('[data-a="copy"]').addEventListener('click', () => copy(msg(), 'Medical card copied'));
      el.querySelector('[data-a="share"]').addEventListener('click', () => shareOrCopy({ title: 'Emergency medical card', text: msg(), onShared: () => closeModal('shared') }));
    },
  });
}

export function openCashlessModal() {
  const p = getProfile();
  const net = HOSPITALS.filter((h) => h.cashless);
  const defaultReason = state.sos ? [state.sos.reasonLabel, state.sos.details].filter(Boolean).join(': ') : '';
  openModal({
    title: 'Request cashless approval',
    html: `
      <p class="muted" style="margin-bottom:14px">This prepares the pre-authorisation request so the hospital desk and your insurer can start while you travel. It is not sent automatically.</p>
      <div class="field"><label for="cHosp">Network hospital</label>
        <select class="select" id="cHosp">${net.map((h) => `<option>${esc(h.name)}</option>`).join('')}</select></div>
      <div class="field" style="margin-top:12px"><label for="cWhy">What is the treatment for?</label>
        <textarea class="textarea" id="cWhy" rows="2" placeholder="e.g. Suspected heart attack, admission to cardiac ICU">${esc(defaultReason)}</textarea></div>
      ${!p.policy ? '<p class="fine" style="margin-top:10px;color:var(--amber)">Add your policy number on the Health ID page so the request is complete.</p>' : ''}
      <div class="modal-actions">
        ${p.helpline ? `<a class="btn btn-ghost" href="${esc(telHref(p.helpline))}">${icon('phone', 16)} Call insurer</a>` : ''}
        <button class="btn btn-ghost" data-a="copy" type="button">${icon('copy', 16)} Copy</button>
        <button class="btn btn-blue" data-a="share" type="button">${icon('send', 16)} Share</button>
      </div>`,
    onMount(el) {
      const msg = () => [
        'Cashless hospitalisation request (PulseSync AI)',
        `Patient: ${p.name || '—'}${p.age ? `, ${p.age} yrs` : ''}`,
        p.insurer ? `Insurer: ${p.insurer}` : null,
        p.policy ? `Policy number: ${p.policy}` : null,
        p.abha ? `ABHA: ${p.abha}` : null,
        p.echs ? `ECHS: ${p.echs}` : null,
        `Hospital: ${el.querySelector('#cHosp').value}`,
        `Treatment: ${el.querySelector('#cWhy').value.trim() || 'Emergency admission'}`,
        'Please confirm pre-authorisation. A doctor will confirm the diagnosis.',
      ].filter(Boolean).join('\n');
      el.querySelector('[data-a="copy"]').addEventListener('click', () => copy(msg(), 'Request copied'));
      el.querySelector('[data-a="share"]').addEventListener('click', () => shareOrCopy({ title: 'Cashless request', text: msg(), onShared: () => closeModal('shared') }));
    },
  });
}
