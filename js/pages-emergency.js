// Emergency page: SOS, quick actions, hospital network, first aid, helplines, active SOS panel.
import {
  state, on, bus, nav, getContacts, primaryContact, telHref, smsHref, waHref, requestGPS, hasFix, mapsLink, mapsSearch,
  firstName, medicalCardText, sosMessage, locationText,
} from './core.js';
import { esc, toast, openModal, closeModal, $, $$ } from './ui.js';
import { icon } from './icons.js';
import { HOSPITALS, HELPLINES, SYMPTOM_CHIPS, FIRST_AID } from './data.js';
import { openSosDialog, endSos, sosActions, sosLinks } from './sos.js';
import { openCardModal } from './medcard.js';
import Alarm from './alarm.js';

const pad = (n) => String(n).padStart(2, '0');
const clock = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`; };

export function renderEmergency(root) {
  const cleanups = [];
  let vitalsTimer = null;

  root.innerHTML = `
  <section class="page">
    <p class="eyebrow">Emergency command centre</p>
    <h1 class="page-h">Hi ${esc(firstName())}, help is one tap away.</h1>

    <div id="sosPanel"></div>

    <div class="em-top">
      <div class="card sos-card">
        <div class="sos-left">
          <button type="button" class="sos-btn" id="sosBtn" aria-label="SOS. Opens a confirmation before anything is sent.">SOS</button>
          <p class="sos-cap">Tap to start · GPS + AI triage</p>
        </div>
        <div class="sos-right">
          <label class="label" for="symptoms">What's happening? <span class="muted">(type or speak)</span></label>
          <div class="speak">
            <textarea class="textarea" id="symptoms" rows="3" placeholder="e.g. My father has chest pain and is sweating"></textarea>
            <button type="button" class="mic" id="micBtn" aria-label="Speak your symptoms" aria-pressed="false">${icon('mic', 18)}</button>
          </div>
          <div class="chips">${SYMPTOM_CHIPS.map((c) => `<button type="button" class="chip" data-chip="${esc(c)}">${esc(c)}</button>`).join('')}</div>
          <p class="fine">AI scores severity (Level 1–5) and picks the hospital with the right ICU, ventilator or trauma team.</p>
        </div>
      </div>

      <div class="quick" id="quick">
        <a class="tile t-red" href="tel:108">${icon('ambulance', 22)}<b>Ambulance</b><small>Call 108</small></a>
        <button class="tile t-blue" type="button" data-q="police">${icon('shield', 22)}<b>Police</b><small>Call 100 / 112</small></button>
        <button class="tile t-green" type="button" data-q="wa">${icon('chat', 22)}<b>Alert family</b><small>WhatsApp</small></button>
        <button class="tile t-cyan" type="button" data-q="sms">${icon('send', 22)}<b>SMS family</b><small>All contacts</small></button>
        <button class="tile t-blue" type="button" data-q="card">${icon('card', 22)}<b>Medical card</b><small>Send to hospital</small></button>
        <a class="tile t-blue" href="#" data-q="hospital">${icon('hospital', 22)}<b>Nearest hospital</b><small>Open map</small></a>
        <a class="tile t-red" href="#" data-q="blood">${icon('drop', 22)}<b>Blood bank</b><small>Open map</small></a>
        <button class="tile t-amber" type="button" data-q="gps">${icon('pin', 22)}<b>Share location</b><small>Find GPS</small></button>
      </div>
    </div>

    <div class="em-bottom">
      <div class="card">
        <div class="card-h"><h2>Hospital network</h2><span class="tag">Live capacity · sample data</span></div>
        <div class="table-wrap">
          <table class="tbl" id="hospTbl">
            <thead><tr><th>Hospital</th><th>Distance</th><th>Beds</th><th>ICU</th><th>Vent.</th><th>Accepts</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
      </div>
      <div class="stack">
        <div class="card" id="aidCard">
          <div class="card-h"><h2>First aid while help comes</h2></div>
          <div class="chips" role="tablist" aria-label="First aid topics">${Object.keys(FIRST_AID).map((k, i) => `<button type="button" role="tab" class="chip" aria-pressed="${i === 0}" data-aid="${esc(k)}">${esc(k)}</button>`).join('')}</div>
          <ol class="aid" id="aidSteps"></ol>
          <p class="fine">Basic guidance only. Always call 108 or 112 first.</p>
        </div>
        <div class="card">
          <div class="card-h"><h2>Helplines</h2></div>
          <div class="helplines">${HELPLINES.map((h) => `<a class="helpline" href="tel:${h.num}"><b>${h.num}</b><small>${esc(h.label)}</small></a>`).join('')}</div>
        </div>
      </div>
    </div>
  </section>`;

  const symptoms = $('#symptoms', root);

  // ---- SOS button -----------------------------------------------------------
  $('#sosBtn', root).addEventListener('click', () => openSosDialog({ text: symptoms.value.trim() }));
  $$('[data-chip]', root).forEach((b) => b.addEventListener('click', () => { symptoms.value = b.dataset.chip; symptoms.focus(); }));

  // ---- Voice input ----------------------------------------------------------------
  const mic = $('#micBtn', root);
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null;
  mic.addEventListener('click', () => {
    if (!SR) { toast("Voice input isn't supported in this browser. Please type instead."); return; }
    if (rec) { rec.stop(); return; }
    rec = new SR();
    rec.lang = navigator.language && /^(en|hi)/i.test(navigator.language) ? navigator.language : 'en-IN';
    rec.interimResults = true;
    rec.onresult = (e) => { symptoms.value = [...e.results].map((r) => r[0].transcript).join(' '); };
    rec.onend = () => { rec = null; mic.setAttribute('aria-pressed', 'false'); mic.classList.remove('live'); };
    rec.onerror = (e) => { toast(e.error === 'not-allowed' ? 'Microphone permission is blocked.' : 'Could not hear that. Try again.'); };
    try { rec.start(); mic.setAttribute('aria-pressed', 'true'); mic.classList.add('live'); } catch { rec = null; }
  });
  cleanups.push(() => { try { rec && rec.stop(); } catch { /* noop */ } });

  // ---- Quick actions ------------------------------------------------------------------
  $('#quick', root).addEventListener('click', async (e) => {
    const el = e.target.closest('[data-q]');
    if (!el) return;
    const q = el.dataset.q;
    if (el.tagName === 'A') e.preventDefault();
    const contacts = getContacts();
    const main = primaryContact();

    if (q === 'police') {
      openModal({
        title: 'Call police',
        html: `<div class="call-grid"><a class="btn btn-red btn-lg" href="tel:100">${icon('phone', 18)} Police · 100</a><a class="btn btn-ghost btn-lg" href="tel:112">${icon('phone', 18)} All emergencies · 112</a></div>`,
      });
    } else if (q === 'wa') {
      const body = sosMessage({ reasonText: symptoms.value.trim() });
      window.open(waHref(main ? main.phone : '', body), '_blank', 'noopener');
      if (!hasFix()) toast('GPS is off, so the message has no location. Tap “Share location” first.');
    } else if (q === 'sms') {
      if (!contacts.length) { toast('Add a family contact first.'); nav.go('/dashboard/family'); return; }
      location.href = smsHref(contacts.map((c) => c.phone), sosMessage({ reasonText: symptoms.value.trim() }));
    } else if (q === 'card') {
      openCardModal();
    } else if (q === 'hospital') {
      window.open(mapsSearch('hospital'), '_blank', 'noopener');
    } else if (q === 'blood') {
      window.open(mapsSearch('blood bank'), '_blank', 'noopener');
    } else if (q === 'gps') {
      toast('Finding your location…', 2000);
      const g = await requestGPS();
      if (g.status === 'on') {
        const link = mapsLink();
        if (navigator.share) { try { await navigator.share({ title: 'My live location', text: 'My location (PulseSync AI)', url: link }); return; } catch { /* cancelled */ } }
        try { await navigator.clipboard.writeText(link); toast(`Location locked (±${g.acc} m). Link copied.`); } catch { toast(`Location locked (±${g.acc} m).`); }
      } else if (g.status === 'denied') toast('Location permission is blocked. Allow it in your browser settings.', 5000);
      else toast('Could not get a GPS fix. Try again outdoors.', 4000);
    }
  });

  // ---- Hospital table --------------------------------------------------------------------
  function renderHospitals() {
    const picked = state.sos && state.sos.hospital ? state.sos.hospital.id : null;
    $('#hospTbl tbody', root).innerHTML = HOSPITALS.map((h) => {
      const full = (n) => (n <= 0 ? '<span class="full">FULL</span>' : n);
      return `<tr class="${picked === h.id ? 'picked' : ''}">
        <td><b>${esc(h.name)}</b><small>${esc(h.area)} · ${esc(h.tags.join(' · '))}${picked === h.id ? ' · <span class="dispatch">Dispatching here</span>' : ''}</small></td>
        <td>${h.km} km</td><td>${h.beds}</td><td>${full(h.icu)}</td><td>${full(h.vent)}</td>
        <td>${h.echs ? '<span class="pill">ECHS</span>' : ''}${h.cashless ? '<span class="pill pill-b">Cashless</span>' : ''}</td></tr>`;
    }).join('');
  }
  renderHospitals();

  // ---- First aid --------------------------------------------------------------------------
  const aid = (k) => { $('#aidSteps', root).innerHTML = FIRST_AID[k].map((s) => `<li>${esc(s)}</li>`).join(''); };
  aid(Object.keys(FIRST_AID)[0]);
  $('#aidCard', root).addEventListener('click', (e) => {
    const b = e.target.closest('[data-aid]');
    if (!b) return;
    $$('[data-aid]', root).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    aid(b.dataset.aid);
  });

  // ---- Active SOS panel --------------------------------------------------------------------
  const panel = $('#sosPanel', root);

  function stepRow(done, label, action) {
    return `<li class="${done ? 'done' : ''}"><span class="tick">${done ? icon('check', 14) : ''}</span><span class="st-l">${label}</span>${action || ''}</li>`;
  }

  function renderSosPanel() {
    const s = state.sos;
    renderHospitals();
    if (!s) { panel.innerHTML = ''; stopVitals(); return; }
    const main = primaryContact();
    const acts = sosActions();
    const link = (key) => acts.find((a) => a.key === key);
    const btn = (key, cls = 'btn-ghost') => {
      const a = link(key);
      if (!a) return '';
      return a.hrefFn || a.href
        ? `<a class="btn btn-sm ${cls}" data-sa="${key}" href="${esc(a.hrefFn ? a.hrefFn() : a.href)}"${a.external ? ' target="_blank" rel="noopener"' : ''}>${esc(a.label)}</a>`
        : `<button class="btn btn-sm ${cls}" type="button" data-sa="${key}">${esc(a.label)}</button>`;
    };
    const d = s.done || {};
    const at = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    panel.innerHTML = `
      <div class="sos-active" role="region" aria-label="Active SOS">
        <div class="sa-head">
          <span class="live-dot"></span><b>SOS ACTIVE</b>
          <span class="sa-since" id="saSince"></span>
          <button class="btn btn-sm btn-ghost sa-end" type="button" id="saEnd">${icon('shieldcheck', 16)} I'm safe, end SOS</button>
        </div>
        <div class="sa-body">
          <div class="sa-sev"><span class="lvl">${s.level}</span><div><b>Level ${s.level} · ${esc(s.levelName)}</b><small>${esc(s.label)} · ${esc(s.reasonLabel)}</small></div></div>
          <div class="sa-info">
            <div><small>Ambulance</small><b>${s.ambulance.type} · <span id="saEta"></span></b></div>
            <div><small>Destination</small><b>${esc(s.hospital ? s.hospital.name : '—')}${s.hospital ? ` · ${s.hospital.km} km` : ''}</b></div>
            <div><small>Location</small><b>${s.location ? `GPS locked ±${s.location.acc} m` : (state.gps.status === 'denied' ? 'GPS blocked' : 'Finding GPS…')}</b></div>
          </div>
          <ul class="steps-l">
            ${stepRow(true, `SOS confirmed at ${at(s.startedAt)}`)}
            ${stepRow(true, 'AI triage done (a doctor confirms critical decisions)')}
            ${stepRow(true, 'Ambulance + hospital pre-alert (simulated)')}
            ${stepRow(!!d.call, main ? 'Phone your closest family contact' : 'Add a family contact to call', main ? btn('call', 'btn-red') : btn('add', 'btn-red'))}
            ${main ? stepRow(!!d.wa, 'Tell family on WhatsApp, with live location', btn('wa')) : ''}
            ${main ? stepRow(!!d.sms, 'Text every family contact (works on weak data)', btn('sms')) : ''}
            ${stepRow(!!d['108'], 'Call 108 for a real ambulance', btn('108', 'btn-red'))}
          </ul>
          <div class="vit" id="vitBox"></div>
          <p class="fine">Dispatch and the ER pre-alert are simulated in this prototype. Call 108 for a real ambulance.</p>
        </div>
      </div>`;
    $('#saEnd', root).addEventListener('click', endSos);
    panel.querySelectorAll('[data-sa]').forEach((el) => {
      el.addEventListener('click', (e) => {
        const a = link(el.dataset.sa);
        if (a && a.onClick) a.onClick(e);
        if (a && a.hrefFn && el.tagName === 'A') el.href = a.hrefFn();
      });
    });
    renderVitalsBox();
    tickSos();
  }

  function tickSos() {
    const s = state.sos;
    if (!s) return;
    const since = $('#saSince', root);
    const eta = $('#saEta', root);
    if (since) since.textContent = `${clock(Date.now() - s.startedAt)} since you pressed SOS`;
    if (eta) {
      const left = s.startedAt + s.ambulance.etaMin * 60000 - Date.now();
      eta.textContent = left > 0 ? `arrives in ${clock(left)}` : 'should be with you now';
    }
  }

  // Simulated pulse-oximeter / ECG feed, to show the IoT vitals idea.
  let vit = { on: false, hr: 112, spo2: 93 };
  function renderVitalsBox() {
    const box = $('#vitBox', root);
    if (!box) return;
    if (!vit.on) {
      box.innerHTML = `<button class="btn btn-sm btn-ghost" type="button" id="vitOn">${icon('activity', 16)} Connect pulse oximeter (demo)</button>`;
      $('#vitOn', root).addEventListener('click', startVitals);
    } else {
      box.innerHTML = `<div class="vit-row"><div><small>Heart rate</small><b class="hr"><span id="vHr">${vit.hr}</span> bpm</b></div><div><small>SpO₂</small><b><span id="vSp">${vit.spo2}</span>%</b></div><div class="vit-ecg"><svg viewBox="0 0 400 60" preserveAspectRatio="none" aria-hidden="true"><path d="M0 34h70l10-4 10 4h30l10-26 14 50 12-24h24l8-6 8 6h60l10-26 14 50 12-24h108"/></svg></div></div><p class="fine">Simulated readings streaming to the ER desk.</p>`;
    }
  }
  function startVitals() {
    vit.on = true;
    renderVitalsBox();
    clearInterval(vitalsTimer);
    vitalsTimer = setInterval(() => {
      vit.hr = Math.round(Math.min(125, Math.max(98, vit.hr + (Math.random() * 6 - 3))));
      vit.spo2 = Math.round(Math.min(96, Math.max(91, vit.spo2 + (Math.random() * 2 - 1))));
      const a = $('#vHr', root), b = $('#vSp', root);
      if (a) a.textContent = vit.hr;
      if (b) b.textContent = vit.spo2;
    }, 1500);
  }
  function stopVitals() { clearInterval(vitalsTimer); vitalsTimer = null; vit = { on: false, hr: 112, spo2: 93 }; }
  cleanups.push(() => clearInterval(vitalsTimer));

  renderSosPanel();
  cleanups.push(on('sos', renderSosPanel));
  cleanups.push(on('tick', tickSos));
  cleanups.push(on('gps', () => { if (state.sos) renderSosPanel(); }));
  cleanups.push(on('contacts', () => { if (state.sos) renderSosPanel(); }));

  return () => cleanups.forEach((fn) => { try { fn(); } catch { /* noop */ } });
}
