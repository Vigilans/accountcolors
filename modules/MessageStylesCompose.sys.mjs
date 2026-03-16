/*
 * messageStyles — compose window styling engine (ESM).
 *
 * Styles the compose window (identity selector, header area).
 * Watches for identity changes and reapplies rules.
 *
 * License: MPL-2.0
 */

import {
  extractComposeProperties,
  findMatchingStyles,
  findAccountForServer,
  applyBackgroundInline,
} from "resource://messagestyles/MessageStylesCore.sys.mjs";

const { MailServices } = ChromeUtils.importESModule(
  "resource:///modules/MailServices.sys.mjs"
);

// Per-window state
const windowState = new WeakMap();

function getIdentityAndAccount(win) {
  let identityEl = win.document.getElementById("msgIdentity");
  if (!identityEl) return { identity: null, account: null };

  let identityKey = identityEl.selectedItem?.getAttribute("identitykey")
                 || identityEl.getAttribute("identitykey")
                 || "";
  let identity = identityKey
    ? MailServices.accounts.getIdentity(identityKey)
    : null;

  let account = null;
  if (identity) {
    let servers = MailServices.accounts.getServersForIdentity(identity);
    if (servers && servers.length) {
      account = findAccountForServer(servers[0]);
    }
  }
  return { identity, account };
}

function applyStyles(win, clear) {
  let state = windowState.get(win);
  if (!state) return;

  let style = null;

  if (!clear && state.rules && state.rules.length) {
    let { identity, account } = getIdentityAndAccount(win);
    let props = extractComposeProperties(identity, account);
    style = findMatchingStyles(state.rules, props, "composeWindow");
  }

  let doc = win.document;

  // Identity selector / From field
  let msgIdentity = doc.getElementById("msgIdentity");
  if (msgIdentity) {
    let fromOverride = (style && style.columns)
      ? (style.columns.from || style.columns.identity) : null;
    msgIdentity.style.color = (fromOverride && fromOverride.fontColor)
      || (style && style.fontColor) || "";
    // In label mode, don't color the selected identity's background
    if (style && style.idmenuLabelWidth) {
      msgIdentity.style.backgroundColor = "";
      msgIdentity.style.backgroundImage = "";
    } else {
      msgIdentity.style.backgroundColor = (style && style.backgroundColor) || "";
    }
    msgIdentity.style.fontWeight = (fromOverride && fromOverride.fontWeight) || "";
    msgIdentity.style.fontStyle = (fromOverride && fromOverride.fontStyle) || "";
    msgIdentity.style.fontSize = (fromOverride && fromOverride.fontSize)
      ? fromOverride.fontSize + "px" : "";
  }

  // Subject field
  let msgSubject = doc.getElementById("msgSubject");
  if (msgSubject) {
    let subjectOverride = (style && style.columns)
      ? (style.columns.subjectCol || style.columns.subject) : null;
    msgSubject.style.color = (subjectOverride && subjectOverride.fontColor)
      || (style && style.fontColor) || "";
    msgSubject.style.fontWeight = (subjectOverride && subjectOverride.fontWeight) || "";
    msgSubject.style.fontStyle = (subjectOverride && subjectOverride.fontStyle) || "";
    msgSubject.style.fontSize = (subjectOverride && subjectOverride.fontSize)
      ? subjectOverride.fontSize + "px" : "";
  }

  // Header area background
  let headers = doc.getElementById("MsgHeadersToolbar")
              || doc.getElementById("msgheaderstoolbar");
  applyBackgroundInline(headers, style);
}

// ── Public API ───────────────────────────────────────────────────────

export function onLoad(win, rules) {
  let state = {
    rules,
    identityObserver: null,
    commandHandler: null,
  };
  windowState.set(win, state);

  // Watch for identity selector changes
  let msgIdentity = win.document.getElementById("msgIdentity");
  if (msgIdentity) {
    state.identityObserver = new win.MutationObserver(() => applyStyles(win));
    state.identityObserver.observe(msgIdentity, {
      attributes: true,
      attributeFilter: ["identitykey", "value", "label"],
    });
    state.commandHandler = () => applyStyles(win);
    msgIdentity.addEventListener("command", state.commandHandler);
  }

  applyStyles(win);
}

export function onUnload(win) {
  let state = windowState.get(win);
  if (!state) return;

  if (state.identityObserver) {
    state.identityObserver.disconnect();
  }

  let msgIdentity = win.document.getElementById("msgIdentity");
  if (msgIdentity && state.commandHandler) {
    msgIdentity.removeEventListener("command", state.commandHandler);
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
