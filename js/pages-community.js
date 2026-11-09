// Community: urgent blood requests and medical fundraisers. Donors pay families directly by UPI.
import { load, save } from './store.js';
import { esc, toast, openModal, closeModal, inr, uid, $ } from './ui.js';
import { icon } from './icons.js';
import { BLOOD_REQUESTS, FUNDRAISERS, BLOOD_GROUPS } from './data.js';
import { emit, on, getProfile } from './core.js';

const getMine = () => load('fundraisers', []);
const saveMine = (l) => { save('fundraisers', l); emit('fundraisers'); };
const getDonations = () => load('donorReplies', []);
const UPI_RE = /^[a-zA-Z0-9._-]{2,}@[a-zA-Z][a-zA-Z0-9]{1,}$/;

export function renderCommunity(root) {
  const cleanups = [];

  root.innerHTML = `
  <section class="page">
    <p class="eyebrow">Community</p>
    <h1 class="page-h">People helping people, in the Golden Hour and after.</h1>

    <div class="card">
      <div class="card-h"><h2>${icon('drop')} Urgent blood requests</h2><span class="tag">Sample requests</span></div>
      <p class="card-p">If your blood group matches, tell the hospital desk you can donate.</p>
      <ul class="list" id="bloodList"></ul>
    </div>

    <div class="fund-grid">
      <div class="stack" id="fundCol">
        <div class="card-h" style="margin-bottom:0"><h2>${icon('heart')} Medical fundraisers</h2></div>
        <div id="fundList" class="stack"></div>
        <p class="fine">Pledges open your UPI app and pay the family directly. PulseSync never holds money, and cannot verify a campaign. Only give to people you know or can check with the hospital.</p>
      </div>

      <div class="card">
        <div class="card-h"><h2>Start a fundraiser</h2></div>
        <form id="fundForm" class="fb-form" novalidate>
          <div class="field"><label for="fTitle">Title</label><input class="input" id="fTitle" maxlength="80" placeholder="e.g. Surgery for my mother" required></div>
          <div class="field"><label for="fStory">Story</label><textarea class="textarea" id="fStory" rows="3" maxlength="400" placeholder="What happened, and what the money is for."></textarea></div>
          <div class="field"><label for="fGoal">Goal (₹)</label><input class="input" id="fGoal" type="number" min="1000" inputmode="numeric" placeholder="e.g. 100000" required></div>
          <div class="field"><label for="fUpi">Your UPI ID</label><input class="input" id="fUpi" placeholder="name@bank" autocomplete="off" required></div>
          <p class="fine" id="fErr" role="alert" style="color:#ff9aa9" hidden></p>
          <button class="btn btn-red" type="submit">Create fundraiser</button>
        </form>
      </div>
    </div>
  </section>`;

  // ---- Blood requests ----
  function renderBlood() {
    const mine = getProfile().blood;
    const replied = new Set(getDonations());
    $('#bloodList', root).innerHTML = BLOOD_REQUESTS.map((r) => {
      const match = mine && mine === r.group;
      const done = replied.has(r.id);
      return `<li class="item" data-id="${esc(r.id)}">
        <span class="av" style="background:rgba(255,59,87,.2);color:#ff9aa9" aria-hidden="true">${esc(r.group)}</span>
        <div class="meta"><b>${esc(r.group)} · ${r.units} unit${r.units > 1 ? 's' : ''} needed</b><small>${esc(r.hospital)} · ${esc(r.ago)}${match ? ' · matches your blood group' : ''}</small></div>
        <button class="btn btn-sm ${done ? 'btn-ghost' : 'btn-red'}" type="button" data-donate ${done ? 'disabled' : ''}>${done ? 'Response sent' : 'I can donate'}</button>
      </li>`;
    }).join('');
  }
  $('#bloodList', root).addEventListener('click', (e) => {
    const li = e.target.closest('[data-id]');
    if (!li || !e.target.closest('[data-donate]')) return;
    const r = BLOOD_REQUESTS.find((x) => x.id === li.dataset.id);
    const list = getDonations(); list.push(r.id); save('donorReplies', list); emit('fundraisers');
    toast(`Thank you. In the full product, ${r.hospital} would call you.`, 4500);
  });

  // ---- Fundraisers ----
  const all = () => [...getMine(), ...FUNDRAISERS];
  function renderFunds() {
    $('#fundList', root).innerHTML = all().map((f) => {
      const pct = Math.min(100, Math.round((f.raised / f.goal) * 100));
      return `<article class="fund" data-id="${esc(f.id)}">
        <div style="display:flex;gap:10px;justify-content:space-between;align-items:flex-start"><h3>${esc(f.title)}</h3>${f.sample ? '<span class="sample-tag">Sample</span>' : ''}</div>
        ${f.story ? `<p class="muted" style="font-size:14px">${esc(f.story)}</p>` : ''}
        <div class="bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div>
        <div class="nums"><span><b>${inr(f.raised)}</b> raised of ${inr(f.goal)}</span><span>${pct}%</span></div>
        <div class="fund-actions">
          <button class="btn btn-red btn-sm" type="button" data-pledge>${icon('heart', 15)} Pledge</button>
          <button class="btn btn-ghost btn-sm" type="button" data-share>${icon('send', 15)} Share</button>
          ${f.mine ? `<button class="btn btn-ghost btn-sm" type="button" data-update>Update raised</button><button class="icon-btn" type="button" data-del aria-label="Delete ${esc(f.title)}">${icon('trash')}</button>` : ''}
        </div>
      </article>`;
    }).join('');
  }

  $('#fundList', root).addEventListener('click', (e) => {
    const card = e.target.closest('[data-id]');
    if (!card) return;
    const f = all().find((x) => x.id === card.dataset.id);
    if (!f) return;
    if (e.target.closest('[data-pledge]')) pledge(f);
    else if (e.target.closest('[data-share]')) share(f);
    else if (e.target.closest('[data-update]')) updateRaised(f);
    else if (e.target.closest('[data-del]')) { saveMine(getMine().filter((x) => x.id !== f.id)); toast('Fundraiser deleted'); }
  });

  function pledge(f) {
    if (!f.upi) {
      openModal({ title: 'Sample campaign', html: '<p class="muted">This is a sample fundraiser for the prototype, so no payment can be made. Create your own fundraiser on the right to see the UPI flow.</p><div class="modal-actions"><button class="btn btn-blue" data-a="ok" type="button">OK</button></div>', onMount(el) { el.querySelector('[data-a="ok"]').addEventListener('click', () => closeModal('ok')); } });
      return;
    }
    openModal({
      title: `Pledge to “${f.title}”`,
      html: `
        <div class="field"><label for="pAmt">Amount (₹)</label><input class="input" id="pAmt" type="number" min="1" inputmode="numeric" value="500"></div>
        <div class="chips" style="margin-top:10px">${[200, 500, 1000, 2000].map((n) => `<button class="chip" type="button" data-amt="${n}">${inr(n)}</button>`).join('')}</div>
        <p class="fine" style="margin-top:12px">You'll pay <b>${esc(f.upi)}</b> directly in your UPI app. PulseSync does not hold or track the money.</p>
        <p class="fine" id="pErr" style="color:#ff9aa9" hidden></p>
        <div class="modal-actions"><button class="btn btn-ghost" data-a="no" type="button">Cancel</button><a class="btn btn-red" id="pPay" href="#">Open UPI app</a></div>`,
      onMount(el) {
        const amt = el.querySelector('#pAmt');
        const pay = el.querySelector('#pPay');
        el.querySelectorAll('[data-amt]').forEach((b) => b.addEventListener('click', () => { amt.value = b.dataset.amt; }));
        el.querySelector('[data-a="no"]').addEventListener('click', () => closeModal('no'));
        pay.addEventListener('click', (ev) => {
          const n = Number(amt.value);
          if (!(n >= 1)) { ev.preventDefault(); const er = el.querySelector('#pErr'); er.textContent = 'Enter an amount of at least ₹1.'; er.hidden = false; return; }
          pay.href = `upi://pay?pa=${encodeURIComponent(f.upi)}&pn=${encodeURIComponent(f.title.slice(0, 40))}&am=${n}&cu=INR&tn=${encodeURIComponent('PulseSync fundraiser')}`;
        });
      },
    });
  }

  async function share(f) {
    const text = `Please help: ${f.title}. ${f.story || ''} Goal ${inr(f.goal)}. Shared from PulseSync AI.`.trim();
    if (navigator.share) { try { await navigator.share({ title: f.title, text, url: location.origin }); return; } catch (err) { if (err && err.name === 'AbortError') return; } }
    try { await navigator.clipboard.writeText(`${text} ${location.origin}`); toast('Fundraiser link copied'); } catch { toast('Could not copy'); }
  }

  function updateRaised(f) {
    openModal({
      title: 'Update amount raised',
      html: `<div class="field"><label for="uAmt">Total received so far (₹)</label><input class="input" id="uAmt" type="number" min="0" inputmode="numeric" value="${f.raised}"></div>
        <div class="modal-actions"><button class="btn btn-ghost" data-a="no" type="button">Cancel</button><button class="btn btn-blue" data-a="yes" type="button">Save</button></div>`,
      onMount(el) {
        el.querySelector('[data-a="no"]').addEventListener('click', () => closeModal('no'));
        el.querySelector('[data-a="yes"]').addEventListener('click', () => {
          const n = Math.max(0, Number(el.querySelector('#uAmt').value) || 0);
          saveMine(getMine().map((x) => (x.id === f.id ? { ...x, raised: n } : x)));
          closeModal('saved');
        });
      },
    });
  }

  $('#fundForm', root).addEventListener('submit', (e) => {
    e.preventDefault();
    const err = $('#fErr', root);
    const title = $('#fTitle', root).value.trim();
    const goal = Number($('#fGoal', root).value);
    const upi = $('#fUpi', root).value.trim();
    const bad = !title ? 'Add a title.' : !(goal >= 1000) ? 'Enter a goal of at least ₹1,000.' : !UPI_RE.test(upi) ? 'Enter a valid UPI ID, like name@bank.' : '';
    if (bad) { err.textContent = bad; err.hidden = false; return; }
    err.hidden = true;
    const list = getMine();
    list.unshift({ id: uid(), mine: true, title, story: $('#fStory', root).value.trim(), goal, raised: 0, upi, created: Date.now() });
    saveMine(list);
    e.target.reset();
    toast('Fundraiser created');
  });

  renderBlood(); renderFunds();
  cleanups.push(on('fundraisers', () => { renderBlood(); renderFunds(); }));
  return () => cleanups.forEach((fn) => { try { fn(); } catch { /* noop */ } });
}
