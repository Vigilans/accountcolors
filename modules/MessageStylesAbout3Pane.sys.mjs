/*
 * messageStyles — about:3pane styling engine (ESM).
 *
 * Handles folder pane (folder-tree-row) and thread pane (thread-row,
 * thread-card) by monkey-patching their custom element prototypes.
 *
 * Each window's state is tracked in a WeakMap since ESM modules are
 * singletons shared across all callers.
 *
 * License: MPL-2.0
 */

import {
  extractFolderProperties,
  extractMessageProperties,
  findMatchingStyles,
  applyBackgroundCustomProps,
} from "resource://messagestyles/MessageStylesCore.sys.mjs";

// Per-window state: { rules, folderTree, threadTree, originals, ... }
const windowState = new WeakMap();

// ── Column alias mapping ─────────────────────────────────────────────

const COLUMN_ALIAS = {
  subjectCol:        "subject",
  senderCol:         "from",
  correspondentCol:  "correspondent",
  dateCol:           "date",
  receivedCol:       "received",
  sizeCol:           "size",
  accountCol:        "account",
  priorityCol:       "priority",
  tagsCol:           "tags",
  statusCol:         "status",
  flaggedCol:        "flagged",
  attachmentCol:     "attachments",
  junkStatusCol:     "junkStatus",
};

function getColumnStyle(mergedStyle, columnId) {
  let base = {};
  if (mergedStyle.fontColor)  base.fontColor = mergedStyle.fontColor;
  if (mergedStyle.fontWeight) base.fontWeight = mergedStyle.fontWeight;
  if (mergedStyle.fontStyle)  base.fontStyle = mergedStyle.fontStyle;
  if (mergedStyle.fontSize)   base.fontSize = mergedStyle.fontSize;

  if (!mergedStyle.columns) return base;

  let alias = COLUMN_ALIAS[columnId] || "other";
  let override = mergedStyle.columns[columnId]
              || mergedStyle.columns[alias]
              || mergedStyle.columns["other"];
  if (override) Object.assign(base, override);
  return base;
}

// ── Style application helpers ────────────────────────────────────────

function applyElementStyle(el, style) {
  if (!el) return;
  if (style.fontColor)  el.style.setProperty("--ms-font-color", style.fontColor);
  else                  el.style.removeProperty("--ms-font-color");
  if (style.fontWeight) el.style.setProperty("--ms-font-weight", style.fontWeight);
  else                  el.style.removeProperty("--ms-font-weight");
  if (style.fontStyle)  el.style.setProperty("--ms-font-style", style.fontStyle);
  else                  el.style.removeProperty("--ms-font-style");
  if (style.fontSize)   el.style.setProperty("--ms-font-size", style.fontSize + "px");
  else                  el.style.removeProperty("--ms-font-size");
}

function clearElementStyle(el) {
  if (!el) return;
  el.style.removeProperty("--ms-font-color");
  el.style.removeProperty("--ms-font-weight");
  el.style.removeProperty("--ms-font-style");
  el.style.removeProperty("--ms-font-size");
}

// ── Folder pane ──────────────────────────────────────────────────────

function updateFolderRow(win, element, folder) {
  let state = windowState.get(win);
  let rules = state ? state.rules : null;
  if (!rules || !rules.length) {
    clearFolderRow(element);
    return;
  }

  let props = extractFolderProperties(folder);
  let style = findMatchingStyles(rules, props, "folderPane");
  if (!style) {
    clearFolderRow(element);
    return;
  }

  applyBackgroundCustomProps(element, style);

  let nameEl = element.querySelector(".name");
  applyElementStyle(nameEl, style);

  // Font weight/style must also be set on the row element for the CSS rule
  if (style.fontWeight) element.style.setProperty("--ms-font-weight", style.fontWeight);
  else                  element.style.removeProperty("--ms-font-weight");
  if (style.fontStyle)  element.style.setProperty("--ms-font-style", style.fontStyle);
  else                  element.style.removeProperty("--ms-font-style");

  if (style.fontColor) {
    element.style.setProperty("--ms-badge-bkgd-color", style.fontColor);
  } else {
    element.style.removeProperty("--ms-badge-bkgd-color");
  }
}

function clearFolderRow(element) {
  element.style.removeProperty("--ms-bkgd-color");
  element.style.removeProperty("--ms-badge-bkgd-color");
  element.style.removeProperty("--ms-font-weight");
  element.style.removeProperty("--ms-font-style");
  element.removeAttribute("ms-gradient");
  clearElementStyle(element.querySelector(".name"));
}

function hookFolderPane(win) {
  let state = windowState.get(win);
  let cls = win.customElements.get("folder-tree-row");
  if (!cls) return;

  let original = cls.prototype.setFolderPropertiesFromFolder;
  state.origFolderProp = original;

  cls.prototype.setFolderPropertiesFromFolder = function (folder) {
    original.call(this, folder);
    updateFolderRow(win, this, folder);
  };
}

