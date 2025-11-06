/* LUBRICANT CONSUMPTION – unified data model
   record = { wo, asset, lubricantType, amount, unit, date: Date }
*/
const LS_KEY = 'QAQC_CONSUMPTION_V1';

// ---- Lubricant Definitions ----
const LUBRICANT_LISTS = {
  GREASE: [
    'MOBIL UNIREX EP2',
    'MOBIL MOBILITH SHC 460'
  ],
  OIL: [
    'MOBIL GEAR MS100',
    'SHELL MORLINA S3 BA 220',
    'SHELL OMALA S4 WE 220',
    'SHELL OMALA S2 GX 460',
    'SHELL TELLUS S2 MX 32',
    'SHELL TELLUS S2 MX 68'
  ]
};
const ALL_LUBRICANTS = [...LUBRICANT_LISTS.GREASE, ...LUBRICANT_LISTS.OIL];

// ---- Global Elements (Add Record / Import) ----
const globalEls = {
  // actions
  btn_import: document.getElementById('btnImportCsv'),
  import_file: document.getElementById('imp_file'),
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

let allRecords = [];
let greaseController, oilController;

// ---- storage ----
function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
    allRecords = raw.map(r => ({
      wo: r.wo || '',
      asset: r.asset || '',
      lubricantType: r.lubricantType || '',
      amount: Number(r.amount) || 0,
      unit: r.unit || 'g',
      date: r.date ? new Date(r.date) : new Date()
    }));
  } catch {
    allRecords = [];
  }
}
function save() {
  localStorage.setItem(LS_KEY, JSON.stringify(allRecords));
}

// ---- assets dropdown source ----
const FALLBACK_ASSETS = [
  'BRU - 001 - ENTRY ROLL - BRIDLE ROLL UNIT 2 - Driven Side',
  'BRU - 002 - ENTRY ROLL - BRIDLE ROLL UNIT 2 - OPS Side',
  'BRU - 003 - MIDDLE ROLL - BRIDLE ROLL UNIT 2 - Driven Side',
  'DFR - 286 - DELFECTOR ROLL ASSEMBLY E3A - OPS Side'
];

function getAssetList() {
  // 1) from QAQC form (if provided)
  let fromForm = [];
  try {
    const arr = JSON.parse(localStorage.getItem('QAQC_ASSET_LIST') || '[]');
    if (Array.isArray(arr)) fromForm = arr;
  } catch {}
  // 2) unique assets from existing consumption records
  const fromRecords = Array.from(new Set(allRecords.map(r => r.asset).filter(Boolean)));
  // 3) fallback
  const all = Array.from(new Set([...fromForm, ...fromRecords, ...FALLBACK_ASSETS]));
  return all.sort((a,b)=>a.localeCompare(b));
}

function populateAssetSelect(selectEl, includeAny=false) {
  if (!selectEl) return;
  const current = selectEl.value;
  const list = getAssetList();
  selectEl.innerHTML = '';
  if (includeAny) {
    const optAny = document.createElement('option');
    optAny.value = '';
    optAny.textContent = '— any —';
    selectEl.appendChild(optAny);
  }
  for (const a of list) {
    const opt = document.createElement('option');
    opt.value = a;
    opt.textContent = a;
    selectEl.appendChild(opt);
  }
  // try to preserve selection if still present
  if (current && list.includes(current)) selectEl.value = current;
}

// ---- utils ----
function ymd(d) { return d.toISOString().slice(0,10); }
function monthKey(d) { return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0'); }
function yearKey(d) { return String(d.getFullYear()); }
function fiveKey(d) { const y = d.getFullYear(); return `${Math.floor(y/5)*5}–${Math.floor(y/5)*5+4}`; }
function toBaseUnit(val, unit) {
  return { value: Number(val)||0, unit: unit === 'L' ? 'L' : 'g', key: unit === 'L' ? 'L' : 'g' };
}
function toast(txt, kind='info'){
  if (window.appCore?.showToast) return window.appCore.showToast(txt, kind, 1600);
  console.log(`[${kind}] ${txt}`);
}
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
function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const rows = lines.map(l => l.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(s => s.replace(/^"|"$/g,'').replace(/""/g,'"')));
  return rows;
}


