/*
 * Account Colors - Options Page (WebExtension context)
 *
 * Preferences are stored in browser.storage.local under the "prefs" key
 * as a flat { key: value } object.  Default values come from the shared
 * accountcolors-defaults.js loaded via a <script> tag.
 *
 * Changes take effect immediately — every control modification triggers
 * a save and rule regeneration.
 */

// Default prefs loaded from shared script
let defaultPrefs = ACCOUNTCOLORS_DEFAULT_PREFS;
// Loaded from browser.storage.local: { key: userValue }
let storedPrefs = {};

// i18n: replace data-i18n-* attributes with localized strings
function localizeDocument() {
  for (let el of document.querySelectorAll("[data-i18n-content]")) {
    let key = el.getAttribute("data-i18n-content");
    let msg = messenger.i18n.getMessage(key);
    if (msg) el.textContent = msg;
  }
}

function getPref(key) {
  if (key in storedPrefs) return storedPrefs[key];
  if (key in defaultPrefs) return defaultPrefs[key];
  return undefined;
}

// Compute a light background tint from a font color (mix ~15% with white)
function fontColorToBackground(hex) {
  if (hex === "#000000") return "#FFFFFF";
  let r = 255 - Math.round((255 - parseInt(hex.substring(1, 3), 16)) / 8.5);
  let g = 255 - Math.round((255 - parseInt(hex.substring(3, 5), 16)) / 8.5);
  let b = 255 - Math.round((255 - parseInt(hex.substring(5, 7), 16)) / 8.5);
  return "#" + [r, g, b].map(c => c.toString(16).padStart(2, "0").toUpperCase()).join("");
}

// Populate font size <select> elements (10–22)
function populateFontSizeSelects() {
  for (let select of document.querySelectorAll('select[id$="fontsize"], select[id$="fromsize"]')) {
    if (select.options.length > 0) continue;
    for (let i = 10; i <= 22; i++) {
      let opt = document.createElement("option");
      opt.value = i;
      opt.textContent = i;
      select.appendChild(opt);
    }
  }
}

// Load accounts and populate the account/identity color list
async function loadAccounts() {
  let accounts = await messenger.accounts.list(false);
  let container = document.getElementById("accountidbox-container");
  container.innerHTML = "";

  let autobkgd = document.getElementById("picker-autobkgd");
  let applyall = document.getElementById("picker-applyall");
  autobkgd.checked = !!getPref("picker-autobkgd");
  applyall.checked = !!getPref("picker-applyall");

  for (let account of accounts) {
    if (account.identities.length === 0) {
      let row = createAccountRow(account.id, account.name, "", "account");
      container.appendChild(row);
    } else {
      for (let i = 0; i < account.identities.length; i++) {
        let identity = account.identities[i];
        let accountName = i === 0 ? account.name : "";
        let type = i === 0 ? "accountid" : "id";
        let identityLabel = identity.email
          ? `${identity.name} <${identity.email}>`
          : identity.name;
        let row = createAccountRow(identity.id, accountName, identityLabel, type);
        container.appendChild(row);
      }
    }
  }
}

