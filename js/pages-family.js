// Family & Meds: closest family, family wellbeing check-in, medicine alarms and alert settings.
import {
  on, getContacts, saveContacts, telHref, validPhone, getAlarmPrefs, setAlarmPref, firstName,
} from './core.js';
import { esc, toast, $, $$, uid } from './ui.js';
import { icon } from './icons.js';
import Alarm from './alarm.js';
import { testFamilyAlert } from './sos.js';
import {
  getMeds, addMed, removeMed, toggleMed, markTaken, undoTaken, medStatus, testAlarm,
  EVERY_OPTIONS, getWellbeing, startWellbeing, imOk, stopWellbeing, everyLabel,
} from './services.js';

const pad = (n) => String(n).padStart(2, '0');
function clock(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  return `${h ? h + ':' : ''}${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

function alarmSettingsHTML(kind, title, testLabel) {
  const prefs = getAlarmPrefs()[kind];
  return `
    <div class="alarm-set" data-kind="${kind}">
      <div class="t">${icon('bell')} ${esc(title)}</div>
      <div class="field"><label for="tone-${kind}">Alarm tone</label>
        <select class="select" id="tone-${kind}" data-pref="tone">
          ${Object.entries(Alarm.TONES).map(([k, v]) => `<option value="${k}"${prefs.tone === k ? ' selected' : ''}>${esc(v.label)}</option>`).join('')}
        </select></div>
      <div class="field"><label for="dur-${kind}">Rings for</label>
        <select class="select" id="dur-${kind}" data-pref="duration">
          ${Alarm.DURATIONS.map((d) => `<option value="${d.sec}"${Number(prefs.duration) === d.sec ? ' selected' : ''}>${esc(d.label)}</option>`).join('')}
        </select></div>
      <button class="btn btn-ghost" type="button" data-test="${kind}">${icon('speaker', 16)} ${esc(testLabel)}</button>
    </div>`;
}

export function renderFamily(root) {
  const cleanups = [];

  root.innerHTML = `
  <section class="page">
    <p class="eyebrow">Family &amp; Meds</p>
    <h1 class="page-h">Keep your loved ones close and safe.</h1>

    <div class="two">
      <div class="card" id="famCard">
        <div class="card-h"><h2>${icon('heart')} Closest family</h2></div>
        <p class="card-p">The starred contact gets your SOS first, with your live location and medical card.</p>
        <ul class="list" id="contactList"></ul>
        <form class="add-row" id="contactForm" novalidate>
          <div class="field"><label for="cName">Name</label><input class="input" id="cName" placeholder="Name" autocomplete="off" required></div>
          <div class="field"><label for="cRel">Relation</label><input class="input" id="cRel" placeholder="e.g. Son" autocomplete="off"></div>
          <div class="field"><label for="cPhone">Phone</label><input class="input" id="cPhone" type="tel" inputmode="tel" placeholder="e.g. 98765 43210" autocomplete="off" required></div>
          <button class="btn btn-blue" type="submit">${icon('userplus', 16)} Add</button>
        </form>
        <p class="fine" id="contactErr" role="alert" style="color:#ff9aa9;margin-top:8px" hidden></p>
      </div>

      <div class="card" id="wbCard">
        <div class="card-h"><h2>${icon('shieldcheck')} Family wellbeing check-in</h2></div>
        <p class="card-p">Someone home alone? They tap “I'm OK” before the timer ends. If they miss it, you're alerted with a loud alarm.</p>
        <div id="wbBody"></div>
        ${alarmSettingsHTML('wellbeing', 'Missed check-in alarm', 'Test alarm')}
      </div>
    </div>

    <div class="card" id="medCard">
      <div class="card-h"><h2>${icon('bell')} Medicine alarms</h2></div>
      <p class="card-p">An alarm rings when it's time and repeats until you mark the medicine as taken. Keep this tab open on the phone of the person taking them.</p>
      <ul class="list" id="medList"></ul>
      <form class="add-row med" id="medForm" novalidate>
        <div class="field"><label for="mName">Medicine name</label><input class="input" id="mName" placeholder="Medicine name" autocomplete="off" required></div>
        <div class="field"><label for="mDose">Dose</label><input class="input" id="mDose" placeholder="e.g. 1 tablet" autocomplete="off"></div>
        <div class="field"><label for="mTime">Time</label><input class="input" id="mTime" type="time" value="08:00" required></div>
        <button class="btn btn-blue" type="submit">${icon('plus', 16)} Add alarm</button>
      </form>
      <p class="fine" id="medErr" role="alert" style="color:#ff9aa9;margin-top:8px" hidden></p>
      ${alarmSettingsHTML('medicine', 'Medicine alarm tone and length', 'Test sound')}
    </div>

    <div class="card" id="alertCard">
      <div class="card-h"><h2>${icon('speaker')} Alert settings on this device</h2></div>
      <div class="alert-grid" id="alertStatus"></div>
      <div class="chips">
        <button class="btn btn-blue btn-sm" type="button" id="enableAlerts">${icon('bell', 15)} Turn on sound &amp; notifications</button>
        <button class="btn btn-ghost btn-sm" type="button" id="testSos">${icon('siren', 15)} Hear a family SOS alert</button>
      </div>
      <div class="help-box" role="note">
        <b>About Do Not Disturb.</b> A website cannot switch off Do Not Disturb or the silent switch, so for emergencies set it up on the phone:
        <ul>
          <li>Install PulseSync to your home screen, then allow it under your phone's Do Not Disturb exceptions (priority apps or alarms).</li>
          <li>Keep the media and alarm volume up, and keep this tab or the installed app open.</li>
          <li>SOS alerts always show a full-screen alert and ring at the loudest level the device allows. A native Android and iOS app that can bypass Do Not Disturb is the next step.</li>
        </ul>
      </div>
    </div>
  </section>`;

  // ---------------- Closest family ----------------
  const list = $('#contactList', root);
  function renderContacts() {
    const items = getContacts();
    list.innerHTML = items.length ? items.map((c) => `
      <li class="item" data-id="${esc(c.id)}">
        <span class="av" aria-hidden="true">${esc((c.name || '?').trim().charAt(0).toUpperCase())}</span>
        <div class="meta"><b>${esc(c.name)}${c.relation ? ` · ${esc(c.relation)}` : ''}</b><small>${esc(c.phone)}${c.primary ? ' · gets SOS first' : ''}</small></div>
        <button class="icon-btn ${c.primary ? 'on' : ''}" type="button" data-star aria-label="${c.primary ? 'Closest contact' : 'Make ' + esc(c.name) + ' the closest contact'}" aria-pressed="${!!c.primary}">${icon('star')}</button>
        <a class="icon-btn call" href="${esc(telHref(c.phone))}" aria-label="Call ${esc(c.name)}">${icon('phone')}</a>
        <button class="icon-btn" type="button" data-del aria-label="Remove ${esc(c.name)}">${icon('trash')}</button>
      </li>`).join('') : '<li class="empty">No contacts yet. Add the first person who should hear about an emergency.</li>';
  }
  list.addEventListener('click', (e) => {
    const li = e.target.closest('[data-id]');
    if (!li) return;
    const id = li.dataset.id;
    if (e.target.closest('[data-star]')) {
      saveContacts(getContacts().map((c) => ({ ...c, primary: c.id === id })));
      toast('Closest contact updated');
    } else if (e.target.closest('[data-del]')) {
      let next = getContacts().filter((c) => c.id !== id);
      if (next.length && !next.some((c) => c.primary)) next = next.map((c, i) => ({ ...c, primary: i === 0 }));
      saveContacts(next);
    }
  });
  $('#contactForm', root).addEventListener('submit', (e) => {
    e.preventDefault();
    const err = $('#contactErr', root);
    const name = $('#cName', root).value.trim();
    const phone = $('#cPhone', root).value.trim();
    if (!name) { err.textContent = 'Enter a name.'; err.hidden = false; $('#cName', root).focus(); return; }
    if (!validPhone(phone)) { err.textContent = 'Enter a valid phone number (at least 7 digits).'; err.hidden = false; $('#cPhone', root).focus(); return; }
    err.hidden = true;
    const items = getContacts();
    items.push({ id: uid(), name, relation: $('#cRel', root).value.trim(), phone, primary: items.length === 0 });
    saveContacts(items);
    e.target.reset();
    $('#cName', root).focus();
    toast(`${name} added`);
  });
  renderContacts();
  cleanups.push(on('contacts', renderContacts));

  // ---------------- Wellbeing ----------------
  const wbBody = $('#wbBody', root);
  function renderWellbeing() {
    const w = getWellbeing();
    if (!w) {
      wbBody.innerHTML = `
        <form class="add-row" id="wbForm" style="margin-top:0">
          <div class="field" style="grid-column: span 2"><label for="wbWho">Who is at home?</label><input class="input" id="wbWho" placeholder="e.g. Dadi" autocomplete="off"></div>
          <div class="field"><label for="wbEvery">Check in every</label>
            <select class="select" id="wbEvery">${EVERY_OPTIONS.map((o) => `<option value="${o.min}"${o.min === 60 ? ' selected' : ''}>${esc(o.label)}</option>`).join('')}</select></div>
          <button class="btn btn-blue" type="submit">Start</button>
        </form>`;
      $('#wbForm', root).addEventListener('submit', async (e) => {
        e.preventDefault();
        await Alarm.enable(); // lets the alarm ring later and asks for notification permission
        const who = $('#wbWho', root).value.trim();
        startWellbeing({ who, everyMin: Number($('#wbEvery', root).value) });
        toast(`Check-in started${who ? ` for ${who}` : ''}`);
      });
    } else {
      const missed = w.status === 'missed';
      wbBody.innerHTML = `
        <div class="wb-box ${missed ? 'missed' : ''}">
          <div><small class="muted">${missed ? 'Check-in missed' : 'Next check-in due in'}</small>
            <div class="wb-clock" id="wbClock">${missed ? 'Missed' : clock(w.endsAt - Date.now())}</div>
            <small class="muted">${esc(w.who || 'Family member')} · every ${esc(everyLabel(w.everyMin))}</small></div>
          <div class="wb-row">
            <button class="btn btn-blue" type="button" id="wbOk">${icon('check', 16)} I'm OK</button>
            <button class="btn btn-ghost" type="button" id="wbStop">Stop check-in</button>
          </div>
        </div>`;
      $('#wbOk', root).addEventListener('click', () => imOk());
      $('#wbStop', root).addEventListener('click', () => { stopWellbeing(); toast('Check-in stopped'); });
    }
  }
  renderWellbeing();
  cleanups.push(on('wellbeing', renderWellbeing));
  cleanups.push(on('tick', () => {
    const w = getWellbeing();
    const el = $('#wbClock', root);
    if (w && el && w.status === 'running' && w.endsAt) el.textContent = clock(w.endsAt - Date.now());
  }));

  // ---------------- Medicine alarms ----------------
  const medList = $('#medList', root);
  const STATUS = {
    taken: ['b-ok', 'Taken today'], due: ['b-due', 'Due now'], snoozed: ['b-warn', 'Snoozed'],
    missed: ['b-warn', 'Missed'], upcoming: ['b-info', 'Upcoming'],
  };
  function renderMeds() {
    const meds = getMeds();
    medList.innerHTML = meds.length ? meds.map((m) => {
      const st = medStatus(m);
      const [cls, label] = STATUS[st];
      return `<li class="item" data-id="${esc(m.id)}">
        <span class="av" aria-hidden="true">${icon('clock', 18)}</span>
        <div class="meta"><b>${esc(m.name)}${m.dose ? ` · ${esc(m.dose)}` : ''}</b><small>${esc(m.time)} daily · <span class="badge-s ${cls}">${label}</span>${m.on ? '' : ' · alarm off'}</small></div>
        <button class="btn btn-sm ${st === 'taken' ? 'btn-ghost' : 'btn-blue'}" type="button" data-taken>${st === 'taken' ? 'Undo' : `${'Taken'}`}</button>
        <button class="icon-btn ${m.on ? 'on' : ''}" type="button" data-toggle aria-pressed="${m.on}" aria-label="${m.on ? 'Turn alarm off' : 'Turn alarm on'} for ${esc(m.name)}">${icon('bell')}</button>
        <button class="icon-btn" type="button" data-del aria-label="Remove ${esc(m.name)}">${icon('trash')}</button>
      </li>`;
    }).join('') : '<li class="empty">No medicines yet — add the first one below.</li>';
  }
  medList.addEventListener('click', (e) => {
    const li = e.target.closest('[data-id]');
    if (!li) return;
    const id = li.dataset.id;
    const m = getMeds().find((x) => x.id === id);
    if (!m) return;
    if (e.target.closest('[data-taken]')) (medStatus(m) === 'taken' ? undoTaken : markTaken)(id);
    else if (e.target.closest('[data-toggle]')) toggleMed(id);
    else if (e.target.closest('[data-del]')) removeMed(id);
  });
  $('#medForm', root).addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#medErr', root);
    const name = $('#mName', root).value.trim();
    const time = $('#mTime', root).value;
    if (!name) { err.textContent = 'Enter the medicine name.'; err.hidden = false; $('#mName', root).focus(); return; }
    if (!time) { err.textContent = 'Choose the time for the alarm.'; err.hidden = false; $('#mTime', root).focus(); return; }
    err.hidden = true;
    await Alarm.enable(); // unlock audio on this tap so the alarm can ring later
    addMed({ name, dose: $('#mDose', root).value.trim(), time });
    $('#mName', root).value = ''; $('#mDose', root).value = '';
    $('#mName', root).focus();
    toast(`Alarm set for ${name} at ${time}`);
  });
  renderMeds();
  cleanups.push(on('meds', renderMeds));
  let lastMinute = -1;
  cleanups.push(on('tick', () => { const m = new Date().getMinutes(); if (m !== lastMinute) { lastMinute = m; renderMeds(); } }));

  // ---------------- Tone and duration settings (medicine + wellbeing) ----------------
  $$('.alarm-set', root).forEach((box) => {
    const kind = box.dataset.kind;
    box.addEventListener('change', (e) => {
      const k = e.target.dataset.pref;
      if (!k) return;
      const val = k === 'duration' ? Number(e.target.value) : e.target.value;
      setAlarmPref(kind, { [k]: val });
      if (k === 'tone') Alarm.preview(val, 3);
      else toast(`${kind === 'medicine' ? 'Medicine' : 'Check-in'} alarm will ring ${Number(val) ? `for ${val} seconds` : 'until you stop it'}.`);
    });
    box.querySelector('[data-test]').addEventListener('click', async () => {
      await Alarm.enable();
      testAlarm(kind);
    });
  });

  // ---------------- Alert settings ----------------
  function renderAlertStatus() {
    const s = Alarm.status();
    const nLabel = { granted: 'On', denied: 'Blocked in browser settings', default: 'Not asked yet', unsupported: 'Not supported here' }[s.notifications] || s.notifications;
    $('#alertStatus', root).innerHTML = `
      <div><small>Alarm sound</small><b>${s.audio ? 'Ready' : 'Tap “Turn on” once'}</b></div>
      <div><small>Notifications</small><b>${esc(nLabel)}</b></div>
      <div><small>Screen stays awake</small><b>${'wakeLock' in navigator ? 'Yes, while an alarm rings' : 'Not supported here'}</b></div>
      <div><small>Vibration</small><b>${navigator.vibrate ? 'Yes, on phones' : 'Not supported here'}</b></div>`;
  }
  renderAlertStatus();
  const onAudio = () => renderAlertStatus();
  document.addEventListener('psa:audio', onAudio);
  cleanups.push(() => document.removeEventListener('psa:audio', onAudio));
  $('#enableAlerts', root).addEventListener('click', async () => {
    const s = await Alarm.enable();
    renderAlertStatus();
    if (s.notifications === 'denied') toast('Notifications are blocked. Allow them in your browser or phone settings.', 5000);
    else toast('Sound is on. Alarms can ring on this device.');
  });
  $('#testSos', root).addEventListener('click', async () => { await Alarm.enable(); testFamilyAlert(); });

  cleanups.push(() => Alarm.stopPreview());
  return () => cleanups.forEach((fn) => { try { fn(); } catch { /* noop */ } });
}
