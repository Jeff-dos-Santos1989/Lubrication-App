/* LUBRICANT CONSUMPTION – unified data model
   record = { wo, asset, lubricantType, amount, unit, date: Date } */

   const LS_KEY = 'QAQC_CONSUMPTION_V1';

   const els = {
     // controls
     period: document.getElementById('cons_period'),
     groupby: document.getElementById('cons_groupby'),
     chart: document.getElementById('cons_chart'),
     // actions
     btn_export: document.getElementById('btnExportCsv'),
     btn_import: document.getElementById('btnImportCsv'),
     import_file: document.getElementById('imp_file'),
     // filters
     f_wo: document.getElementById('f_wo'),
     f_asset: document.getElementById('f_asset'),
     f_type: document.getElementById('f_type'),
     f_from: document.getElementById('f_from'),
     f_to: document.getElementById('f_to'),
     btn_apply: document.getElementById('btnApplyFilters'),
     btn_clear: document.getElementById('btnClearFilters'),
     // table
     table: document.querySelector('#cons_table tbody'),
     // add record
     c_wo: document.getElementById('c_wo'),
     c_asset: document.getElementById('c_asset'),
     c_amount: document.getElementById('c_amount'),
     c_unit: document.getElementById('c_unit'),
     c_type: document.getElementById('c_type'),
     c_time: document.getElementById('c_time'),
     btn_add: document.getElementById('btnAddRecord'),
     btn_prefill: document.getElementById('btnPrefill'),
   };
   
   let records = [];
   let chart;
   
   /* ---------- storage ---------- */
   function load() {
     try {
       const raw = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
       records = raw.map(r => ({
         wo: r.wo || '',
         asset: r.asset || '',
         lubricantType: r.lubricantType || '',
         amount: Number(r.amount) || 0,
         unit: r.unit || 'g',
         date: r.date ? new Date(r.date) : new Date()
       }));
     } catch {
       records = [];
     }
   }
   function save() {
     localStorage.setItem(LS_KEY, JSON.stringify(records));
   }
   
   /* ---------- utils ---------- */
   function ymd(d) { return d.toISOString().slice(0,10); }
   function monthKey(d) { return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0'); }
   function yearKey(d) { return String(d.getFullYear()); }
   function fiveKey(d) { const y = d.getFullYear(); return `${Math.floor(y/5)*5}–${Math.floor(y/5)*5+4}`; }
   
   function toBaseUnit(val, unit, lubricantType) {
     // For plotting: keep grams for greases, litres for oils
     // (we’ll aggregate separately by unit to avoid mixing)
     return { value: Number(val)||0, unit: unit === 'L' ? 'L' : 'g', key: unit === 'L' ? 'L' : 'g' };
   }
   
   /* ---------- filters ---------- */
   function applyFilters(list) {
     const wo = els.f_wo.value.trim().toLowerCase();
     const asset = els.f_asset.value.trim().toLowerCase();
     const type = els.f_type.value.trim();
     const from = els.f_from.value ? new Date(els.f_from.value) : null;
     const to = els.f_to.value ? new Date(els.f_to.value) : null;
   
     return list.filter(r => {
       if (wo && !(r.wo||'').toLowerCase().includes(wo)) return false;
       if (asset && !(r.asset||'').toLowerCase().includes(asset)) return false;
       if (type && r.lubricantType !== type) return false;
       if (from && r.date < from) return false;
       if (to && r.date > new Date(to.getTime()+86400000-1)) return false;
       return true;
     });
   }
   
   /* ---------- table ---------- */
   function renderTable(list) {
     els.table.innerHTML = list.map(r => {
       const date = r.date instanceof Date ? r.date : new Date(r.date);
       return `<tr>
         <td>${date.toLocaleString()}</td>
         <td>${r.wo || ''}</td>
         <td>${r.asset || ''}</td>
         <td>${r.lubricantType || ''}</td>
         <td style="text-align:right">${(Number(r.amount)||0).toLocaleString(undefined,{maximumFractionDigits:3})}</td>
         <td>${r.unit}</td>
       </tr>`;
     }).join('');
   }
   
   /* ---------- chart ---------- */
   function ensureChart() {
     if (chart) return chart;
     chart = new Chart(els.chart, {
       type: 'line',
       data: { labels: [], datasets: [] },
       options: {
         responsive: true,
         maintainAspectRatio: false,
         interaction: { mode: 'index', intersect: false },
         plugins: { legend: { position: 'bottom' } },
         scales: {
           y: { beginAtZero: true, title: { display: true, text: 'Quantity (g or L)' } }
         }
       }
     });
     return chart;
   }
   
   function buildSeries(list) {
     const period = els.period.value;           // month | year | 5y
     const groupby = els.groupby.value;         // total | lubricantType | assetId
   
     const keyFn = period === 'month' ? monthKey : period === 'year' ? yearKey : fiveKey;
   
     const buckets = new Map(); // label -> { (group)->{g:sum, L:sum} }
     for (const r of list) {
       const label = keyFn(r.date);
       const group = (groupby === 'lubricantType') ? (r.lubricantType || 'Unknown')
                   : (groupby === 'assetId') ? (r.asset || 'Unknown')
                   : 'Total';
   
       const base = toBaseUnit(r.amount, r.unit, r.lubricantType); // {value, unit, key}
       if (!buckets.has(label)) buckets.set(label, new Map());
       const m = buckets.get(label);
       if (!m.has(group)) m.set(group, { g:0, L:0 });
       m.get(group)[base.key] += base.value;
     }
   
     // all labels sorted chronologically
     const labels = Array.from(buckets.keys()).sort((a,b)=>a.localeCompare(b));
     // all groups
     const groups = new Set();
     for (const m of buckets.values()) for (const g of m.keys()) groups.add(g);
   
     // Build datasets (split by unit to avoid mixing)
     const datasets = [];
     const palette = (i) => undefined; // let Chart.js pick
   
     let idx = 0;
     for (const g of groups) {
       // grams
       const dataG = labels.map(l => (buckets.get(l).get(g)||{g:0}).g || 0);
       if (dataG.some(v=>v>0)) {
         datasets.push({ label: `${g} (g)`, data: dataG, borderWidth: 2, pointRadius: 2 });
       }
       // litres
       const dataL = labels.map(l => (buckets.get(l).get(g)||{L:0}).L || 0);
       if (dataL.some(v=>v>0)) {
         datasets.push({ label: `${g} (L)`, data: dataL, borderWidth: 2, pointRadius: 2 });
       }
       idx++;
     }
   
     return { labels, datasets };
   }
   
   function render() {
     const list = applyFilters(records);
     renderTable(list);
     const {labels, datasets} = buildSeries(list);
     const ch = ensureChart();
     ch.data.labels = labels;
     ch.data.datasets = datasets;
     ch.update();
   }
   
   /* ---------- add record ---------- */
   function addRecordFromUI() {
     const wo = els.c_wo.value.trim();
     const asset = els.c_asset.value.trim();
     const amount = Number(els.c_amount.value);
     const unit = els.c_unit.value;
     const lubricantType = els.c_type.value;
     const date = els.c_time.value ? new Date(els.c_time.value) : new Date();
   
     if (!(amount > 0)) { toast('Enter a valid amount', 'error'); return; }
   
     records.push({ wo, asset, lubricantType, amount, unit, date });
     save();
     render();
     toast('Record added ✓');
     // keep fields, or clear as you prefer:
     // els.c_amount.value = '';
   }
   
   /* ---------- CSV import/export ---------- */
   function toCSV(list) {
     const head = ['date','wo','asset','lubricantType','amount','unit'];
     const rows = list.map(r => [
       new Date(r.date).toISOString(),
       r.wo||'',
       r.asset||'',
       r.lubricantType||'',
       r.amount,
       r.unit
     ]);
     return [head.join(','), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(','))].join('\n');
   }
   
   function exportCSV() {
     const blob = new Blob([toCSV(applyFilters(records))], {type:'text/csv;charset=utf-8;'});
     const a = document.createElement('a');
     a.href = URL.createObjectURL(blob);
     a.download = 'consumption.csv';
     a.click();
     URL.revokeObjectURL(a.href);
   }
   
   function parseCsv(text) {
     // super-light CSV (no newlines in fields)
     const lines = text.trim().split(/\r?\n/);
     const rows = lines.map(l => l.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(s => s.replace(/^"|"$/g,'').replace(/""/g,'"')));
     return rows;
   }
   
   async function importCSV(file) {
     const reader = new FileReader();
     reader.onload = () => {
       try {
         const rows = parseCsv(reader.result);
         const head = rows[0].map(h => h.toLowerCase());
         const idx = (name) => head.indexOf(name);
         const idd = {
           date: idx('date'),
           wo: idx('wo'),
           asset: idx('asset'),
           type: idx('lubricanttype'),
           amount: idx('amount'),
           unit: idx('unit')
         };
         const imported = rows.slice(1).map(r => ({
           date: new Date(r[idd.date] || new Date()),
           wo: r[idd.wo] || '',
           asset: r[idd.asset] || '',
           lubricantType: r[idd.type] || '',
           amount: Number(r[idd.amount]) || 0,
           unit: r[idd.unit] || 'g'
         })).filter(x => x.amount > 0 && x.lubricantType);
   
         if (!imported.length) return toast('No valid rows found in CSV', 'error');
         records = records.concat(imported);
         save();
         render();
         toast(`Imported ${imported.length} record(s) ✓`);
       } catch (e) {
         console.error(e);
         toast('Failed to import CSV', 'error');
       }
     };
     reader.readAsText(file);
   }
   
   /* ---------- events ---------- */
   function wire() {
     els.btn_add.addEventListener('click', addRecordFromUI);
     els.btn_export.addEventListener('click', exportCSV);
     els.btn_import.addEventListener('click', () => els.import_file.click());
     els.import_file.addEventListener('change', (e) => importCSV(e.target.files?.[0]));
   
     els.btn_apply.addEventListener('click', render);
     els.btn_clear.addEventListener('click', () => {
       els.f_wo.value = '';
       els.f_asset.value = '';
       els.f_type.value = '';
       els.f_from.value = '';
       els.f_to.value = '';
       render();
     });
   
     els.period.addEventListener('change', render);
     els.groupby.addEventListener('change', render);
   
     // Optional: Prefill last form submission (if you kept that pipeline)
     els.btn_prefill?.addEventListener('click', () => {
       const q = JSON.parse(localStorage.getItem('QAQC_LAST_SUBMISSION')||'{}');
       if (!q || !q.asset) return toast('No recent QA/QC data');
       els.c_wo.value = q.wo || '';
       els.c_asset.value = q.asset || '';
       els.c_amount.value = q.amount || '';
       els.c_unit.value = q.unit || 'g';
       els.c_type.value = q.lubricantType || els.c_type.value;
       els.c_time.value = q.date ? q.date.slice(0,16) : '';
       toast('Prefilled from QA/QC ✓');
     });
   }
   
   /* ---------- init ---------- */
   function init() {
     // sensible default for quick add time
     if (!els.c_time.value) {
       const now = new Date();
       els.c_time.value = new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,16);
     }
     load();
     wire();
     render();
   }
   document.addEventListener('DOMContentLoaded', init);

   /* === Live auto-refresh hooks ========================================== */
  /* 1) Same-tab broadcast from form.js */
  window.addEventListener('consumption:record-added', (ev) => {
    try {
      // ev.detail.count is sent by form.js (how many records were added)
      if (typeof load === 'function') load();
      if (typeof render === 'function') render();
      if (window.appCore?.showToast && ev?.detail?.count) {
        window.appCore.showToast(`New QA/QC record added (${ev.detail.count}) ✓`, 'info', 1800);
      }
    } catch (e) { console.warn('live refresh failed:', e); }
  });

  /* 2) Cross-tab storage events (fires when another tab updates the store) */
  window.addEventListener('storage', (e) => {
    if (e.key === 'QAQC_CONSUMPTION_V1') {
      try {
        if (typeof load === 'function') load();
        if (typeof render === 'function') render();
        if (window.appCore?.showToast) {
          window.appCore.showToast('Consumption updated from another tab ✓', 'info', 1500);
        }
      } catch (err) { console.warn('storage refresh failed:', err); }
    }
  });
  /* ===================================================================== */

   