function unhookFolderPane(win) {
  let state = windowState.get(win);
  if (!state || !state.origFolderProp) return;
  let cls = win.customElements.get("folder-tree-row");
  if (cls) cls.prototype.setFolderPropertiesFromFolder = state.origFolderProp;
  state.origFolderProp = null;
}

function reloadFolderPane(win) {
  let state = windowState.get(win);
  if (!state) return;
  let tree = state.folderTree;
  if (!tree) return;

  let cls = win.customElements.get("folder-tree-row");
  if (!cls) return;

  let folderLookup;
  try {
    folderLookup = Cc["@mozilla.org/mail/folder-lookup;1"]
      .getService(Ci.nsIFolderLookupService);
  } catch (e) { console.warn("messageStyles: folder lookup service unavailable:", e); }

  for (let row of tree.querySelectorAll("li")) {
    if (!(row instanceof cls)) continue;
    let folder = row._folder;
    if (!folder && row.uri && folderLookup) {
      try { folder = folderLookup.getFolderForURL(row.uri); } catch (e) { console.warn("messageStyles: getFolderForURL failed:", e); }
    }
    if (folder) updateFolderRow(win, row, folder);
  }
}

// ── Thread pane (shared) ─────────────────────────────────────────────

function resolveThreadStyle(win, rowIndex) {
  let state = windowState.get(win);
  let rules = state ? state.rules : null;
  if (!rules || !rules.length) return null;

  let msgHdr;
  try { msgHdr = win.gDBView.getMsgHdrAt(rowIndex); }
  catch (e) { console.warn("messageStyles: getMsgHdrAt failed for row", rowIndex, e); return null; }

  let props = extractMessageProperties(msgHdr);
  return findMatchingStyles(rules, props, "threadPane");
}

// ── Thread pane (table view) ─────────────────────────────────────────

function updateThreadRow(win, element, rowIndex) {
  let style = resolveThreadStyle(win, rowIndex);
  if (!style) {
    clearThreadRow(element);
    return;
  }

  if (style.backgroundColor) {
    element.style.setProperty("--ms-bkgd-color", style.backgroundColor);
    if (style.backgroundStyle === "gradient") {
      element.setAttribute("ms-gradient", "");
    } else {
      element.removeAttribute("ms-gradient");
    }
  } else {
    element.style.removeProperty("--ms-bkgd-color");
    element.removeAttribute("ms-gradient");
  }

  // Row label mode
  if (style.rowLabelWidth) {
    let labelColor = style.labelColor || style.fontColor || style.backgroundColor;
    element.setAttribute("ms-row-label", style.rowLabelPosition || "subject");
    element.style.setProperty("--ms-label-width", style.rowLabelWidth + "px");
    if (labelColor) element.style.setProperty("--ms-label-color", labelColor);
  } else {
    element.removeAttribute("ms-row-label");
    element.style.removeProperty("--ms-label-width");
    element.style.removeProperty("--ms-label-color");
  }

  let firstVisible = true;
  let columns = win.threadPane ? win.threadPane.columns : [];
  for (let column of columns) {
    if (column.hidden) continue;
    let colEl = element.querySelector("." + column.id.toLowerCase() + "-column");
    if (!colEl) continue;
    if (firstVisible) {
      colEl.classList.add("ms-first-visible");
      firstVisible = false;
    } else {
      colEl.classList.remove("ms-first-visible");
    }
    let colStyle = getColumnStyle(style, column.id);
    applyElementStyle(colEl, colStyle);
  }
}

function clearThreadRow(element) {
  element.style.removeProperty("--ms-bkgd-color");
  element.removeAttribute("ms-gradient");
  element.removeAttribute("ms-row-label");
  element.style.removeProperty("--ms-label-width");
  element.style.removeProperty("--ms-label-color");
  for (let td of element.querySelectorAll("td")) {
    clearElementStyle(td);
  }
}

// ── Thread pane (card view) ──────────────────────────────────────────

function updateThreadCard(win, element, rowIndex) {
  let style = resolveThreadStyle(win, rowIndex);
  if (!style) {
    clearThreadCard(element);
    return;
  }

  applyBackgroundCustomProps(element, style);

  // Card label mode
  if (style.cardLabelWidth) {
    let labelColor = style.labelColor || style.fontColor || style.backgroundColor;
    element.setAttribute("ms-card-label", "");
    element.style.setProperty("--ms-label-width", style.cardLabelWidth + "px");
    if (labelColor) element.style.setProperty("--ms-label-color", labelColor);
  } else {
    element.removeAttribute("ms-card-label");
    element.style.removeProperty("--ms-label-width");
    element.style.removeProperty("--ms-label-color");
  }

  let subjectStyle = getColumnStyle(style, "subjectCol");
  applyElementStyle(element.subjectLine, subjectStyle);

  let fromStyle = getColumnStyle(style, "senderCol");
  applyElementStyle(element.senderLine, fromStyle);

  let dateStyle = getColumnStyle(style, "dateCol");
  applyElementStyle(element.dateLine, dateStyle);
}

