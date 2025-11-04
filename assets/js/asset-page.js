// --- Tiny CSV parser (robust for your dataset) ---
function parseCsv(text) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').filter(l => l.trim().length);
  const rows = [];
  for (const ln of lines) {
    const out = [];
    let cur = '', inQ = false;
    for (let i = 0; i < ln.length; i++) {
      const ch = ln[i], nx = ln[i+1];
      if (inQ) {
        if (ch === '"' && nx === '"') { cur += '"'; i++; }
        else if (ch === '"') { inQ = false; }
        else { cur += ch; }
      } else {
        if (ch === ',') { out.push(cur); cur = ''; }
        else if (ch === '"') { inQ = true; }
        else { cur += ch; }
      }
    }
    out.push(cur);
    rows.push(out);
  }
  return rows;
}

// --- Load IDs from CSV (your “previous” behavior preserved) ---
async function loadAssetIDs() {
  try {
    const res = await fetch('assets/data/assets.csv', { cache: 'no-store' });
    if (!res.ok) throw new Error('CSV not found');
    const text = await res.text();
    const rows = parseCsv(text);
    if (!rows.length) throw new Error('Empty CSV');

    // Normalize header and find the Asset ID column
    const header = rows[0].map(s => (s||'').toLowerCase().replace(/\s+/g,' ').trim());
    let idx = header.indexOf('equipment / asset id');
    if (idx === -1) idx = header.indexOf('equipment/asset id');
    if (idx === -1) idx = header.indexOf('asset id');
    if (idx === -1) throw new Error('No "Equipment / Asset ID" column');

    const list = rows.slice(1).map(r => (r[idx]||'').trim()).filter(Boolean);
    // De-dup & sort (your original approach)
    return [...new Set(list)].sort((a,b)=>a.localeCompare(b));
  } catch (e) {
    console.warn('Falling back to built-in asset list:', e.message);
    return [
      'BRU - 001 - ENTRY ROLL - BRIDLE ROLL UNIT 2 - Driven Side',
      'BRU - 002 - ENTRY ROLL - BRIDLE ROLL UNIT 2 - OPS Side',
      'BRU - 003 - MIDDLE ROLL - BRIDLE ROLL UNIT 2 - Driven Side',
      'DFR - 286 - DELFECTOR  ROLL ASSEMBLY E3A - OPS Side'
    ];
  }
}

// ---------- Minimal autocomplete ----------
function simpleAutocomplete({ inputId, panelId, toggleId, data, onPick }) {
  const input  = document.getElementById(inputId);
  const panel  = document.getElementById(panelId);
  const toggle = document.getElementById(toggleId);

  function showList(filter = '') {
    const f = (filter||'').toLowerCase().trim();
    const items = data.filter(v => v.toLowerCase().includes(f)).slice(0, 200);
    panel.innerHTML = items.length
      ? items.map(v => `<button type="button" class="ac-item">${v}</button>`).join('')
      : `<div class="ac-empty">No matches</div>`;
    panel.classList.remove('hidden');
  }
  function hideList() { panel.classList.add('hidden'); }

  panel.addEventListener('mousedown', e => {
    const b = e.target.closest('.ac-item');
    if (!b) return;
    e.preventDefault();
    input.value = b.textContent;
    hideList();
    onPick && onPick(b.textContent);
  });

  input.addEventListener('focus', () => showList(input.value));
  input.addEventListener('input', () => showList(input.value));
  input.addEventListener('blur', () => setTimeout(hideList, 150));
  toggle?.addEventListener('click', () => {
    if (panel.classList.contains('hidden')) showList(input.value);
    else hideList();
  });
}

// ---------- Table & image helpers ----------
let __assetRows = [];      // full CSV rows (including header)
let __assetHeader = [];    // normalized header

function getColIdx(candidates) { // array of acceptable variants
  const norm = s => (s||'').toLowerCase().replace(/\s+/g,' ').trim();
  for (const n of candidates) {
    const i = __assetHeader.indexOf(norm(n));
    if (i !== -1) return i;
  }
  return -1;
}

