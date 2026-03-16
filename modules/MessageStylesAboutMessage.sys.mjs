/*
 * messageStyles — about:message styling engine (ESM).
 *
 * Styles the message display header (subject, from, background).
 * Watches for mutation changes and message navigations.
 *
 * License: MPL-2.0
 */

import {
  extractMessageProperties,
  findMatchingStyles,
  applyBackgroundInline,
} from "resource://messagestyles/MessageStylesCore.sys.mjs";

// Per-window state
const windowState = new WeakMap();

function applyStyles(win, clear) {
  let state = windowState.get(win);
  if (!state) return;

  // Disconnect observer while we modify styles to avoid infinite loop
  if (state.observer) state.observer.disconnect();

  try {
  _applyStylesInner(win, state, clear);
  } finally {
    // Reconnect observer
    if (state.observer) {
      let targets = ["expandedsubjectBox", "expandedHeaderView",
                     "expandedfromBox", "messageHeader"];
      for (let id of targets) {
        let el = win.document.getElementById(id);
        if (el) {
          state.observer.observe(el, {
            attributes: true,
            attributeFilter: ["style"],
          });
        }
      }
    }
  }
}

function _applyStylesInner(win, state, clear) {
  let msgHdr = win.gMessage
    || (win.gFolderDisplay && win.gFolderDisplay.selectedMessage)
    || null;
  if (!msgHdr) return;

  let style = null;
  if (!clear && state.rules && state.rules.length) {
    let props = extractMessageProperties(msgHdr);
    style = findMatchingStyles(state.rules, props, "messageHeader");
  }

  let doc = win.document;

  // Subject
  let subjectBox = doc.getElementById("expandedsubjectBox");
  if (subjectBox) {
    subjectBox.style.color = (style && style.fontColor) || "";
    subjectBox.style.fontWeight = (style && style.fontWeight) || "";
    subjectBox.style.fontStyle = (style && style.fontStyle) || "";
    subjectBox.style.fontSize = (style && style.fontSize)
      ? style.fontSize + "px" : "";

    // Column-specific subject overrides
    if (style && style.columns) {
      let subjectOverride = style.columns.subjectCol || style.columns.subject;
      if (subjectOverride) {
        if (subjectOverride.fontColor)  subjectBox.style.color = subjectOverride.fontColor;
        if (subjectOverride.fontWeight) subjectBox.style.fontWeight = subjectOverride.fontWeight;
        if (subjectOverride.fontStyle)  subjectBox.style.fontStyle = subjectOverride.fontStyle;
        if (subjectOverride.fontSize)   subjectBox.style.fontSize = subjectOverride.fontSize + "px";
      }
    }
  }

  // From — only uses column-specific overrides, not the top-level (subject) style
  let fromBox = doc.getElementById("expandedfromBox");
  if (fromBox) {
    let fromOverride = (style && style.columns)
      ? (style.columns.senderCol || style.columns.from)
      : null;
    fromBox.style.color = (fromOverride && fromOverride.fontColor) || (style && style.fontColor) || "";
    fromBox.style.fontWeight = (fromOverride && fromOverride.fontWeight) || "";
    fromBox.style.fontStyle = (fromOverride && fromOverride.fontStyle) || "";
    fromBox.style.fontSize = (fromOverride && fromOverride.fontSize)
      ? fromOverride.fontSize + "px" : "";
  }

  // Header background
  let header = doc.getElementById("messageHeader");
  applyBackgroundInline(header, style);

  // Header labels
  for (let labelId of ["expandedfromLabel", "expandedsubjectLabel",
                       "expandedtoLabel"]) {
    let label = doc.getElementById(labelId);
    if (label && style && style.fontColor) {
      label.style.color = style.fontColor;
    } else if (label) {
      label.style.color = "";
    }
  }
}

// ── Public API ───────────────────────────────────────────────────────

export function onLoad(win, rules) {
  let state = {
    rules,
    observer: null,
    messageLoadHandler: null,
  };
  windowState.set(win, state);

  // Observe style mutations on key elements (TB can reset styles)
  let targets = ["expandedsubjectBox", "expandedHeaderView",
                 "expandedfromBox", "messageHeader"];
  state.observer = new win.MutationObserver(() => applyStyles(win));
  for (let id of targets) {
    let el = win.document.getElementById(id);
    if (el) {
      state.observer.observe(el, {
        attributes: true,
        attributeFilter: ["style"],
      });
    }
  }

  // Listen for message loads
  state.messageLoadHandler = () => applyStyles(win);
  let messagepane = win.document.getElementById("messagepane");
  if (messagepane) {
    messagepane.addEventListener("load", state.messageLoadHandler, true);
  }

  applyStyles(win);
}

export function onUnload(win) {
  let state = windowState.get(win);
  if (!state) return;

  if (state.observer) {
    state.observer.disconnect();
  }

  let messagepane = win.document.getElementById("messagepane");
  if (messagepane && state.messageLoadHandler) {
    messagepane.removeEventListener("load", state.messageLoadHandler, true);
  }

  applyStyles(win, /* clear */ true);
  windowState.delete(win);
}

export function onRulesChanged(win, rules) {
  let state = windowState.get(win);
  if (!state) return;
  state.rules = rules;
  applyStyles(win);
}
