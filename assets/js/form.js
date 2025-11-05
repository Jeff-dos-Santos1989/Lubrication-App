/* form.js — QA/QC Checklist page logic
   ------------------------------------ */

(() => {
  const __FORM_JS_VERSION = '2025-11-05a';
  console.info('form.js loaded:', __FORM_JS_VERSION);

  // ---------- Constants ----------
  const BRAND = '#ff4d00';
  const RECIPIENT = 'jefferson.dossantos@arcelormittal.com';
  const allowedRouteCodes = ['W3ELL0037', 'W3ELL0038', 'W3ELL0039'];

  // If CSV load fails (e.g., first run), we still have something to autocomplete with:
  const FALLBACK_ASSET_IDS = [
    'BRU - 001 - ENTRY ROLL - BRIDLE ROLL UNIT #2 - Driven Side',
    'BRU - 002 - ENTRY ROLL - BRIDLE ROLL UNIT #2 - OPS Side',
    'BRU - 003 - MIDDLE ROLL - BRIDLE ROLL UNIT #2 - Driven Side',
    'DFR - 286 - DELFECTOR  ROLL ASSEMBLY E3A - OPS Side'
  ];

  const routeLines = `
W3ELL0001 - ETL3-LUB- 6 WEEK ENTRY LUBRICATION PM
W3ELL0002 - ETL3-LUB- 6 WEEK EXIT LUBRICATION PM
W3ELL0003 - 3ETL-LUB- 6 WEEK OIL MIST/GEARBOX CHECKS CLEANER / PICKLE
W3ELL0037 - ETL3-LUB- PROCESS LUBRICATION TECHNICAL INFO
W3ELL0038 - ETL3-LUB- ENTRY SECTION LUBRICATION TECHNICAL INFO
W3ELL0039 - ETL3-LUB- EXIT SECTION LUBRICATION TECHNICAL INFO
`.trim().split('\n');

  // ---------- Shared DOM refs ----------
  const els = {
    captureArea: document.getElementById('captureArea'),
    formBody: document.getElementById('formBody'),
    routeGate: document.getElementById('routeGate'),
    assetEntries: document.getElementById('assetEntries'),
    submitBtn: document.getElementById('submitBtn'),
    printBtn: document.getElementById('printBtn'),
    clearBtn: document.getElementById('clearBtn'),

    business_unit: document.getElementById('business_unit'),
    department: document.getElementById('department'),
    wo_number: document.getElementById('wo_number'),

    route_search: document.getElementById('route_search'),
    route_toggle: document.getElementById('route_toggle'),
    route_panel: document.getElementById('route_panel'),

    exec_name: document.getElementById('exec_name'),
    exec_date: document.getElementById('exec_date'),
    exec_time: document.getElementById('exec_time'),
  };

  // ---------- Lubricant Type list (same list you use on Consumption page) ----------
  const LUBE_TYPES = [
    'MOBIL UNIREX EP2',
    'MOBIL MOBILITH SHC 460',
    'MOBIL GEAR MS100',
    'SHELL MORLINA S3 BA 220',
    'SHELL OMALA S4 WE 220',
    'SHELL OMALA S2 GX 460',
    'SHELL TELLUS S2 MX 32',
    'SHELL TELLUS S2 MX 68'
  ];

  // ---------- Utilities ----------
  function norm(s) { return String(s || '').trim().toLowerCase(); }
  function todayISO() { return new Date().toISOString().slice(0, 10); }
  function nowHHMM() { return new Date().toTimeString().slice(0, 5); }

  function showToast(msg, type = 'info', ms = 2200) {
    if (window.appCore?.showToast) { window.appCore.showToast(msg, type, ms); return; }
    const t = document.createElement('div');
    t.textContent = msg;
    Object.assign(t.style, {
      position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
      padding: '12px 18px', background: type === 'error' ? '#d92b2b' : BRAND,
      color: '#fff', borderRadius: '8px', fontWeight: '600', fontSize: '14px',
      boxShadow: '0 4px 12px rgba(0,0,0,.2)', zIndex: 9999
    });
    document.body.appendChild(t);
    setTimeout(() => t.remove(), ms);
  }

  // ---------- Draft (autosave) ----------
  const DRAFT_KEY = 'qaqc_form_draft_v1';

  function saveDraft() {
    const data = {};
    document.querySelectorAll('#captureArea input, #captureArea textarea, #captureArea select')
      .forEach(el => {
        const type = (el.getAttribute('type') || '').toLowerCase();
        if (type === 'radio' || type === 'checkbox') {
          if (!data[el.name]) data[el.name] = [];
          if (el.checked) data[el.name].push(el.value);
        } else {
          const key = el.id || el.name;
          if (key) data[key] = el.value;
        }
      });
    localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
  }
  function loadDraft() {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    document.querySelectorAll('#captureArea input, #captureArea textarea, #captureArea select')
      .forEach(el => {
        const type = (el.getAttribute('type') || '').toLowerCase();
        if (type === 'radio' || type === 'checkbox') {
          const chosen = data[el.name] || [];
          el.checked = chosen.includes(el.value);
        } else {
          const key = el.id || el.name;
          if (key && data[key] != null) el.value = data[key];
        }
      });
  }
  function clearDraft(){ localStorage.removeItem(DRAFT_KEY); }

  // ---------- Route gate ----------
  function applyGateFromValue(routeFullText) {
    const code = (routeFullText || '').split(' - ')[0];
    const ok = allowedRouteCodes.includes(code);
    els.formBody.classList.toggle('hidden', !ok);
    els.routeGate.classList.toggle('hidden', ok);
    if (ok && document.querySelectorAll('.asset-entry').length === 0) addAssetEntry();
  }

  // ---------- Per-entry behaviours ----------
  function wireEntryDynamicBehaviours(scope) {
    // preview images Q1..Q7
    ['1','2','3','4','5','6','7'].forEach(n => {
      const input = scope.querySelector(`#q${n}_img`);
      const thumbs = scope.querySelector(`#q${n}_thumbs`);
      if (!input || !thumbs) return;
      input.addEventListener('change', () => {
        thumbs.innerHTML = '';
        Array.from(input.files || []).forEach(file => {
          const r = new FileReader();
          r.onload = ev => {
            const img = document.createElement('img');
            img.src = ev.target.result;
            thumbs.appendChild(img);
          };
          r.readAsDataURL(file);
        });
      });
    });

    // follow-ups show/hide
    function wireQuestion(qn, showOnValue) {
      const sec = scope.querySelector(`section.q[data-q="${qn}"]`);
      if (!sec) return;
      const follow = sec.querySelector('.followup');
      const radios = sec.querySelectorAll('input[type=radio]');
      radios.forEach(r => r.addEventListener('change', () => {
        if (r.checked && r.value === showOnValue) follow.style.display = 'block';
        else if (r.checked) follow.style.display = 'none';
      }));
    }
    wireQuestion('1','No'); wireQuestion('2','Yes'); wireQuestion('3','No');
    wireQuestion('4','Yes'); wireQuestion('5','Yes'); wireQuestion('6','No'); wireQuestion('7','No');

    // numeric guard for 1B
    const amtField = scope.querySelector('.amt_value');
    if (amtField) {
      amtField.addEventListener('input', () => {
        let v = amtField.value.replace(/[^0-9.]/g,'');
        const dot = v.indexOf('.');
        if (dot !== -1) v = v.slice(0, dot+1) + v.slice(dot+1).replace(/\./g,'');
        amtField.value = v;
      });
    }

    scope.querySelector('.btn-remove-entry')?.addEventListener('click', () => {
      const all = document.querySelectorAll('.asset-entry');
      if (all.length === 1) { alert('At least one asset entry is required.'); return; }
      scope.remove(); saveDraft();
    });
    scope.querySelector('.btn-add-entry')?.addEventListener('click', () => { addAssetEntry(); saveDraft(); });
  }

  async function buildPerEntryAssetAutocomplete(entry, ids, eid) {
    window.appCore.buildAutocomplete({
      inputId: `asset_search_${eid}`,
      panelId: `asset_panel_${eid}`,
      toggleId: `asset_toggle_${eid}`,
      data: ids,
      onPick: (line) => updateAssetPhotoIn(entry, line)
    });
    const inp = entry.querySelector(`#asset_search_${eid}`);
    const sync = () => {
      const v = inp.value.trim().toLowerCase();
      const exact = ids.find(d => d.toLowerCase() === v);
      updateAssetPhotoIn(entry, exact || '');
    };
    inp.addEventListener('input', sync);
    inp.addEventListener('change', sync);
  }

  function updateAssetPhotoIn(scope, assetName) {
    const wrap = scope.querySelector('.asset-photo-wrap');
    const img = scope.querySelector('.asset-photo');
    const hint = scope.querySelector('.asset-photo-hint');
    if (!wrap || !img || !hint) return;
    if (!assetName) { wrap.classList.add('hidden'); img.src=''; hint.textContent=''; return; }
    const imgPath = `Images/${assetName}.png`;
    img.onload = () => wrap.classList.remove('hidden');
    img.onerror = () => { wrap.classList.add('hidden'); console.warn(`Image not found: ${imgPath}`); };
    img.src = imgPath;
    hint.textContent = assetName;
  }

  async function addAssetEntry() {
    const entry = document.createElement('div');
    entry.className = 'asset-entry';
    const eid = (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

    const lubeOptions = LUBE_TYPES.map(x=>`<option>${x}</option>`).join('');

    entry.innerHTML = `
      <section class="q" data-q="asset">
        <h4>Equipment / Asset ID</h4>
        <div class="ac-wrap">
          <input id="asset_search_${eid}" class="ac-input" placeholder="Type or paste an asset name…">
          <button class="ac-chevron" type="button" id="asset_toggle_${eid}" aria-label="Open list">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          <div id="asset_panel_${eid}" class="ac-panel hidden"></div>
        </div>
        <div class="hint">Select the specific asset for this entry.</div>
      </section>

      <div class="asset-photo-wrap hidden">
        <p class="asset-photo-title">Inspection target</p>
        <img class="asset-photo" alt="Equipment / Asset reference image">
        <div class="asset-photo-hint"></div>
      </div>

      <section class="q" data-q="1">
        <h4>1 — Was the lubrication point lubricated as per WI standard?</h4>
        <div class="opts">
          <label><input type="radio" name="q1_${eid}" value="Yes"> Yes</label>
          <label><input type="radio" name="q1_${eid}" value="No"> No</label>
        </div>
        <div class="followup">
          <div class="hint">Please, provide more information and upload a picture.</div>
          <textarea placeholder="Describe the deviation..."></textarea>
          <input type="file" id="q1_img" accept="image/*" multiple />
          <div class="thumbs" id="q1_thumbs"></div>
        </div>
      </section>

      <section class="q" data-q="1b">
        <h4>1B — Amount of lubricant inserted/filled</h4>
        <div class="grid2" style="align-items:end;">
          <div>
            <label class="hint">Amount</label>
            <input class="num-input amt_value" type="number" inputmode="decimal" min="0" step="0.001" placeholder="0.000">
          </div>
          <div>
            <label class="hint">Units</label>
            <div class="inline-opts">
              <label><input type="radio" name="amt_unit_${eid}" value="g" checked> Grams (g)</label>
              <label><input type="radio" name="amt_unit_${eid}" value="L"> Liter (L)</label>
            </div>
          </div>
          <div style="margin-top:10px">
            <label class="hint">Lubricant Type</label>
            <select class="ac-input lubricant_type" style="border-width:1px">
              ${lubeOptions}
            </select>
          </div>
        </div>
        <div class="hint" style="margin-top:6px">Enter numbers only (decimals allowed). Leave blank if not applicable.</div>
      </section>

      <section class="q" data-q="2">
        <h4>2 — Was there any inconsistency with the volume added/purged to the pillow block/bearing?</h4>
        <div class="opts">
          <label><input type="radio" name="q2_${eid}" value="Yes"> Yes</label>
          <label><input type="radio" name="q2_${eid}" value="No"> No</label>
        </div>
        <div class="followup">
          <div class="hint">Please, provide more information and upload a picture.</div>
          <textarea placeholder="Explain the volume discrepancy..."></textarea>
          <input type="file" id="q2_img" accept="image/*" multiple />
          <div class="thumbs" id="q2_thumbs"></div>
        </div>
      </section>

      <section class="q" data-q="3">
        <h4>3 — Are the hoses, grease nipples, and other lubricant components in good condition?</h4>
        <div class="opts">
          <label><input type="radio" name="q3_${eid}" value="Yes"> Yes</label>
          <label><input type="radio" name="q3_${eid}" value="No"> No</label>
        </div>
        <div class="followup">
          <div class="hint">Please, provide more information and upload a picture.</div>
          <textarea placeholder="Describe damaged components..."></textarea>
          <input type="file" id="q3_img" accept="image/*" multiple />
          <div class="thumbs" id="q3_thumbs"></div>
        </div>
      </section>

      <section class="q" data-q="4">
        <h4>4 — Is there any sign of damage, malfunction, and/or leakage in the lubrication point indicated in the WI?</h4>
        <div class="opts">
          <label><input type="radio" name="q4_${eid}" value="Yes"> Yes</label>
          <label><input type="radio" name="q4_${eid}" value="No"> No</label>
        </div>
        <div class="followup">
          <div class="hint">Please, provide more information and upload a picture.</div>
          <textarea placeholder="Describe the observation..."></textarea>
          <input id="q4_img" type="file" accept="image/*" multiple />
          <div class="thumbs" id="q4_thumbs"></div>
        </div>
      </section>

      <section class="q" data-q="5">
        <h4>5 — Was the purged grease hardened or visually degraded compared to new grease?</h4>
        <div class="hint">Use the reference strip below for examples (oil separation, hardening, contamination, starvation, thermal degradation).</div>
        <img class="ref-img" src="Images/Grease-Evaluation_Chart.png" alt="Grease Degradation Reference" />
        <div class="opts" style="margin-top:8px;">
          <label><input type="radio" name="q5_${eid}" value="Yes"> Yes</label>
          <label><input type="radio" name="q5_${eid}" value="No"> No</label>
        </div>
        <div class="followup">
          <div class="hint">Please, provide more information and upload a picture.</div>
          <textarea placeholder="Describe grease condition..."></textarea>
          <input id="q5_img" type="file" accept="image/*" multiple />
          <div class="thumbs" id="q5_thumbs"></div>
        </div>
      </section>

      <section class="q" data-q="6">
        <h4>6 — Is the lubrication ID label present and legible (correct grease/oil spec)?</h4>
        <div class="opts">
          <label><input type="radio" name="q6_${eid}" value="Yes"> Yes</label>
          <label><input type="radio" name="q6_${eid}" value="No"> No</label>
        </div>
        <div class="followup">
          <textarea placeholder="Label issues..."></textarea>
          <input id="q6_img" type="file" accept="image/*" multiple />
          <div class="thumbs" id="q6_thumbs"></div>
        </div>
      </section>

      <section class="q" data-q="7">
        <h4>7 — Guards in place; access safe; purge path clear?</h4>
        <div class="opts">
          <label><input type="radio" name="q7_${eid}" value="Yes"> Yes</label>
          <label><input type="radio" name="q7_${eid}" value="No"> No</label>
        </div>
        <div class="followup">
          <textarea placeholder="Safety/access concerns..."></textarea>
          <input id="q7_img" type="file" accept="image/*" multiple />
          <div class="thumbs" id="q7_thumbs"></div>
        </div>
      </section>

      <section class="q" data-q="10">
        <h4>8 — Additional comments</h4>
        <textarea class="entry-comments" placeholder="Anything else noteworthy..."></textarea>
      </section>

      <div class="entry-controls no-print" data-html2canvas-ignore="true">
        <button type="button" class="btn-danger btn-remove-entry">Remove Asset Entry</button>
        <button type="button" class="btn-add btn-add-entry">Add Asset Entry</button>
      </div>

      <div class="divider"></div>
    `;

    els.assetEntries.appendChild(entry);

    // --- SAFETY GUARD: if for any reason the dropdown didn't render (cache/old HTML),
    // append it programmatically so you always see it.
    if (!entry.querySelector('.lubricant_type')) {
      const holder = entry.querySelector('section.q[data-q="1b"] .grid2');
      if (holder) {
        const div = document.createElement('div');
        div.style.marginTop = '10px';
        div.innerHTML = `
          <label class="hint">Lubricant Type</label>
          <select class="ac-input lubricant_type" style="border-width:1px">
            ${lubeOptions}
          </select>
        `;
        holder.appendChild(div);
      }
    }

    // Asset IDs (CSV or fallback)
    let assetIDs = FALLBACK_ASSET_IDS;
    try {
      const rows = await window.appCore.parseCSV('assets/data/assets.csv');
      const headers = rows[0] ? Object.keys(rows[0]) : [];
      const idxHeader = headers.find(h => norm(h) === 'equipment / asset id') || headers[0];
      const ids = Array.from(new Set(rows.map(r => String(r[idxHeader] || '').trim()).filter(Boolean)));
      if (ids.length) assetIDs = ids;
    } catch (e) {}

    await buildPerEntryAssetAutocomplete(entry, assetIDs, eid);
    wireEntryDynamicBehaviours(entry);
  }

  // ---------- Validation & email body ----------
  function ensureWoOrAlert() {
    const wo = (els.wo_number.value || '').trim();
    if (!wo) { alert('Please, enter Assigned WO#.'); els.wo_number.focus(); return null; }
    return wo;
  }

  function validateMandatoryQuestions() {
    const firstEntryAsset = document.querySelector('.asset-entry input[id^="asset_search_"]');
    if (!firstEntryAsset || !firstEntryAsset.value.trim()) {
      alert('Please select the Equipment / Asset ID for the first entry.');
      firstEntryAsset?.focus(); return false;
    }
    for (let i = 1; i <= 7; i++) {
      const radios = document.querySelectorAll(`input[name^="q${i}_"]`);
      if (!Array.from(radios).some(r => r.checked)) {
        alert(`Please answer question ${i} before submitting.`);
        radios[0]?.scrollIntoView({ behavior: "smooth", block: "center" });
        return false;
      }
    }
    const amt = document.querySelector(".amt_value");
    if (!amt || !amt.value.trim()) {
      alert("Please fill in question 1B (Amount of lubricant inserted/filled).");
      amt?.scrollIntoView({ behavior: "smooth", block: "center" }); amt?.focus(); return false;
    }
    const comments = document.querySelector(".entry-comments");
    if (!comments || !comments.value.trim()) {
      alert("Please provide a comment for question 8 (Additional comments).");
      comments?.scrollIntoView({ behavior: "smooth", block: "center" }); comments?.focus(); return false;
    }
    if (!els.exec_name?.value.trim()) { alert('Please enter the Inspector / Technician name.'); els.exec_name?.focus(); return false; }
    if (!els.exec_date?.value) { alert('Please enter the execution date.'); els.exec_date?.focus(); return false; }
    if (!els.exec_time?.value) { alert('Please enter the execution time.'); els.exec_time?.focus(); return false; }
    return true;
  }

  function getFollowupComment(qNum) {
    const textarea = document.querySelector(`section.q[data-q="${qNum}"] .followup textarea`);
    const comment = textarea ? textarea.value.trim() : '';
    return comment || 'No specific comment provided.';
  }
  function qVal(n) {
    const r = document.querySelector(`input[name^="q${n}_"]:checked`);
    return r?.value || '';
  }

  function buildStatusAndBody() {
    const red = [];
    if (qVal(1) === 'No') red.push(`Lubrication point issues.\nComments: ${getFollowupComment('1')}`);
    if (qVal(2) === 'Yes') red.push(`Inconsistency in volume added.\nComments: ${getFollowupComment('2')}`);
    if (qVal(3) === 'No') red.push(`Components condition issue.\nComments: ${getFollowupComment('3')}`);
    if (qVal(4) === 'Yes') red.push(`Damage/leakage identified.\nComments: ${getFollowupComment('4')}`);
    if (qVal(5) === 'Yes') red.push(`Lubricant consistency out of spec.\nComments: ${getFollowupComment('5')}`);
    if (qVal(6) === 'No') red.push(`Label/ID issue.\nComments: ${getFollowupComment('6')}`);
    if (qVal(7) === 'No') red.push(`Safety/access concern.\nComments: ${getFollowupComment('7')}`);

    const isGreen = red.length === 0;
    const meta = [
      `Business Unit: ${els.business_unit.value}`,
      `Department: ${els.department.value}`,
      `WO#: ${els.wo_number.value || '—'}`,
      `Route: ${els.route_search.value || '—'}`,
      `Asset: ${document.querySelector('.asset-entry input[id^="asset_search_"]')?.value || '—'}`,
      `Inspector: ${els.exec_name?.value || '—'}`,
      `Execution Date: ${els.exec_date?.value || '—'}`,
      `Execution Time: ${els.exec_time?.value || '—'}`
    ];

    let body = [];
    if (isGreen) { body.push('QA/QC Performed - Green STATUS 🟢\n', ...meta, '\nNo issues found.'); }
    else {
      body.push('QA/QC Performed - RED STATUS 🔴\n',
        'Highlights that can better looked at the PDF report attached\n',
        ...meta,
        '\n# ------ # ------ # ------ # ------ # ------ #',
        red.join('\n\n'));
    }
    return { isGreen, bodyText: body.join('\n') };
  }

  function buildSubject() {
    const wo = els.wo_number.value || 'TIN-XXXXX';
    const { isGreen } = buildStatusAndBody();
    return `QA/QC Execution Report - WO# ${wo} - ${isGreen ? 'Green Status 🟢' : 'Red Status 🔴'}`;
  }

  // ---------- Persist to consumption_v1 ----------
  function persistConsumptionFromEntries() {
    const KEY = 'consumption_v1';
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');

    // Timestamp from exec date/time
    let ts = Date.now();
    try {
      const iso = `${els.exec_date.value}T${els.exec_time.value}:00`;
      const d = new Date(iso);
      if (!Number.isNaN(d.getTime())) ts = d.getTime();
    } catch {}

    const entries = document.querySelectorAll('.asset-entry');

    entries.forEach(entry => {
      const assetId = entry.querySelector('input[id^="asset_search_"]')?.value?.trim() || '';
      const amtStr = entry.querySelector('.amt_value')?.value?.trim() || '';
      const amount = Number(amtStr);
      const unit = entry.querySelector('input[name^="amt_unit_"]:checked')?.value || 'g';
      const lubricantType = entry.querySelector('.lubricant_type')?.value || '';

      if (assetId && amount > 0 && lubricantType) {
        const rec = {
          id: (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)),
          woNumber: els.wo_number.value.trim(),
          assetId,
          lubricant: '',                 // free-text not used anymore
          amount,
          unit,
          lubricatorType: lubricantType, // reusing field name expected by consumption.js
          timestamp: ts
        };
        list.push(rec);
      }
    });

    localStorage.setItem(KEY, JSON.stringify(list));
    showToast('Consumption saved to log ✓', 'info', 1800);
  }

  // ---------- PDF generation ----------
  function downloadPDF() {
    const toHide = document.querySelectorAll('.ac-panel, .ac-chevron, .entry-controls, .actions');
    toHide.forEach(el => el.classList.add('hidden'));

    const wo = els.wo_number.value || 'TIN-XXXXX';
    const filename = `QAQC_${wo}.pdf`;
    const element = els.captureArea;

    const fillFormValuesInClone = (doc) => {
      doc.querySelectorAll('#captureArea input, #captureArea textarea, #captureArea select').forEach(el => {
        const type = (el.getAttribute('type') || '').toLowerCase();
        let live = null;
        if (el.id) live = document.getElementById(el.id);
        if (!live && (type === 'radio' || type === 'checkbox') && el.name) {
          live = document.querySelector(`input[name="${el.name}"][value="${el.value}"]`);
        }
        if (!live) return;

        if (type === 'radio' || type === 'checkbox') {
          el.checked = !!live.checked;
          if (el.checked) el.setAttribute('checked', 'checked'); else el.removeAttribute('checked');
          if (type === 'radio') {
            el.style.appearance = 'none';
            el.style.webkitAppearance = 'none';
            el.style.width = '16px';
            el.style.height = '16px';
            el.style.border = `2px solid ${BRAND}`;
            el.style.borderRadius = '50%';
            el.style.display = 'inline-block';
            el.style.verticalAlign = 'middle';
            el.style.position = 'relative';
            el.style.marginRight = '6px';
            el.style.background = el.checked ? `radial-gradient(${BRAND} 0 46%, transparent 47% 100%)` : 'transparent';
          }
          return;
        }

        if (el.tagName.toLowerCase() === 'textarea') {
          el.value = live.value; el.textContent = live.value; el.defaultValue = live.value; return;
        }
        el.value = live.value; el.setAttribute('value', live.value); el.defaultValue = live.value;
      });

      const style = doc.createElement('style');
      style.textContent = `
        #captureArea input, #captureArea textarea, #captureArea select {
          border: none !important; background: #fff !important; color: #222 !important;
          box-shadow: none !important; -webkit-appearance: none; appearance: none;
        }
      `;
      doc.head.appendChild(style);
    };

    const opt = {
      margin: [10, 10, 10, 10],
      filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, scrollY: 0, onclone: (d)=>fillFormValuesInClone(d) },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().from(element).set(opt).save().finally(() => {
      toHide.forEach(el => el.classList.remove('hidden'));
    });
  }

  // ---------- Submit / Print / Clear ----------
  function submitThenPdf() {
    if (!ensureWoOrAlert()) return;
    if (!validateMandatoryQuestions()) return;

    persistConsumptionFromEntries();

    const subject = buildSubject();
    const { bodyText } = buildStatusAndBody();
    const mailto = `mailto:${encodeURIComponent(RECIPIENT)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;

    window.location.href = mailto;

    setTimeout(() => {
      downloadPDF();
      setTimeout(() => { clearForm(); clearDraft(); showToast('Form submitted ✅', 'info', 2200); }, 500);
    }, 350);
  }

  function printPdfClicked() {
    if (!ensureWoOrAlert()) return;
    if (!validateMandatoryQuestions()) return;

    persistConsumptionFromEntries();
    downloadPDF();
  }

  function clearForm() {
    ['business_unit','department','wo_number','route_search'].forEach(id => { const el = document.getElementById(id); if (el) el.value=''; });
    if (els.exec_name) els.exec_name.value = '';
    if (els.exec_date) els.exec_date.value = '';
    if (els.exec_time) els.exec_time.value = '';

    els.formBody.classList.add('hidden');
    els.routeGate.classList.remove('hidden');
    els.assetEntries.innerHTML = '';
  }

  // ---------- Init ----------
  async function init() {
    if (els.exec_date && !els.exec_date.value) els.exec_date.value = todayISO();
    if (els.exec_time && !els.exec_time.value) els.exec_time.value = nowHHMM();

    document.addEventListener('input', (e) => { if (e.target.closest('#captureArea')) saveDraft(); });
    loadDraft();

    window.appCore.buildAutocomplete({
      inputId: 'route_search',
      panelId: 'route_panel',
      toggleId: 'route_toggle',
      data: routeLines,
      onPick: (line) => applyGateFromValue(line)
    });

    els.route_search.addEventListener('change', e => {
      const v = e.target.value.trim();
      const code = v.includes(' - ') ? v.split(' - ')[0] : v;
      const full = routeLines.find(l => l.startsWith(code + ' - '));
      if (full) e.target.value = full;
      applyGateFromValue(e.target.value);
      saveDraft();
    });

    els.submitBtn.addEventListener('click', submitThenPdf);
    els.printBtn.addEventListener('click', printPdfClicked);
    els.clearBtn.addEventListener('click', () => { clearForm(); clearDraft(); showToast('Form cleared', 'info'); });

    applyGateFromValue(els.route_search.value);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