function createAccountRow(key, accountName, identityName, type) {
  let row = document.createElement("div");
  row.className = "accountid-row";
  row.dataset.key = key;
  row.dataset.type = type;

  let nameEl = document.createElement("span");
  nameEl.className = "account-name";
  nameEl.textContent = accountName;
  if (type === "id") nameEl.style.visibility = "hidden";
  row.appendChild(nameEl);

  let idEl = document.createElement("span");
  idEl.className = "identity-name";
  idEl.textContent = identityName;
  if (type === "account") idEl.style.visibility = "hidden";
  row.appendChild(idEl);

  let fontColor = document.createElement("input");
  fontColor.type = "color";
  fontColor.className = "font-color-picker";
  fontColor.value = "#000000";
  fontColor.addEventListener("input", () => {
    delete fontColor.dataset.cleared;
    if (document.getElementById("picker-autobkgd").checked) {
      bkgdColor.value = fontColorToBackground(fontColor.value);
      delete bkgdColor.dataset.cleared;
    }
    if (document.getElementById("picker-applyall").checked && (type === "accountid" || type === "account")) {
      applyColorToAllIdentities(row, true);
    }
    updateRowPreview(row);
  });
  fontColor.addEventListener("change", () => savePrefs());
  row.appendChild(fontColor);

  let bkgdColor = document.createElement("input");
  bkgdColor.type = "color";
  bkgdColor.className = "bkgd-color-picker";
  bkgdColor.value = "#FFFFFF";
  bkgdColor.addEventListener("input", () => {
    delete bkgdColor.dataset.cleared;
    if (document.getElementById("picker-applyall").checked && (type === "accountid" || type === "account")) {
      applyColorToAllIdentities(row, false);
    }
    updateRowPreview(row);
  });
  bkgdColor.addEventListener("change", () => savePrefs());
  row.appendChild(bkgdColor);

  let resetBtn = document.createElement("button");
  resetBtn.className = "reset-btn";
  resetBtn.textContent = messenger.i18n.getMessage("accountcolors_account_reset") || "Reset";
  resetBtn.addEventListener("click", () => {
    fontColor.value = "#000000";
    bkgdColor.value = "#FFFFFF";
    fontColor.dataset.cleared = "true";
    bkgdColor.dataset.cleared = "true";
    updateRowPreview(row);
    savePrefs();
  });
  row.appendChild(resetBtn);

  // Load saved colors from storedPrefs
  let fc = getPref(key + "-fontcolor");
  let bc = getPref(key + "-bkgdcolor");
  if (fc && String(fc).match(/^#[0-9A-Fa-f]{6}$/)) {
    fontColor.value = fc;
  } else {
    fontColor.dataset.cleared = "true";
  }
  if (bc && String(bc).match(/^#[0-9A-Fa-f]{6}$/)) {
    bkgdColor.value = bc;
  } else {
    bkgdColor.dataset.cleared = "true";
  }
  updateRowPreview(row);

  return row;
}

function updateRowPreview(row) {
  let fontColor = row.querySelector(".font-color-picker");
  let bkgdColor = row.querySelector(".bkgd-color-picker");
  let nameEl = row.querySelector(".account-name");
  let idEl = row.querySelector(".identity-name");

  let fc = fontColor.dataset.cleared ? "" : fontColor.value;
  let bc = bkgdColor.dataset.cleared ? "" : bkgdColor.value;

  nameEl.style.color = fc || "";
  nameEl.style.backgroundColor = bc || "";
  idEl.style.color = fc || "";
  idEl.style.backgroundColor = bc || "";
}

function applyColorToAllIdentities(sourceRow, includeFont) {
  let fontColor = sourceRow.querySelector(".font-color-picker").value;
  let bkgdColor = sourceRow.querySelector(".bkgd-color-picker").value;
  let container = document.getElementById("accountidbox-container");
  let rows = container.querySelectorAll(".accountid-row");
  let found = false;
  for (let row of rows) {
    if (row === sourceRow) { found = true; continue; }
    if (found) {
      if (row.dataset.type === "id") {
        if (includeFont) {
          row.querySelector(".font-color-picker").value = fontColor;
          delete row.querySelector(".font-color-picker").dataset.cleared;
        }
        row.querySelector(".bkgd-color-picker").value = bkgdColor;
        delete row.querySelector(".bkgd-color-picker").dataset.cleared;
        updateRowPreview(row);
      } else {
        break;
      }
    }
  }
}

// Load all checkbox/select preferences from storedPrefs + defaults
function loadPrefs() {
  let merged = { ...defaultPrefs, ...storedPrefs };

  for (let checkbox of document.querySelectorAll('input[type="checkbox"][data-pref]')) {
    let key = checkbox.dataset.pref;
    if (key in merged) {
      checkbox.checked = !!merged[key];
    }
  }

  for (let select of document.querySelectorAll('select[data-pref]')) {
    let key = select.dataset.pref;
    if (key in merged) {
      select.value = String(merged[key]);
    }
  }

  updateMenuStates();
}

function updateMenuStates() {
  let pairs = [
    ["folder-setfontstyle", "folder-fontstyle"],
    ["folder-setfontsize", "folder-fontsize"],
    ["thread-setfontstyle", "thread-fontstyle"],
    ["thread-setfontsize", "thread-fontsize"],
    ["thread-setfromstyle", "thread-fromstyle"],
    ["thread-setfromsize", "thread-fromsize"],
    ["message-setfontstyle", "message-fontstyle"],
    ["message-setfontsize", "message-fontsize"],
    ["message-setfromstyle", "message-fromstyle"],
    ["message-setfromsize", "message-fromsize"],
    ["compose-setfontstyle", "compose-fontstyle"],
    ["compose-setfontsize", "compose-fontsize"],
  ];
  for (let [checkboxId, selectId] of pairs) {
    let cb = document.getElementById(checkboxId);
    let sel = document.getElementById(selectId);
    if (cb && sel) sel.disabled = !cb.checked;
  }
}

// Collect all form values into a flat prefs object and persist
async function savePrefs() {
  let prefs = {};

  // Checkbox prefs
  for (let checkbox of document.querySelectorAll('input[type="checkbox"][data-pref]')) {
    prefs[checkbox.dataset.pref] = checkbox.checked;
  }

  // Select prefs
  for (let select of document.querySelectorAll('select[data-pref]')) {
    prefs[select.dataset.pref] = parseInt(select.value) || 0;
  }

  // Picker options
  prefs["picker-autobkgd"] = document.getElementById("picker-autobkgd").checked;
  prefs["picker-applyall"] = document.getElementById("picker-applyall").checked;

  // Account/identity color prefs
  let rows = document.querySelectorAll(".accountid-row");
  for (let row of rows) {
    let key = row.dataset.key;
    let fontPicker = row.querySelector(".font-color-picker");
    let bkgdPicker = row.querySelector(".bkgd-color-picker");
    prefs[key + "-fontcolor"] = fontPicker.dataset.cleared ? "" : fontPicker.value;
    prefs[key + "-bkgdcolor"] = bkgdPicker.dataset.cleared ? "" : bkgdPicker.value;
  }

  // Persist to browser.storage.local
  await browser.storage.local.set({ prefs });

  storedPrefs = prefs;

  // Notify background script to regenerate rules immediately
  await browser.runtime.sendMessage({ command: "savePrefs", prefs });
}

// Tab switching
function setupTabs() {
  for (let tab of document.querySelectorAll(".tab")) {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".tabpanel").forEach(p => p.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById("panel-" + tab.dataset.tab).classList.add("active");
    });
  }
}

function setupChangeListeners() {
  for (let cb of document.querySelectorAll('input[type="checkbox"][data-pref]')) {
    cb.addEventListener("change", () => { updateMenuStates(); savePrefs(); });
  }
  for (let sel of document.querySelectorAll('select[data-pref]')) {
    sel.addEventListener("change", () => savePrefs());
  }
  document.getElementById("picker-autobkgd").addEventListener("change", () => savePrefs());
  document.getElementById("picker-applyall").addEventListener("change", () => savePrefs());
}

// Initialize
async function init() {
  localizeDocument();
  setupTabs();
  populateFontSizeSelects();

  // Load stored prefs
  let data = await browser.storage.local.get("prefs");
  storedPrefs = data.prefs || {};

  await loadAccounts();
  loadPrefs();
  setupChangeListeners();
}

document.addEventListener("DOMContentLoaded", init);