function clearThreadCard(element) {
  element.style.removeProperty("--ms-bkgd-color");
  element.removeAttribute("ms-gradient");
  element.removeAttribute("ms-card-label");
  element.style.removeProperty("--ms-label-width");
  element.style.removeProperty("--ms-label-color");
  clearElementStyle(element.subjectLine);
  clearElementStyle(element.senderLine);
  clearElementStyle(element.dateLine);
}

// ── Thread row/card hooking ──────────────────────────────────────────

function hookCustomElement(win, elementName, stateKeyPrefix, updateFn) {
  let state = windowState.get(win);
  let cls = win.customElements.get(elementName);
  if (!cls) return;

  if (typeof cls.prototype.fillRow === "function") {
    state[stateKeyPrefix + "HookType"] = "fillRow";
    state[stateKeyPrefix + "Orig"] = cls.prototype.fillRow;
    cls.prototype.fillRow = function () {
      state[stateKeyPrefix + "Orig"].call(this);
      updateFn(win, this, this._index);
    };
  } else if (typeof cls.prototype._fillRow === "function") {
    state[stateKeyPrefix + "HookType"] = "_fillRow";
    state[stateKeyPrefix + "Orig"] = cls.prototype._fillRow;
    cls.prototype._fillRow = function () {
      state[stateKeyPrefix + "Orig"].call(this);
      updateFn(win, this, this._index);
    };
  } else if (cls.prototype.hasOwnProperty("index")) {
    let desc = Object.getOwnPropertyDescriptor(cls.prototype, "index");
    state[stateKeyPrefix + "HookType"] = "index";
    state[stateKeyPrefix + "Orig"] = desc.set;
    state[stateKeyPrefix + "OrigGet"] = desc.get;
    Object.defineProperty(cls.prototype, "index", {
      set(row) {
        state[stateKeyPrefix + "Orig"].call(this, row);
        updateFn(win, this, row);
      },
      get: desc.get,
    });
  }
}

function unhookCustomElement(win, elementName, stateKeyPrefix) {
  let state = windowState.get(win);
  if (!state || !state[stateKeyPrefix + "Orig"]) return;
  let cls = win.customElements.get(elementName);
  if (!cls) return;

  let hookType = state[stateKeyPrefix + "HookType"];
  if (hookType === "fillRow") {
    cls.prototype.fillRow = state[stateKeyPrefix + "Orig"];
  } else if (hookType === "_fillRow") {
    cls.prototype._fillRow = state[stateKeyPrefix + "Orig"];
  } else if (hookType === "index") {
    Object.defineProperty(cls.prototype, "index", {
      set: state[stateKeyPrefix + "Orig"],
      get: state[stateKeyPrefix + "OrigGet"],
    });
  }
  state[stateKeyPrefix + "Orig"] = null;
  state[stateKeyPrefix + "OrigGet"] = null;
}

function hookThreadRow(win) {
  hookCustomElement(win, "thread-row", "row", updateThreadRow);
}

function hookThreadCard(win) {
  hookCustomElement(win, "thread-card", "card", updateThreadCard);
}

function unhookThreadRow(win) {
  unhookCustomElement(win, "thread-row", "row");
}

function unhookThreadCard(win) {
  unhookCustomElement(win, "thread-card", "card");
}

function reloadThreadPane(win) {
  let state = windowState.get(win);
  if (!state) return;
  let tree = state.threadTree;
  if (tree && typeof tree.reset === "function") {
    tree.reset();
  } else if (tree) {
    tree.invalidate?.();
  }
}

// ── Public API ───────────────────────────────────────────────────────

export function onLoad(win, rules) {
  let state = {
    rules,
    folderTree: win.folderTree || win.document.getElementById("folderTree"),
    threadTree: win.threadTree || win.document.getElementById("threadTree"),
    origFolderProp: null,
    rowOrig: null,
    rowOrigGet: null,
    rowHookType: null,
    cardOrig: null,
    cardOrigGet: null,
    cardHookType: null,
  };
  windowState.set(win, state);

  win.customElements.whenDefined("folder-tree-row").then(() => {
    // Window may have been unloaded by the time this resolves
    if (!windowState.has(win)) return;
    hookFolderPane(win);
    reloadFolderPane(win);
  });

  Promise.all([
    win.customElements.whenDefined("thread-row"),
    win.customElements.whenDefined("thread-card"),
  ]).then(() => {
    if (!windowState.has(win)) return;
    hookThreadRow(win);
    hookThreadCard(win);
    reloadThreadPane(win);
  });
}

export function onUnload(win) {
  unhookFolderPane(win);
  unhookThreadRow(win);
  unhookThreadCard(win);
  windowState.delete(win);
}

export function onRulesChanged(win, rules) {
  let state = windowState.get(win);
  if (!state) return;
  state.rules = rules;
  reloadFolderPane(win);
  reloadThreadPane(win);
}
