// My Health ID: medical profile, ABHA / ECHS / insurance IDs and the emergency medical card.
import { getProfile, setProfile, profileCompleteness, firstName } from './core.js';
import { esc, toast, $, $$ } from './ui.js';
import { icon } from './icons.js';
import { BLOOD_GROUPS } from './data.js';
import { openCardModal, openCashlessModal } from './medcard.js';
import { medicalCardText } from './core.js';

const GENDERS = ['Female', 'Male', 'Other', 'Prefer not to say'];

export function renderHealth(root) {
  const p = getProfile();

  const input = (key, label, { type = 'text', ph = '', wide = false, inputmode = '', max = '' } = {}) => `
    <div class="field ${wide ? 'wide' : ''}"><label for="f-${key}">${label}</label>
      <input class="input" id="f-${key}" data-k="${key}" type="${type}" placeholder="${esc(ph)}" value="${esc(p[key] ?? '')}"${inputmode ? ` inputmode="${inputmode}"` : ''}${max ? ` max="${max}" min="0"` : ''} autocomplete="off"></div>`;
  const area = (key, label, ph) => `
    <div class="field wide"><label for="f-${key}">${label}</label>
      <textarea class="textarea" id="f-${key}" data-k="${key}" rows="2" placeholder="${esc(ph)}">${esc(p[key] ?? '')}</textarea></div>`;
  const select = (key, label, opts) => `
    <div class="field"><label for="f-${key}">${label}</label>
      <select class="select" id="f-${key}" data-k="${key}"><option value="">Select</option>${opts.map((o) => `<option${p[key] === o ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select></div>`;

  root.innerHTML = `
  <section class="page">
    <p class="eyebrow">My Health ID</p>
    <h1 class="page-h">Your medical card, ready for any ER.</h1>
    <p class="page-sub">Fill this in once, ${esc(firstName())}. It stays on this device and is only shared when you tap send.</p>

    <div class="health-grid">
      <div class="stack">
        <div class="card">
          <div class="card-h"><h2>${icon('idcard')} Personal</h2><span class="tag" id="saved" aria-live="polite">Saved on this device</span></div>
          <div class="fgrid">
            ${input('name', 'Full name', { ph: 'e.g. Adil Khan' })}
            ${input('age', 'Age', { type: 'number', ph: 'e.g. 34', inputmode: 'numeric', max: 120 })}
            ${select('gender', 'Gender', GENDERS)}
            ${select('blood', 'Blood group', BLOOD_GROUPS)}
          </div>
        </div>

        <div class="card">
          <div class="card-h"><h2>${icon('steth')} Medical history</h2><span class="tag">What doctors must know</span></div>
          <div class="fgrid">
            ${area('conditions', 'Current conditions', 'e.g. Diabetes, high BP')}
            ${area('allergies', 'Allergies', 'e.g. Penicillin')}
            ${area('medicines', 'Regular medicines', 'e.g. Metformin 500 mg, morning')}
            ${area('pastHistory', 'Past medical history', 'e.g. Heart bypass in 2019, asthma as a child')}
            ${area('surgeries', 'Past surgeries / hospital stays', 'e.g. Appendix surgery, 2019')}
          </div>
        </div>

        <div class="card">
          <div class="card-h"><h2>${icon('shieldcheck')} Health IDs &amp; insurance</h2><span class="tag">For faster cashless admission</span></div>
          <div class="fgrid">
            ${input('abha', 'ABHA number', { ph: '14-digit ABHA number', inputmode: 'numeric' })}
            ${input('echs', 'ECHS number', { ph: 'For ex-servicemen and families' })}
            ${input('insurer', 'Insurance company', { ph: 'e.g. Star Health' })}
            ${input('policy', 'Policy number', { ph: 'Policy / card number' })}
            ${input('helpline', 'Insurer helpline', { type: 'tel', ph: 'Phone number', inputmode: 'tel', wide: true })}
          </div>
        </div>
      </div>

      <div class="med-card">
        <div class="mc" id="mc" aria-label="Emergency medical card"></div>
        <div class="card">
          <div class="card-h"><h2>${icon('hospital')} Insurance linking</h2></div>
          <p class="card-p">Request cashless approval while you're on the way to a network hospital.</p>
          <div class="chips">
            <a class="btn btn-ghost btn-sm" id="callInsurer" href="#">${icon('phone', 15)} Call insurer</a>
            <button class="btn btn-blue btn-sm" id="cashless" type="button">${icon('send', 15)} Cashless request</button>
          </div>
        </div>
      </div>
    </div>
  </section>`;

  const dd = (v) => (String(v ?? '').trim() ? `<dd>${esc(v)}</dd>` : '<dd class="none">—</dd>');

  function readForm() {
    const out = { ...getProfile() };
    $$('[data-k]', root).forEach((el) => { out[el.dataset.k] = el.value.trim(); });
    return out;
  }

  function renderCard(cur) {
    const pct = profileCompleteness(cur);
    $('#mc', root).innerHTML = `
      <div class="mc-top">
        <div><small class="k">Emergency medical card</small><h3>${esc(cur.name || 'Your name')}</h3><p class="sub">${cur.age ? esc(cur.age) + ' yrs' : 'Age not set'}${cur.blood ? ' · ' + esc(cur.blood) : ''}</p></div>
        <div class="mc-cross" aria-hidden="true">${icon('plus', 24)}</div>
      </div>
      <dl>
        <div><dt>Allergies</dt>${dd(cur.allergies)}</div>
        <div><dt>Conditions</dt>${dd(cur.conditions)}</div>
        <div><dt>ABHA</dt>${dd(cur.abha)}</div>
        <div><dt>ECHS</dt>${dd(cur.echs)}</div>
        <div><dt>Insurer</dt>${dd(cur.insurer)}</div>
        <div><dt>Policy</dt>${dd(cur.policy)}</div>
      </dl>
      <div class="mc-prog"><div><span>Card complete</span><b>${pct}%</b></div><div class="bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div></div>
      <div class="mc-actions">
        <button class="btn btn-red" id="sendCard" type="button">${icon('send', 16)} Send card</button>
        <button class="btn btn-ghost" id="copyCard" type="button">${icon('copy', 16)} Copy</button>
      </div>`;
    $('#sendCard', root).addEventListener('click', () => { setProfile(readForm()); openCardModal(); });
    $('#copyCard', root).addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(medicalCardText(readForm())); toast('Medical card copied'); } catch { toast('Could not copy'); }
    });
    const ins = $('#callInsurer', root);
    const num = String(cur.helpline || '').replace(/[^\d+]/g, '');
    ins.href = num ? `tel:${num}` : '#';
    ins.setAttribute('aria-disabled', String(!num));
    ins.title = num ? '' : 'Add the insurer helpline above first';
  }

  let t = null;
  const savedTag = $('#saved', root);
  root.addEventListener('input', (e) => {
    if (!e.target.matches('[data-k]')) return;
    const cur = readForm();
    renderCard(cur);
    savedTag.textContent = 'Saving…';
    clearTimeout(t);
    t = setTimeout(() => { setProfile(cur); savedTag.textContent = 'Saved on this device'; }, 350);
  });
  root.addEventListener('change', (e) => { if (e.target.matches('select[data-k]')) { const cur = readForm(); renderCard(cur); setProfile(cur); } });

  $('#callInsurer', root).addEventListener('click', (e) => {
    if (e.currentTarget.getAttribute('aria-disabled') === 'true') { e.preventDefault(); toast('Add your insurer helpline first.'); }
  });
  $('#cashless', root).addEventListener('click', () => { setProfile(readForm()); openCashlessModal(); });

  renderCard(getProfile());
  return () => { clearTimeout(t); setProfile(readForm()); };
}
