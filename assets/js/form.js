/* form.js — QA/QC Checklist page logic
   ------------------------------------ */

   (() => {
    // ---------- Constants ----------
    const BRAND = '#ff4d00';
    const RECIPIENT = 'jefferson.dossantos@arcelormittal.com';
    const allowedRouteCodes = ['W3ELL0037', 'W3ELL0038', 'W3ELL0039'];
  
    const FALLBACK_ASSET_IDS = [
      'BRU - 001 - ENTRY ROLL - BRIDLE ROLL UNIT 2 - Driven Side',
      'BRU - 002 - ENTRY ROLL - BRIDLE ROLL UNIT 2 - OPS Side',
      'BRU - 003 - MIDDLE ROLL - BRIDLE ROLL UNIT 2 - Driven Side',
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
  
    // ---------- DOM refs ----------
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
  
    // ---------- Helpers ----------
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
  
    // ---------- Draft autosave ----------
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
      const code = String(routeFullText || '').split(' - ')[0].trim().toUpperCase();
      const OK_CODES = allowedRouteCodes.map(c => String(c).trim().toUpperCase());
      const ok = OK_CODES.includes(code);
      els.formBody.classList.toggle('hidden', !ok);
      els.routeGate.classList.toggle('hidden', ok);
      if (ok && document.querySelectorAll('.asset-entry').length === 0) addAssetEntry();
    }
  
    // ---------- Asset entry ----------
    function wireEntryDynamicBehaviours(scope) {
      ['1','2','3','4','5','6','7'].forEach(n=>{
        const input = scope.querySelector(`#q${n}_img`);
        const thumbs = scope.querySelector(`#q${n}_thumbs`);
        if (!input||!thumbs) return;
        input.addEventListener('change',()=>{
          thumbs.innerHTML='';
          Array.from(input.files||[]).forEach(f=>{
            const r=new FileReader();
            r.onload=e=>{
              const i=document.createElement('img');i.src=e.target.result;thumbs.appendChild(i);
            };
            r.readAsDataURL(f);
          });
        });
      });
    }
  
    async function buildPerEntryAssetAutocomplete(entry, ids, eid) {
      window.appCore.buildAutocomplete({
        inputId:`asset_search_${eid}`,
        panelId:`asset_panel_${eid}`,
        toggleId:`asset_toggle_${eid}`,
        data:ids,
        onPick:(line)=>updateAssetPhotoIn(entry,line)
      });
    }
  
    function updateAssetPhotoIn(scope,assetName){
      const wrap=scope.querySelector('.asset-photo-wrap');
      const img=scope.querySelector('.asset-photo');
      const hint=scope.querySelector('.asset-photo-hint');
      if(!wrap||!img||!hint)return;
      if(!assetName){wrap.classList.add('hidden');img.src='';hint.textContent='';return;}
      const path=`Images/${assetName}.png`;
      img.onload=()=>wrap.classList.remove('hidden');
      img.onerror=()=>wrap.classList.add('hidden');
      img.src=path;hint.textContent=assetName;
    }
  
    async function addAssetEntry(){
      const entry=document.createElement('div');
      entry.className='asset-entry';
      const eid=(crypto.randomUUID)?crypto.randomUUID():Math.random().toString(36).slice(2);
  
      entry.innerHTML=`
        <section class="q" data-q="asset">
          <h4>Equipment / Asset ID</h4>
          <div class="ac-wrap">
            <input id="asset_search_${eid}" class="ac-input" placeholder="Type or paste an asset name…">
            <button class="ac-chevron" type="button" id="asset_toggle_${eid}" aria-label="Open list">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            <div id="asset_panel_${eid}" class="ac-panel hidden"></div>
          </div>
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
        </section>
  
        <!-- UPDATED 1B BLOCK WITH LUBRICANT TYPE DROPDOWN -->
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
          </div>
  
          <div style="margin-top:12px;">
            <label class="hint">Lubricant Type</label>
            <select class="ac-input lube_type_select" name="amt_lube_type_${eid}" style="border-width:1px">
              <option value="">Select...</option>
              <optgroup label="Grease">
                <option>MOBIL UNIREX EP2</option>
                <option>MOBIL MOBILITH SHC 460</option>
              </optgroup>
              <optgroup label="Oil">
                <option>MOBIL GEAR MS100</option>
                <option>SHELL MORLINA S3 BA 220</option>
                <option>SHELL OMALA S4 WE 220</option>
                <option>SHELL OMALA S2 GX 460</option>
                <option>SHELL TELLUS S2 MX 32</option>
                <option>SHELL TELLUS S2 MX 68</option>
              </optgroup>
            </select>
          </div>
  
          <div class="hint" style="margin-top:8px;">
            Enter numbers only (decimals allowed). Leave blank if not applicable.
          </div>
        </section>
  
        <section class="q" data-q="7">
          <h4>7 — Guards in place; access safe; purge path clear?</h4>
          <div class="opts">
            <label><input type="radio" name="q7_${eid}" value="Yes"> Yes</label>
            <label><input type="radio" name="q7_${eid}" value="No"> No</label>
          </div>
        </section>
  
        <section class="q" data-q="10">
          <h4>8 — Additional comments</h4>
          <textarea class="entry-comments" placeholder="Anything else noteworthy..."></textarea>
        </section>
      `;
  
      els.assetEntries.appendChild(entry);
  
      let assetIDs=FALLBACK_ASSET_IDS;
      try{
        const rows=await window.appCore.parseCSV('assets/data/assets.csv');
        const headers=rows[0]?Object.keys(rows[0]):[];
        const idx=headers.find(h=>norm(h)==='equipment / asset id')||headers[0];
        const ids=Array.from(new Set(rows.map(r=>String(r[idx]||'').trim()).filter(Boolean)));
        if(ids.length)assetIDs=ids;
      }catch{}
  
      await buildPerEntryAssetAutocomplete(entry,assetIDs,eid);
      wireEntryDynamicBehaviours(entry);
    }
  
    // ---------- Form validation / submit ----------
    function ensureWoOrAlert(){
      const wo=(els.wo_number.value||'').trim();
      if(!wo){alert('Please enter WO#');els.wo_number.focus();return null;}
      return wo;
    }
  
    function submitThenPdf(){
      if(!ensureWoOrAlert())return;
      showToast('Pretend-submit successful ✅');
    }
  
    function clearForm(){
      ['business_unit','department','wo_number','route_search'].forEach(id=>{
        const e=document.getElementById(id);if(e)e.value='';
      });
      els.formBody.classList.add('hidden');
      els.routeGate.classList.remove('hidden');
      els.assetEntries.innerHTML='';
    }
  
    // ---------- Init ----------
    async function init(){
      if(els.exec_date&&!els.exec_date.value)els.exec_date.value=todayISO();
      if(els.exec_time&&!els.exec_time.value)els.exec_time.value=nowHHMM();
  
      document.addEventListener('input',e=>{if(e.target.closest('#captureArea'))saveDraft();});
      loadDraft();
  
      window.appCore.buildAutocomplete({
        inputId:'route_search',panelId:'route_panel',toggleId:'route_toggle',data:routeLines,
        onPick:(line)=>{els.route_search.value=line;applyGateFromValue(line);saveDraft();}
      });
  
      els.route_search.addEventListener('change',e=>{
        const v=e.target.value.trim();
        const code=v.includes(' - ')?v.split(' - ')[0]:v;
        const full=routeLines.find(l=>l.toUpperCase().startsWith(code.toUpperCase()+' - '))||v;
        e.target.value=full;applyGateFromValue(full);saveDraft();
      });
  
      els.route_search.addEventListener('keydown',e=>{
        if(e.key==='Enter'){
          const v=e.target.value.trim();
          const code=v.includes(' - ')?v.split(' - ')[0]:v;
          const full=routeLines.find(l=>l.toUpperCase().startsWith(code.toUpperCase()+' - '))||v;
          els.route_search.value=full;applyGateFromValue(full);saveDraft();
        }
      });
  
      els.submitBtn.addEventListener('click',submitThenPdf);
      els.clearBtn.addEventListener('click',()=>{clearForm();clearDraft();showToast('Form cleared');});
  
      applyGateFromValue(els.route_search.value);
    }
  
    document.addEventListener('DOMContentLoaded',init);
  })();
  
