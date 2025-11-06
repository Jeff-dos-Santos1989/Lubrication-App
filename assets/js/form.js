/* form.js — QA/QC Checklist (PDF export aligned with legacy working approach)
   Keeps: gate, Q1 collapse, consumption persist, email + html2pdf
   Adds: per-question follow-up toggles (show/hide) for 1..7
   Version: 2025-11-06-LegacyPrint-Followups
*/

(() => {
  const RECIPIENT = 'jefferson.dossantos@arcelormittal.com';
  const allowedRouteCodes = ['W3ELL0037','W3ELL0038','W3ELL0039'];

  // --------- DOM ---------
  const els = {
    captureArea: document.getElementById('captureArea'),
    formBody: document.getElementById('formBody'),
    routeGate: document.getElementById('routeGate'),
    assetEntries: document.getElementById('assetEntries'),

    business_unit: document.getElementById('business_unit'),
    department: document.getElementById('department'),
    wo_number: document.getElementById('wo_number'),

    route_search: document.getElementById('route_search'),
    route_toggle: document.getElementById('route_toggle'),
    route_panel: document.getElementById('route_panel'),

    exec_name: document.getElementById('exec_name'),
    exec_date: document.getElementById('exec_date'),
    exec_time: document.getElementById('exec_time'),

    submitBtn: document.getElementById('submitBtn'),
    printBtn: document.getElementById('printBtn'),
    clearBtn: document.getElementById('clearBtn'),
  };

  // --------- Helpers ---------
  const todayISO = () => new Date().toISOString().slice(0,10);
  const nowHHMM  = () => new Date().toTimeString().slice(0,5);

  function showToast(msg, type='info', ms=2000){
    if (window.appCore?.showToast) { window.appCore.showToast(msg, type, ms); return; }
    const t = document.createElement('div');
    Object.assign(t.style, {position:'fixed',left:'50%',bottom:'24px',transform:'translateX(-50%)',
      background:'#ff4d00',color:'#fff',padding:'10px 16px',borderRadius:'8px',fontWeight:'600',zIndex:9999});
    t.textContent = msg; document.body.appendChild(t); setTimeout(()=>t.remove(), ms);
  }

  // --------- Gate / autocomplete ---------
  const routeLines = `
W3ELL0001 - ETL3-LUB- 6 WEEK ENTRY LUBRICATION PM
W3ELL0002 - ETL3-LUB- 6 WEEK EXIT LUBRICATION PM
W3ELL0003 - 3ETL-LUB- 6 WEEK OIL MIST/GEARBOX CHECKS CLEANER / PICKLE
W3ELL0037 - ETL3-LUB- PROCESS LUBRICATION TECHNICAL INFO
W3ELL0038 - ETL3-LUB- ENTRY SECTION LUBRICATION TECHNICAL INFO
W3ELL0039 - ETL3-LUB- EXIT SECTION LUBRICATION TECHNICAL INFO
`.trim().split('\n');

  function applyGateFromValue(routeFullText){
    const code = String(routeFullText||'').split(' - ')[0];
    const ok = allowedRouteCodes.includes(code);
    els.formBody.classList.toggle('hidden', !ok);
    els.routeGate.classList.toggle('hidden', ok);
    if (ok && document.querySelectorAll('.asset-entry').length === 0) addAssetEntry();
  }

  try {
    window.appCore?.buildAutocomplete({
      inputId:'route_search', panelId:'route_panel', toggleId:'route_toggle',
      data: routeLines, onPick:(line)=>applyGateFromValue(line)
    });
  } catch(e){/* non-fatal */}
  els.route_search.addEventListener('change', e=>{
    const v = e.target.value.trim();
    const code = v.includes(' - ') ? v.split(' - ')[0] : v;
    const full = routeLines.find(l => l.startsWith(code + ' - '));
    if (full) e.target.value = full;
    applyGateFromValue(e.target.value);
  });

  // --------- Asset entry block ----------
  const FALLBACK_ASSETS = [
    'BRU - 001 - ENTRY ROLL - BRIDLE ROLL UNIT 2 - Driven Side',
    'BRU - 002 - ENTRY ROLL - BRIDLE ROLL UNIT 2 - OPS Side',
    'BRU - 003 - MIDDLE ROLL - BRIDLE ROLL UNIT 2 - Driven Side',
    'DFR - 286 - DELFECTOR  ROLL ASSEMBLY E3A - OPS Side'
  ];

  async function buildAssetAutocomplete(entry, ids, eid){
    try {
      window.appCore?.buildAutocomplete({
        inputId:`asset_search_${eid}`, panelId:`asset_panel_${eid}`, toggleId:`asset_toggle_${eid}`,
        data: ids, onPick:(line)=>updateAssetPhotoIn(entry, line)
      });
    } catch(e){/* ignore */}
    const inp = entry.querySelector(`#asset_search_${eid}`);
    const sync = () => {
      const v = inp.value.trim().toLowerCase();
      const exact = ids.find(d => d.toLowerCase() === v);
      updateAssetPhotoIn(entry, exact || '');
    };
    inp.addEventListener('input', sync);
    inp.addEventListener('change', sync);
  }

  function updateAssetPhotoIn(scope, assetName){
    const wrap = scope.querySelector('.asset-photo-wrap');
    const img  = scope.querySelector('.asset-photo');
    const hint = scope.querySelector('.asset-photo-hint');
    if (!wrap || !img || !hint) return;
    if (!assetName){ wrap.classList.add('hidden'); img.src=''; hint.textContent=''; return; }
    const imgPath = `Images/${assetName}.png`;
    img.onload  = () => wrap.classList.remove('hidden');
    img.onerror = () => { wrap.classList.add('hidden'); };
    img.src = imgPath; hint.textContent = assetName;
  }

  // --- FOLLOW-UP toggle map (question -> value that shows the follow-up area)
  const FOLLOWUP_SHOW_VALUE = {
    '1': 'No',
    '2': 'Yes',
    '3': 'No',
    '4': 'Yes',
    '5': 'Yes',
    '6': 'No',
    '7': 'No'
  };

  function applyFollowupVisibility(scope, qn){
    const sec = scope.querySelector(`section.q[data-q="${qn}"]`);
    if (!sec) return;
    const follow = sec.querySelector('.followup');
    if (!follow) return;

    const checked = sec.querySelector('input[type="radio"]:checked');
    const shouldShow = checked && checked.value === FOLLOWUP_SHOW_VALUE[qn];
    follow.style.display = shouldShow ? 'block' : 'none';
  }

  function wireFollowups(scope){
    Object.keys(FOLLOWUP_SHOW_VALUE).forEach(qn=>{
      const sec = scope.querySelector(`section.q[data-q="${qn}"]`);
      if (!sec) return;
      const radios = sec.querySelectorAll('input[type="radio"]');
      radios.forEach(r=>{
        r.addEventListener('change', ()=>applyFollowupVisibility(scope, qn));
      });
      // initial pass
      applyFollowupVisibility(scope, qn);
    });
  }

  function wireEntryDynamicBehaviours(scope){
    // Q1 collapse logic (if Yes → hide 2..8)
    const q1Radios = scope.querySelectorAll('input[name^="q1_"]');
    const toggleByQ1 = (v) => {
      const hide = (v === 'Yes');
      ['2','3','4','5','6','7','10'].forEach(n=>{
        const sec = scope.querySelector(`section.q[data-q="${n}"]`);
        if (sec) sec.style.display = hide ? 'none' : '';
      });
    };
    q1Radios.forEach(r => r.addEventListener('change', ()=>toggleByQ1(r.value)));
    const q1c = scope.querySelector('input[name^="q1_"]:checked'); if (q1c) toggleByQ1(q1c.value);

    // Wire numeric guard
    const amtField = scope.querySelector('.amt_value');
    if (amtField) amtField.addEventListener('input', ()=>{
      let v = amtField.value.replace(/[^0-9.]/g,'');
      const dot = v.indexOf('.');
      if (dot !== -1) v = v.slice(0, dot+1) + v.slice(dot+1).replace(/\./g,'');
      amtField.value = v;
    });

    // Wire add/remove
    scope.querySelector('.btn-remove-entry')?.addEventListener('click', ()=>{
      if (document.querySelectorAll('.asset-entry').length === 1) { alert('At least one asset entry is required.'); return; }
      scope.remove();
    });
    scope.querySelector('.btn-add-entry')?.addEventListener('click', ()=>addAssetEntry());

    // Wire follow-up visibility for all relevant questions
    wireFollowups(scope);
  }

  async function addAssetEntry(){
    const entry = document.createElement('div');
    entry.className = 'asset-entry';
    const eid = (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

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
          <div>
            <label class="hint">Lubricant Type</label>
            <select class="ac-input lubricant_type" style="border-width:1px">
              <option>MOBIL UNIREX EP2</option>
              <option>MOBIL MOBILITH SHC 460</option>
              <option>MOBIL GEAR MS100</option>
              <option>SHELL MORLINA S3 BA 220</option>
              <option>SHELL OMALA S4 WE 220</option>
              <option>SHELL OMALA S2 GX 460</option>
              <option>SHELL TELLUS S2 MX 32</option>
              <option>SHELL TELLUS S2 MX 68</option>
            </select>
          </div>
        </div>
        <div class="hint">Enter numbers only (decimals allowed). Leave blank if not applicable.</div>
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
    await buildAssetAutocomplete(entry, FALLBACK_ASSETS, eid);
    wireEntryDynamicBehaviours(entry);
  }

  // --------- Validation ----------
  function ensureWoOrAlert() {
    const wo = (els.wo_number.value || '').trim();
    if (!wo) { alert('Please, enter Assigned WO#.'); els.wo_number.focus(); return null; }
    return wo;
  }

  function validateMandatoryQuestions() {
    const firstAsset = document.querySelector('.asset-entry input[id^="asset_search_"]');
    if (!firstAsset || !firstAsset.value.trim()) { alert('Please select the Equipment / Asset ID.'); return false; }

    const q1 = document.querySelector('input[name^="q1_"]:checked')?.value || '';
    if (!q1) { alert('Please answer question 1.'); return false; }

    const amt = document.querySelector(".amt_value");
    if (!amt || !amt.value.trim()) { alert("Please fill 1B (Amount)."); return false; }

    if (q1 === 'Yes') return true;

    for (let i=2;i<=7;i++){
      const radios = document.querySelectorAll(`input[name^="q${i}_"]`);
      if (!Array.from(radios).some(r=>r.checked)) { alert(`Please answer question ${i}.`); return false; }
    }
    const c = document.querySelector('.entry-comments');
    if (!c || !c.value.trim()) { alert('Please fill question 8 (comments).'); return false; }

    if (!els.exec_name?.value.trim()) { alert('Please enter the Inspector / Technician name.'); return false; }
    if (!els.exec_date?.value) { alert('Please enter the execution date.'); return false; }
    if (!els.exec_time?.value) { alert('Please enter the execution time.'); return false; }

    return true;
  }

  function buildStatusAndBody(){
    const getF = (n) => {
      const t = document.querySelector(`section.q[data-q="${n}"] .followup textarea`);
      return (t ? t.value.trim() : '') || 'No specific comment provided.';
    };
    const q = (n) => document.querySelector(`input[name^="q${n}_"]:checked`)?.value || '';

    const red = [];
    if (q(1)==='No') red.push(`Lubrication point issues.\nComments: ${getF('1')}`);
    if (q(2)==='Yes') red.push(`Volume inconsistency.\nComments: ${getF('2')}`);
    if (q(3)==='No') red.push(`Component condition issue.\nComments: ${getF('3')}`);
    if (q(4)==='Yes') red.push(`Damage/leakage.\nComments: ${getF('4')}`);
    if (q(5)==='Yes') red.push(`Grease condition out of spec.\nComments: ${getF('5')}`);
    if (q(6)==='No') red.push(`Label/ID issue.\nComments: ${getF('6')}`);
    if (q(7)==='No') red.push(`Safety/access concern.\nComments: ${getF('7')}`);

    const isGreen = red.length===0;
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

    const body = [];
    if (isGreen){
      body.push('QA/QC Performed - Green STATUS 🟢\n', ...meta, '\nNo issues found.');
    } else {
      body.push('QA/QC Performed - RED STATUS 🔴\n',
        'Highlights available in the attached PDF.\n',
        ...meta, '\n# ------ # ------ # ------ # ------ # ------ #', red.join('\n\n'));
    }
    return { isGreen, bodyText: body.join('\n') };
  }
  function buildSubject(){
    const wo = els.wo_number.value || 'TIN-XXXXX';
    const { isGreen } = buildStatusAndBody();
    return `QA/QC Execution Report - WO# ${wo} - ${isGreen ? 'Green Status 🟢' : 'Red Status 🔴'}`;
  }

  // --------- Persist 1B to consumption + live refresh ----------
  function persistConsumptionFromEntries(){
    let ts = Date.now();
    try {
      const iso = `${els.exec_date.value}T${els.exec_time.value}:00`;
      const d = new Date(iso); if (!Number.isNaN(d.getTime())) ts = d.getTime();
    } catch {}

    const KEY = 'QAQC_CONSUMPTION_V1';
    const V1  = 'consumption_v1';
    const V2  = 'consumption_records_v2';

    const list = JSON.parse(localStorage.getItem(KEY)||'[]');
    const v1   = JSON.parse(localStorage.getItem(V1)||'[]');
    const v2   = JSON.parse(localStorage.getItem(V2)||'[]');

    let addedCount = 0;
    let last = null;

    document.querySelectorAll('.asset-entry').forEach(entry=>{
      const asset = entry.querySelector('input[id^="asset_search_"]')?.value?.trim() || '';
      const amount = Number(entry.querySelector('.amt_value')?.value?.trim() || '0');
      const unit = entry.querySelector('input[name^="amt_unit_"]:checked')?.value || 'g';
      const lubricantType = entry.querySelector('.lubricant_type')?.value || '';

      if (asset && amount>0 && lubricantType){
        const qa = { wo:(els.wo_number.value||'').trim(), asset, lubricantType, amount, unit, date:new Date(ts).toISOString() };
        list.push(qa); last = qa; addedCount++;

        const legacy = {
          id: (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)),
          woNumber: qa.wo,
          routeId: (els.route_search.value||'').trim(),
          businessUnit: (els.business_unit.value||'').trim(),
          department: (els.department.value||'').trim(),
          assetId: asset,
          amount, unit,
          lubricatorType: lubricantType,
          lubricantType,
          timestamp: ts
        };
        v1.push({...legacy});
        v2.push({...legacy});
      }
    });

    localStorage.setItem(KEY, JSON.stringify(list));
    localStorage.setItem(V1,  JSON.stringify(v1));
    localStorage.setItem(V2,  JSON.stringify(v2));
    if (last) localStorage.setItem('QAQC_LAST_SUBMISSION', JSON.stringify(last));

    if (addedCount) showToast(`Consumption saved (${addedCount}) ✓`, 'info', 1800);
    try { window.dispatchEvent(new CustomEvent('consumption:record-added', { detail: { count: addedCount } })); } catch {}
  }

  // --------- PDF Export (LEGACY WORKING APPROACH) ----------
  function syncInputValuesToAttributes(){
    els.captureArea.querySelectorAll(
      'input[type="text"], input[type="date"], input[type="time"], input[type="number"], textarea, input:not([type])'
    ).forEach(el => el.setAttribute('value', el.value));
  }

  let _radioSnapshots = [];
  function makeRadiosPrintable(){
    _radioSnapshots = [];
    const containers = els.captureArea.querySelectorAll('.q .opts, .inline-opts');
    containers.forEach(c=>{
      const html = c.innerHTML;
      const radios = Array.from(c.querySelectorAll('input[type="radio"]'));
      if (!radios.length) return;
      const parts = radios.map(r=>{
        const text = (r.parentNode.textContent||'').trim();
        const cls  = r.checked ? 'rb-mark rb-sel' : 'rb-mark rb-unsel';
        const dot  = r.checked ? '●' : '○';
        return `<span class="${cls}">${dot} ${text}</span>`;
      });
      _radioSnapshots.push([c, html]);
      c.innerHTML = parts.join('');
    });
  }
  function restoreRadios(){ _radioSnapshots.forEach(([n,h])=>{ n.innerHTML=h; }); _radioSnapshots=[]; }

  let _inputSnapshots = [];
  function makeInputsPrintable(){
    _inputSnapshots = [];
    const sel = 'input[type="text"], input[type="date"], input[type="time"], input[type="number"], textarea, input:not([type])';
    els.captureArea.querySelectorAll(sel).forEach(el=>{
      let val = (el.value??'').toString();
      if (!val.trim()) val = '—';
      const clone = document.createElement('span');
      clone.className = 'input-print';
      clone.textContent = val;

      const cs = getComputedStyle(el);
      if (cs.display === 'block') clone.style.display = 'block';
      clone.style.width = (el.offsetWidth ? el.offsetWidth + 'px' : '100%');

      _inputSnapshots.push({ el, parent: el.parentNode, next: el.nextSibling, clone });
      el.classList.add('hidden');
      el.parentNode.insertBefore(clone, el.nextSibling);
    });
  }
  function restoreInputs(){
    _inputSnapshots.forEach(({el,parent,next,clone})=>{
      if (clone && clone.parentNode) clone.parentNode.removeChild(clone);
      el.classList.remove('hidden');
      if (el.parentNode !== parent) parent.insertBefore(el, next);
    });
    _inputSnapshots = [];
  }

  function downloadPDF(){
    const toHide = document.querySelectorAll('.ac-panel, .ac-chevron, .entry-controls, .actions');
    toHide.forEach(el=>el.classList.add('hidden'));

    makeRadiosPrintable();
    makeInputsPrintable();

    const wo = els.wo_number.value || 'TIN-XXXXX';
    const filename = `QAQC_${wo}.pdf`;

    const opt = {
      margin:[10,10,10,10],
      filename,
      image:{ type:'jpeg', quality:0.98 },
      html2canvas:{ scale:2, useCORS:true, scrollY:0 },
      jsPDF:{ unit:'mm', format:'a4', orientation:'portrait' }
    };

    return html2pdf().from(els.captureArea).set(opt).save().finally(()=>{
      restoreInputs();
      restoreRadios();
      toHide.forEach(el=>el.classList.remove('hidden'));
    });
  }

  // --------- Actions ----------
  function submitThenPdf(){
    if (!ensureWoOrAlert()) return;
    if (!validateMandatoryQuestions()) return;

    // persist 1B consumption before export
    persistConsumptionFromEntries();

    const subject = buildSubject();
    const { bodyText } = buildStatusAndBody();
    const mailto = `mailto:${encodeURIComponent(RECIPIENT)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;
    window.location.href = mailto;

    setTimeout(()=>{ downloadPDF().then(()=>{ clearForm(); showToast('Form submitted ✅'); }); }, 350);
  }

  function printPdfClicked(){
    if (!ensureWoOrAlert()) return;
    if (!validateMandatoryQuestions()) return;
    persistConsumptionFromEntries();
    downloadPDF();
  }

  function clearForm(){
    ['business_unit','department','wo_number','route_search'].forEach(id=>{
      const el = document.getElementById(id); if (el) el.value='';
    });
    els.formBody.classList.add('hidden');
    els.routeGate.classList.remove('hidden');
    els.assetEntries.innerHTML='';
    if (els.exec_name) els.exec_name.value='';
    if (els.exec_date) els.exec_date.value='';
    if (els.exec_time) els.exec_time.value='';
  }

  // --------- Init ----------
  function init(){
    if (els.exec_date && !els.exec_date.value) els.exec_date.value = todayISO();
    if (els.exec_time && !els.exec_time.value) els.exec_time.value = nowHHMM();

    els.submitBtn.addEventListener('click', submitThenPdf);
    els.printBtn.addEventListener('click', printPdfClicked);
    els.clearBtn.addEventListener('click', clearForm);

    els.captureArea.addEventListener('input', syncInputValuesToAttributes);
    syncInputValuesToAttributes();

    applyGateFromValue(els.route_search?.value);
  }
  document.addEventListener('DOMContentLoaded', init);
})();