// ===================================================================
// ---- SECTION CONTROLLER FACTORY ----
// ===================================================================
function createConsumptionSection(type, elementPrefix, lubricantList) {
  const els = {
    // controls
    period: document.getElementById(`${elementPrefix}_cons_period`),
    groupby: document.getElementById(`${elementPrefix}_cons_groupby`),
    chart: document.getElementById(`${elementPrefix}_cons_chart`),
    // actions
    btn_export: document.getElementById(`${elementPrefix}_btnExportCsv`),
    // filters
    f_wo: document.getElementById(`${elementPrefix}_f_wo`),
    f_asset: document.getElementById(`${elementPrefix}_f_asset`),
    f_type: document.getElementById(`${elementPrefix}_f_type`),
    f_from: document.getElementById(`${elementPrefix}_f_from`),
    f_to: document.getElementById(`${elementPrefix}_f_to`),
    btn_apply: document.getElementById(`${elementPrefix}_btnApplyFilters`),
    btn_clear: document.getElementById(`${elementPrefix}_btnClearFilters`),
    // table
    table: document.querySelector(`#${elementPrefix}_cons_table tbody`),
  };

  let chart = null;
  let currentFilteredRecords = [];

  // ---- Populate this section's lubricant filter ----
  function populateLubricantSelect() {
    if (!els.f_type) return;
    els.f_type.innerHTML = '';
    const optAny = document.createElement('option');
    optAny.value = '';
    optAny.textContent = `All ${type} Types`;
    els.f_type.appendChild(optAny);
    
    for (const lub of lubricantList) {
      const opt = document.createElement('option');
      opt.value = lub;
      opt.textContent = lub;
      els.f_type.appendChild(opt);
    }
  }

  // ---- filters ----
  function applyFilters(list) {
    // 1. Filter by section type (Grease/Oil)
    const sectionRecords = list.filter(r => lubricantList.includes(r.lubricantType));
    
    // 2. Apply user filters
    const wo = els.f_wo.value.trim().toLowerCase();
    const asset = els.f_asset.value.trim().toLowerCase();
    const typeFilter = els.f_type.value.trim();
    const from = els.f_from.value ? new Date(els.f_from.value) : null;
    const to = els.f_to.value ? new Date(els.f_to.value) : null;

    currentFilteredRecords = sectionRecords.filter(r => {
      if (wo && !(r.wo||'').toLowerCase().includes(wo)) return false;
      if (asset && (r.asset||'').toLowerCase() !== asset) return false;
      if (typeFilter && r.lubricantType !== typeFilter) return false;
      if (from && r.date < from) return false;
      if (to && r.date > new Date(to.getTime()+86400000-1)) return false;
      return true;
    });
    return currentFilteredRecords;
  }

  // ---- table ----
  function renderTable(list) {
    els.table.innerHTML = list.map(r => {
      const date = r.date instanceof Date ? r.date : new Date(r.date);
      return `<tr>
        <td>${date.toLocaleString()}</td>
        <td>${r.wo || ''}</td>
        <td>${r.asset || ''}</td>
        <td>${r.lubricantType || ''}</td>
        <td class="right">${(Number(r.amount)||0).toLocaleString(undefined,{maximumFractionDigits:3})}</td>
        <td>${r.unit}</td>
      </tr>`;
    }).join('');
  }

  // ---- chart ----
  function ensureChart() {
    if (chart) return chart;
    const yAxisLabel = type === 'Grease' ? 'Quantity (g)' : 'Quantity (L)';
    chart = new Chart(els.chart, {
      type: 'line',
      data: { labels: [], datasets: [] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { position: 'bottom' } },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: yAxisLabel } }
        }
      }
    });
    return chart;
  }

  function buildSeries(list) {
    const period = els.period.value;
    const groupby = els.groupby.value;
    const keyFn = period === 'month' ? monthKey : period === 'year' ? yearKey : fiveKey;

    const buckets = new Map();
    for (const r of list) {
      const label = keyFn(r.date);
      const group = (groupby === 'lubricantType') ? (r.lubricantType || 'Unknown')
                  : (groupby === 'assetId') ? (r.asset || 'Unknown')
                  : 'Total';
      const base = toBaseUnit(r.amount, r.unit);
      if (!buckets.has(label)) buckets.set(label, new Map());
      const m = buckets.get(label);
      if (!m.has(group)) m.set(group, { g:0, L:0 });
      m.get(group)[base.key] += base.value;
    }

    const labels = Array.from(buckets.keys()).sort((a,b)=>a.localeCompare(b));
    const groups = new Set();
    for (const m of buckets.values()) for (const g of m.keys()) groups.add(g);

    const datasets = [];
    for (const g of groups) {
      const dataG = labels.map(l => (buckets.get(l).get(g)||{g:0}).g || 0);
      if (dataG.some(v=>v>0)) datasets.push({ label: `${g} (g)`, data: dataG, borderWidth: 2, pointRadius: 2 });
      const dataL = labels.map(l => (buckets.get(l).get(g)||{L:0}).L || 0);
      if (dataL.some(v=>v>0)) datasets.push({ label: `${g} (L)`, data: dataL, borderWidth: 2, pointRadius: 2 });
    }
    
    // Filter datasets by unit
    const targetUnitSuffix = (type === 'Grease') ? '(g)' : '(L)';
    const finalDatasets = datasets.filter(ds => ds.label.endsWith(targetUnitSuffix));
    
    return { labels, datasets: finalDatasets };
  }

  // ---- main render function for this section ----
  function render() {
    // refresh asset dropdown
    populateAssetSelect(els.f_asset, true);

    const list = applyFilters(allRecords); // Filter from global list
    renderTable(list);
    const {labels, datasets} = buildSeries(list);
    const ch = ensureChart();
    ch.data.labels = labels;
    ch.data.datasets = datasets;
    ch.update();
  }

  // ---- CSV export ----
  function exportCSV() {
    const blob = new Blob([toCSV(currentFilteredRecords)], {type:'text/csv;charset=utf-8;'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${type.toLowerCase()}_consumption.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ---- events ----
  function wire() {
    els.btn_export.addEventListener('click', exportCSV);
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
  }

  // ---- init this section ----
  populateLubricantSelect();
  wire();
  
  return {
    render // Expose the render function
  };
}
// ===================================================================
// ---- END OF SECTION CONTROLLER ----
// ===================================================================

// ---- add record ----
function populateAllLubricantSelect(selectEl) {
    if (!selectEl) return;
    selectEl.innerHTML = '';
    
    const greaseGroup = document.createElement('optgroup');
    greaseGroup.label = 'Grease';
    LUBRICANT_LISTS.GREASE.forEach(lub => {
        const opt = document.createElement('option');
        opt.value = lub;
        opt.textContent = lub;
        greaseGroup.appendChild(opt);
    });
    selectEl.appendChild(greaseGroup);

    const oilGroup = document.createElement('optgroup');
    oilGroup.label = 'Oil';
    LUBRICANT_LISTS.OIL.forEach(lub => {
        const opt = document.createElement('option');
        opt.value = lub;
        opt.textContent = lub;
        oilGroup.appendChild(opt);
    });
    selectEl.appendChild(oilGroup);
}

function addRecordFromUI() {
  const wo = globalEls.c_wo.value.trim();
  const asset = globalEls.c_asset.value.trim();
  const amount = Number(String(globalEls.c_amount.value).replace(/[^0-9.]/g,''));
  const unit = globalEls.c_unit.value;
  const lubricantType = globalEls.c_type.value;
  const date = globalEls.c_time.value ? new Date(globalEls.c_time.value) : new Date();

  if (!asset) { toast('Choose an asset', 'error'); return; }
  if (!(amount > 0)) { toast('Enter a valid amount', 'error'); return; }
  if (!lubricantType) { toast('Choose a lubricant type', 'error'); return; }

  allRecords.push({ wo, asset, lubricantType, amount, unit, date });
  save();
  
  // Re-render both sections
  greaseController.render();
  oilController.render();
  
  toast('Record added ✓');
  
  // Clear amount
  globalEls.c_amount.value = '';
}

// ---- CSV import ----
async function importCSV(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const rows = parseCsv(reader.result);
      const head = rows[0].map(h => h.toLowerCase());
      const idx = (name) => head.indexOf(name);
      const idd = {
        date: idx('date'), wo: idx('wo'), asset: idx('asset'),
        type: idx('lubricanttype'), amount: idx('amount'), unit: idx('unit')
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
      allRecords = allRecords.concat(imported);
      save();
      
      // Re-render both sections
      greaseController.render();
      oilController.render();
      
      toast(`Imported ${imported.length} record(s) ✓`);
    } catch (e) {
      console.error(e);
      toast('Failed to import CSV', 'error');
    }
  };
  reader.readAsText(file);
  globalEls.import_file.value = null; // Clear file input
}

// ---- Global events ----
function wireGlobal() {
  globalEls.btn_add.addEventListener('click', addRecordFromUI);
  globalEls.btn_import.addEventListener('click', () => globalEls.import_file.click());
  globalEls.import_file.addEventListener('change', (e) => importCSV(e.target.files?.[0]));

  // Numeric guard on amount field
  globalEls.c_amount.addEventListener('input', () => {
    let v = String(globalEls.c_amount.value).replace(/[^0-9.]/g,'');
    const dot = v.indexOf('.');
    if (dot !== -1) v = v.slice(0, dot+1) + v.slice(dot+1).replace(/\./g,'');
    globalEls.c_amount.value = v;
  });

  // Prefill from QA/QC
  globalEls.btn_prefill?.addEventListener('click', () => {
    const q = JSON.parse(localStorage.getItem('QAQC_LAST_SUBMISSION')||'{}');
    if (!q || !q.asset) return toast('No recent QA/QC data');
    globalEls.c_wo.value = q.wo || '';
    populateAssetSelect(globalEls.c_asset, false);
    if (q.asset) globalEls.c_asset.value = q.asset;
    globalEls.c_amount.value = q.amount || '';
    globalEls.c_unit.value = q.unit || 'g';
    if (q.lubricantType) globalEls.c_type.value = q.lubricantType;
    globalEls.c_time.value = q.date ? q.date.slice(0,16) : globalEls.c_time.value;
    toast('Prefilled from QA/QC ✓');
  });
}

// ---- init ----
function init() {
  // sensible default for quick add time
  if (!globalEls.c_time.value) {
    const now = new Date();
    globalEls.c_time.value = new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,16);
  }
  load();
  
  // build global selects
  populateAssetSelect(globalEls.c_asset, false);
  populateAllLubricantSelect(globalEls.c_type);
  
  // wire global events
  wireGlobal();
  
  // Create controllers
  greaseController = createConsumptionSection('Grease', 'grease', LUBRICANT_LISTS.GREASE);
  oilController = createConsumptionSection('Oil', 'oil', LUBRICANT_LISTS.OIL);
  
  // Initial render
  greaseController.render();
  oilController.render();
}
document.addEventListener('DOMContentLoaded', init);

// === Live auto-refresh hooks ================================================
function refreshAll() {
  try {
    load();
    greaseController?.render();
    oilController?.render();
  } catch(e) {}
}
// 1) Same-tab broadcast from form.js
window.addEventListener('consumption:record-added', refreshAll);
// 2) Cross-tab storage events
window.addEventListener('storage', (e) => {
  if (e.key === LS_KEY) { refreshAll(); }
});