function renderProfileFor(assetName) {
  if (!assetName || !assetName.trim()) return;

  const section = document.getElementById('assetProfile');
  const img     = document.getElementById('asset_img');
  const caption = document.getElementById('asset_caption');
  const tbl     = document.getElementById('asset_table');
  const empty   = document.getElementById('profileEmpty');

  section.classList.remove('hidden');

  // Image path = Images/<Asset ID>.png (your current convention without '#')
  const safe = assetName.trim();
  img.src = `Images/${safe}.png`;
  img.alt = `Asset reference image: ${safe}`;
  caption.textContent = safe;
  img.onerror = () => { img.removeAttribute('src'); };

  // If CSV not loaded, show empty message
  if (!__assetRows.length) {
    tbl.classList.add('hidden');
    empty.classList.remove('hidden');
    return;
  }

  // Find the row by exact Equipment / Asset ID (now without '#', as per your CSV)
  const idxAsset = getColIdx(['equipment / asset id','equipment/asset id','asset id','equipment']);
  let row = null;
  if (idxAsset !== -1) {
    row = __assetRows.slice(1).find(r => (r[idxAsset]||'').trim() === safe) || null;
  }

  if (!row) {
    tbl.classList.add('hidden');
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');

  // Build table with preferred labels + flexible header matching
  const fields = [
    ['Equipment / Asset ID', ['equipment / asset id','equipment/asset id','asset id','equipment']],
    ['Manufacturer Code Pillow Block', ['manufacturer code pillow block']],
    ['Manufacturer Pillow Block', ['manufacturer pillow block']],
    ['Manufacturer Code Bearing', ['manufacturer code bearing']],
    ['Manufacturer Bearing', ['manufacturer bearing']],
    ['Bearing Type', ['bearing type']],
    ['Lubricant Type', ['lubricant type']],
    ['Grease Fitting Position', ['grease fitting position']],
    ['Bearing Volume', ['bearing volume','bearing volume (cm3)','bearing volume (cm³)']],
    ['Pillow Block 1st Fill %', ['pillow block 1st fill %','first fill %']],
    ['Pillow Block 1st Fill g', ['pillow block 1st fill g','first fill g']],
    ['Lubrication Grease (g)', ['lubrication grease (g)','amount g']],
    ['Lubrication Period (weeks)', ['lubrication period (weeks)','period (weeks)']],
    ['Line Section', ['line section']]
  ];

  const rowsHtml = fields.map(([label, candidates]) => {
    const i = getColIdx(candidates);
    const v = (i === -1 ? '' : (row[i] ?? '')).toString().trim();
    return `<tr><th>${label}</th><td>${v || '—'}</td></tr>`;
  }).join('');

  tbl.innerHTML = `<tbody>${rowsHtml}</tbody>`;
  tbl.classList.remove('hidden');
}

// ---------- Init ----------
(async function initAssetPage(){
  try {
    // 1) Load IDs for the dropdown
    const list = await loadAssetIDs();

    // 2) Try to load the CSV fully so we can render the table
    try {
      const res = await fetch('assets/data/assets.csv', { cache:'no-store' });
      if (res.ok) {
        const text = await res.text();
        const rows = parseCsv(text);
        if (rows.length) {
          __assetHeader = rows[0].map(s => (s||'').toLowerCase().replace(/\s+/g,' ').trim());
          __assetRows = rows;
        }
      } else {
        console.warn('CSV fetch responded with', res.status, res.statusText);
      }
    } catch (err) {
      console.warn('CSV fetch failed (run via http(s) localhost to enable):', err);
    }

    // 3) Wire dropdown
    simpleAutocomplete({
      inputId: 'asset_search',
      panelId: 'asset_panel',
      toggleId: 'asset_toggle',
      data: list,
      onPick: (name) => renderProfileFor(name)
    });

    // Allow Enter to render if user types exact text
    const inp = document.getElementById('asset_search');
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') renderProfileFor(inp.value);
    });

  } catch (err) {
    console.error('Asset page init failed:', err);
  }
})();
