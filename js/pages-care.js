// Care at Home: browse sample doctors, nurses and paramedics and request a booking.
import { load, save } from './store.js';
import { esc, toast, openModal, closeModal, inr, uid, $, $$ } from './ui.js';
import { icon } from './icons.js';
import { PROVIDERS } from './data.js';
import { emit, on } from './core.js';

const SLOTS = ['Morning (9 am – 12 pm)', 'Afternoon (12 – 4 pm)', 'Evening (4 – 8 pm)', 'Night (8 pm onwards)'];
const getBookings = () => load('bookings', []);
const saveBookings = (b) => { save('bookings', b); emit('bookings'); };

function nextDays(n = 4) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(); d.setDate(d.getDate() + i);
    out.push({ value: d.toLocaleDateString('en-CA'), label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }) });
  }
  return out;
}

export function renderCare(root) {
  const cleanups = [];
  let tab = 'Doctors';

  root.innerHTML = `
  <section class="page">
    <p class="eyebrow">Care at home</p>
    <h1 class="page-h">Hire doctors, nurses &amp; paramedics nearby.</h1>
    <div><div class="seg" role="tablist" aria-label="Type of care" id="seg">
      ${Object.keys(PROVIDERS).map((k) => `<button type="button" role="tab" aria-selected="${k === tab}" data-tab="${k}">${k}</button>`).join('')}
    </div></div>
    <div class="prov-grid" id="provGrid"></div>
    <p class="fine">These professionals are sample profiles for the prototype. Verified practitioner onboarding is on the roadmap, and a booking here is only a request.</p>
    <div class="card">
      <div class="card-h"><h2>${icon('clock')} My bookings</h2></div>
      <ul class="list" id="bookList"></ul>
    </div>
  </section>`;

  function renderGrid() {
    $('#provGrid', root).innerHTML = PROVIDERS[tab].map((p) => `
      <article class="prov">
        <div class="prov-top">
          <span class="av" aria-hidden="true">${esc(p.initial)}</span>
          <div><b>${esc(p.name)}</b><small>${esc(p.role)}</small></div>
          <span class="rate" aria-label="Rated ${p.rating} out of 5">${icon('star')} ${p.rating}</span>
        </div>
        <div class="prov-meta"><span>${icon('pin')} ${p.km} km</span><span>${icon('chat')} ${esc(p.langs)}</span></div>
        <div class="prov-foot"><span class="price">${inr(p.price)} <small class="muted">/ ${esc(p.unit)}</small></span>
          <button class="btn btn-blue btn-sm" type="button" data-book="${esc(p.id)}">Book</button></div>
      </article>`).join('');
  }
  $('#seg', root).addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    tab = b.dataset.tab;
    $$('[data-tab]', root).forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    renderGrid();
  });
  $('#provGrid', root).addEventListener('click', (e) => {
    const b = e.target.closest('[data-book]');
    if (!b) return;
    const p = Object.values(PROVIDERS).flat().find((x) => x.id === b.dataset.book);
    if (p) openBooking(p);
  });

  function openBooking(p) {
    const days = nextDays();
    openModal({
      title: `Book ${p.name}`,
      html: `
        <p class="muted" style="margin-bottom:14px">${esc(p.role)} · ${inr(p.price)} per ${esc(p.unit)}</p>
        <div class="fgrid">
          <div class="field"><label for="bDay">Day</label><select class="select" id="bDay">${days.map((d) => `<option value="${d.value}">${esc(d.label)}</option>`).join('')}</select></div>
          <div class="field"><label for="bSlot">Time</label><select class="select" id="bSlot">${SLOTS.map((s) => `<option>${esc(s)}</option>`).join('')}</select></div>
          <div class="field wide"><label for="bNote">Address or notes</label><textarea class="textarea" id="bNote" rows="2" placeholder="e.g. Flat 4B, Civil Lines. Elderly patient, needs BP check."></textarea></div>
        </div>
        <p class="fine" style="margin-top:10px">Prototype: this sends a booking request to your list. The professional is a sample profile.</p>
        <div class="modal-actions"><button class="btn btn-ghost" data-a="no" type="button">Cancel</button><button class="btn btn-red" data-a="yes" type="button">Request booking</button></div>`,
      onMount(el) {
        el.querySelector('[data-a="no"]').addEventListener('click', () => closeModal('no'));
        el.querySelector('[data-a="yes"]').addEventListener('click', () => {
          const dayEl = el.querySelector('#bDay');
          const list = getBookings();
          list.unshift({
            id: uid(), pid: p.id, name: p.name, role: p.role, price: p.price, unit: p.unit,
            day: dayEl.options[dayEl.selectedIndex].text, slot: el.querySelector('#bSlot').value,
            note: el.querySelector('#bNote').value.trim(), created: Date.now(),
          });
          saveBookings(list);
          closeModal('booked');
          toast(`Booking requested with ${p.name}`);
        });
      },
    });
  }

  function renderBookings() {
    const list = getBookings();
    $('#bookList', root).innerHTML = list.length ? list.map((b) => `
      <li class="item" data-id="${esc(b.id)}">
        <span class="av" aria-hidden="true">${esc(b.name.replace(/^(Dr\.|Nurse)\s*/, '').charAt(0))}</span>
        <div class="meta"><b>${esc(b.name)}</b><small>${esc(b.day)} · ${esc(b.slot)} · ${inr(b.price)} / ${esc(b.unit)}${b.note ? ' · ' + esc(b.note) : ''}</small></div>
        <span class="badge-s b-info">Requested</span>
        <button class="icon-btn" type="button" data-cancel aria-label="Cancel booking with ${esc(b.name)}">${icon('x')}</button>
      </li>`).join('') : '<li class="empty">No bookings yet.</li>';
  }
  $('#bookList', root).addEventListener('click', (e) => {
    const li = e.target.closest('[data-id]');
    if (li && e.target.closest('[data-cancel]')) { saveBookings(getBookings().filter((b) => b.id !== li.dataset.id)); toast('Booking cancelled'); }
  });

  renderGrid();
  renderBookings();
  cleanups.push(on('bookings', renderBookings));
  return () => cleanups.forEach((fn) => { try { fn(); } catch { /* noop */ } });
}
