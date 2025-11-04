/* app-core.js — Shared utilities for QA/QC application
-------------------------------------------------------*/

/* Root variables (used globally) */
const appCore = {
  brand: "#ff4d00",
  line: "#e6e6ef",
  muted: "#666"
};

/* -----------------------------
   Toast Notification (popup)
----------------------------- */
function showToast(message, type = "info", duration = 2500) {
  const toast = document.createElement("div");
  toast.textContent = message;
  toast.style.position = "fixed";
  toast.style.bottom = "24px";
  toast.style.left = "50%";
  toast.style.transform = "translateX(-50%)";
  toast.style.padding = "12px 18px";
  toast.style.background = type === "error" ? "#d92b2b" : appCore.brand;
  toast.style.color = "#fff";
  toast.style.borderRadius = "8px";
  toast.style.fontWeight = "600";
  toast.style.fontSize = "14px";
  toast.style.boxShadow = "0 4px 12px rgba(0,0,0,.2)";
  toast.style.zIndex = "9999";
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

/* -----------------------------
   CSV Parser → JSON
----------------------------- */
async function parseCSV(path) {
  const resp = await fetch(path);
  if (!resp.ok) throw new Error("Failed to load " + path);
  const text = await resp.text();

  const lines = text.trim().split(/\r?\n/);
  const headers = lines.shift().split(",").map(h => h.trim());
  const data = lines.map(line => {
    const values = line.split(",");
    const obj = {};
    headers.forEach((h, i) => obj[h] = values[i] ? values[i].trim() : "");
    return obj;
  });
  return data;
}

/* -----------------------------
   Autocomplete Builder
----------------------------- */
function buildAutocomplete({ inputId, panelId, toggleId, data, onPick }) {
  const input = document.getElementById(inputId);
  const panel = document.getElementById(panelId);
  const toggle = document.getElementById(toggleId);

  function render(filterText) {
    panel.innerHTML = "";
    const txt = (filterText || "").toLowerCase();
    const list = data.filter(line => line.toLowerCase().includes(txt));
    if (list.length === 0) {
      const div = document.createElement("div");
      div.className = "ac-empty";
      div.textContent = "No matches found.";
      panel.appendChild(div);
    } else {
      list.forEach(line => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "ac-item";
        b.textContent = line;
        b.addEventListener("click", () => {
          input.value = line;
          hide();
          onPick && onPick(line);
        });
        panel.appendChild(b);
      });
    }
    show();
  }

  function show() { panel.classList.remove("hidden"); }
  function hide() { panel.classList.add("hidden"); }

  input.addEventListener("focus", () => render(input.value));
  toggle.addEventListener("click", () => {
    if (panel.classList.contains("hidden")) render(input.value);
    else hide();
  });
  input.addEventListener("input", () => render(input.value.trim()));
  input.addEventListener("blur", () => setTimeout(hide, 120));
  panel.addEventListener("mousedown", e => e.preventDefault());
}

/* -----------------------------
   Utility: load asset image
----------------------------- */
function loadAssetImage(assetName, imgEl, captionEl) {
  const imgPath = `Images/${assetName}.png`;
  imgEl.onload = () => { imgEl.classList.remove("hidden"); };
  imgEl.onerror = () => {
    imgEl.classList.add("hidden");
    captionEl.textContent = "Image not found.";
  };
  imgEl.src = imgPath;
  captionEl.textContent = assetName;
}

/* Expose globally */
window.appCore = { showToast, parseCSV, buildAutocomplete, loadAssetImage };
