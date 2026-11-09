// Feedback form. On Netlify it is delivered through Netlify Forms; offline or locally it is kept on this device.
import { load, save } from './store.js';
import { esc, toast, $, $$ } from './ui.js';
import { icon } from './icons.js';
import { FEEDBACK_FEATURES } from './data.js';
import { state } from './core.js';

const ROLES = ['Patient / family member', 'Doctor or nurse', 'Paramedic or ambulance driver', 'Hospital staff', 'Student / judge / other'];

async function deliver(payload) {
  const body = new URLSearchParams({ 'form-name': 'feedback', ...payload }).toString();
  const res = await fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  if (!res.ok) throw new Error('Delivery failed: ' + res.status);
}

export function renderFeedback(root) {
  const picked = new Set();
  root.innerHTML = `
  <section class="page">
    <p class="eyebrow">Feedback</p>
    <h1 class="page-h">Help us make emergencies less scary.</h1>
    <p class="page-sub">Tell us what worked and what didn't. It takes a minute and goes straight to the team.</p>

    <div class="card" id="fbCard">
      <form class="fb-form" id="fbForm" novalidate>
        <div>
          <div class="label" id="featLbl">Which features did you try?</div>
          <div class="chips" style="margin-top:8px" role="group" aria-labelledby="featLbl">
            ${FEEDBACK_FEATURES.map((f) => `<button type="button" class="chip" aria-pressed="false" data-f="${esc(f)}">${esc(f)}</button>`).join('')}
          </div>
        </div>
        <div class="fgrid">
          <div class="field"><label for="fbName">Name</label><input class="input" id="fbName" value="${esc(state.user ? state.user.name : '')}" autocomplete="name"></div>
          <div class="field"><label for="fbEmail">Email (optional)</label><input class="input" id="fbEmail" type="email" value="${esc(state.user ? state.user.email : '')}" autocomplete="email"></div>
          <div class="field wide"><label for="fbRole">I am a…</label>
            <select class="select" id="fbRole">${ROLES.map((r) => `<option>${esc(r)}</option>`).join('')}</select></div>
          <div class="field wide"><label for="fbMsg">Your feedback</label>
            <textarea class="textarea" id="fbMsg" rows="5" maxlength="2000" placeholder="What was confusing, slow or missing? What would you add?"></textarea></div>
        </div>
        <p class="fine" id="fbErr" role="alert" style="color:#ff9aa9" hidden></p>
        <div><button class="btn btn-red" type="submit" id="fbSend">${icon('send', 16)} Send feedback</button></div>
      </form>
    </div>
  </section>`;

  $$('[data-f]', root).forEach((b) => b.addEventListener('click', () => {
    const f = b.dataset.f;
    if (picked.has(f)) picked.delete(f); else picked.add(f);
    b.setAttribute('aria-pressed', String(picked.has(f)));
  }));

  $('#fbForm', root).addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#fbErr', root);
    const message = $('#fbMsg', root).value.trim();
    if (message.length < 5) { err.textContent = 'Write at least a few words so we can act on it.'; err.hidden = false; $('#fbMsg', root).focus(); return; }
    err.hidden = true;
    const payload = {
      features: [...picked].join(', '), name: $('#fbName', root).value.trim(), email: $('#fbEmail', root).value.trim(),
      role: $('#fbRole', root).value, message,
    };
    const btn = $('#fbSend', root);
    btn.disabled = true;
    let sent = true;
    try { await deliver(payload); } catch { sent = false; }
    if (!sent) { const q = load('feedbackQueue', []); q.push({ ...payload, at: Date.now() }); save('feedbackQueue', q); }
    $('#fbCard', root).innerHTML = `
      <div class="empty" style="border-style:solid">
        <h2 style="font-size:22px;margin-bottom:8px">Thank you${payload.name ? ', ' + esc(payload.name.split(' ')[0]) : ''}.</h2>
        <p>${sent ? 'Your feedback reached the team.' : 'You seem to be offline or running locally, so your feedback is saved on this device.'}</p>
      </div>`;
    toast(sent ? 'Feedback sent' : 'Feedback saved on this device');
  });
  return null;
}
