// Account Colors - background script
//
// Loads/migrates prefs, converts per-identity/account color preferences
// into declarative predicate rules, and pushes them to the messageStyles
// experiment API.  Also creates the Tools menu entry and validates prefs
// when accounts/identities are added or removed.

let storedPrefs = null;
let prefsReady;
let prefsReadyResolve;
prefsReady = new Promise(resolve => { prefsReadyResolve = resolve; });

function pref(key) {
  if (storedPrefs && key in storedPrefs) return storedPrefs[key];
  return ACCOUNTCOLORS_DEFAULT_PREFS[key];
}

// ── Font-style helpers ───────────────────────────────────────────────

const FONT_STYLE_MAP = ["normal", "italic", "bold", "bold italic"];

function fontStyleToProps(styleIndex) {
  let s = FONT_STYLE_MAP[styleIndex] || "normal";
  return {
    fontStyle:  s.includes("italic") ? "italic" : "normal",
    fontWeight: s.includes("bold")   ? "bold"   : "normal",
  };
}

function validFontSize(sz) {
  return Number.isInteger(sz) && sz >= 8 && sz <= 24 ? sz : undefined;
}

// ── Serialization guard for generateRules ────────────────────────────

let generateRulesPromise = Promise.resolve();
function generateRulesSerialized() {
  generateRulesPromise = generateRulesPromise.then(() => generateRules());
  return generateRulesPromise;
}

// ── Tools menu ───────────────────────────────────────────────────────

messenger.menus.create({
  id: "accountcolors-options",
  title: messenger.i18n.getMessage("accountcolors_options"),
  contexts: ["tools_menu"],
});

messenger.menus.onClicked.addListener((info) => {
  if (info.menuItemId === "accountcolors-options") {
    browser.runtime.openOptionsPage();
  }
});

// ── Message handling (options page saves prefs, chrome scripts read them) ─

browser.runtime.onMessage.addListener((message, sender) => {
  if (message.command === "getPrefs") {
    return prefsReady.then(() => storedPrefs);
  }
  if (message.command === "savePrefs") {
    storedPrefs = message.prefs;
    return generateRulesSerialized().then(() => true).catch(e => {
      console.error("AccountColors: generateRules failed:", e);
      return false;
    });
  }
});

// ── Rule generation ──────────────────────────────────────────────────

/**
 * Convert the flat per-identity/account color prefs + global visual prefs
 * into messageStyles predicate rules and push them to the experiment API.
 */
async function generateRules() {
  await prefsReady;
  let accounts = await messenger.accounts.list(false);
  let priority = 10;
  let rules = [];

  for (let account of accounts) {
    if (account.identities.length === 0) {
      let fontcolor = pref(account.id + "-fontcolor") || "";
      let bkgdcolor = pref(account.id + "-bkgdcolor") || "";
      if (fontcolor || bkgdcolor) {
        addColorRulesForKey(rules, account.id, "account", account.id, fontcolor, bkgdcolor, priority++);
      }
    } else {
      for (let identity of account.identities) {
        let fontcolor = pref(identity.id + "-fontcolor") || "";
        let bkgdcolor = pref(identity.id + "-bkgdcolor") || "";
        if (fontcolor || bkgdcolor) {
          addColorRulesForKey(rules, identity.id, "identity", identity.id, fontcolor, bkgdcolor, priority++);
        }
      }
    }
  }

  await messenger.messageStyles.setRules(rules);
}

/**
 * Add styling rules for a single account or identity key.
 *
 * Generates separate rules per context (folderPane, threadPane,
 * messageHeader, composeWindow) based on the global enable prefs.
 * Rules are pushed to the provided array for later atomic commit.
 */
function addColorRulesForKey(rules, key, property, value, fontcolor, bkgdcolor, priority) {
  let condition = { property, op: "equals", value };

  // ── Folder pane ─────────────────────────────────────────────────
  if (pref("folder-colorfont") || pref("folder-colorbkgd")) {
    let style = {};
    if (pref("folder-colorfont") && fontcolor) style.fontColor = fontcolor;
    if (pref("folder-colorbkgd") && bkgdcolor) style.backgroundColor = bkgdcolor;
    if (pref("folder-setfontstyle")) Object.assign(style, fontStyleToProps(pref("folder-fontstyle")));
    if (pref("folder-setfontsize")) {
      let sz = validFontSize(pref("folder-fontsize"));
      if (sz) style.fontSize = sz;
    }
    if (pref("folder-colorbkgd-gradient") && bkgdcolor) style.backgroundStyle = "gradient";
    rules.push({
      id: key + "-folder",
      priority,
      contexts: ["folderPane"],
      conditions: condition,
      style,
    });
  }

  // ── Thread pane ─────────────────────────────────────────────────
  if (pref("thread-colorfont") || pref("thread-colorbkgd") || pref("thread-colorother")) {
    let style = {};
    if (pref("thread-colorbkgd") && bkgdcolor) style.backgroundColor = bkgdcolor;
    if (pref("thread-colorbkgd-gradient") && bkgdcolor) style.backgroundStyle = "gradient";
    if (pref("thread-colorbkgd-row-label")) {
      style.rowLabelWidth = pref("thread-row-label-width");
      style.rowLabelPosition = pref("thread-row-label-position") === 1 ? "first" : "subject";
      if (fontcolor) style.labelColor = fontcolor;
    }
    if (pref("thread-colorbkgd-card-label")) {
      style.cardLabelWidth = pref("thread-card-label-width");
      if (fontcolor) style.labelColor = fontcolor;
    }

    // Per-column overrides
    let columns = {};

    // Subject column: font color + style/size
    let subjectStyle = {};
    if (pref("thread-colorfont") && fontcolor) subjectStyle.fontColor = fontcolor;
    if (pref("thread-setfontstyle")) Object.assign(subjectStyle, fontStyleToProps(pref("thread-fontstyle")));
    if (pref("thread-setfontsize")) {
      let sz = validFontSize(pref("thread-fontsize"));
      if (sz) subjectStyle.fontSize = sz;
    }
    if (Object.keys(subjectStyle).length) columns.subjectCol = subjectStyle;

    // From/correspondent column
    if (pref("thread-colorfrom") && fontcolor) {
      let fromStyle = { fontColor: fontcolor };
      if (pref("thread-setfromstyle")) Object.assign(fromStyle, fontStyleToProps(pref("thread-fromstyle")));
      if (pref("thread-setfromsize")) {
        let sz = validFontSize(pref("thread-fromsize"));
        if (sz) fromStyle.fontSize = sz;
      }
      columns.correspondentCol = fromStyle;
      columns.senderCol = fromStyle;
    }

    // Other columns (date, size, account, etc.)
    if (pref("thread-colorother") && fontcolor) {
      columns.other = { fontColor: fontcolor };
      // Ensure subject/from don't inherit "other" when their own prefs are off
      if (!columns.subjectCol) columns.subjectCol = {};
      if (!columns.correspondentCol) columns.correspondentCol = {};
      if (!columns.senderCol) columns.senderCol = {};
    }

    if (Object.keys(columns).length) style.columns = columns;

    rules.push({
      id: key + "-thread",
      priority,
      contexts: ["threadPane"],
      conditions: condition,
      style,
    });
  }

  // ── Thread pane (unread override) ───────────────────────────────
  let hasUnreadSubject = pref("thread-setunreadfontstyle") || pref("thread-setunreadfontsize");
  let hasUnreadFrom = pref("thread-setunreadfromstyle") || pref("thread-setunreadfromsize");
  if (hasUnreadSubject || hasUnreadFrom) {
    let unreadStyle = {};
    let unreadColumns = {};

    if (hasUnreadSubject) {
      let s = {};
      if (pref("thread-setunreadfontstyle")) Object.assign(s, fontStyleToProps(pref("thread-unreadfontstyle")));
      if (pref("thread-setunreadfontsize")) {
        let sz = validFontSize(pref("thread-unreadfontsize"));
        if (sz) s.fontSize = sz;
      }
      unreadColumns.subjectCol = s;
    }
    if (hasUnreadFrom) {
      let s = {};
      if (pref("thread-setunreadfromstyle")) Object.assign(s, fontStyleToProps(pref("thread-unreadfromstyle")));
      if (pref("thread-setunreadfromsize")) {
        let sz = validFontSize(pref("thread-unreadfromsize"));
        if (sz) s.fontSize = sz;
      }
      unreadColumns.correspondentCol = s;
      unreadColumns.senderCol = s;
    }
    unreadStyle.columns = unreadColumns;

    let unreadCondition = {
      all: [
        condition,
        { property: "isRead", op: "equals", value: false },
      ],
    };

    rules.push({
      id: key + "-thread-unread",
      priority: priority + 1,
      contexts: ["threadPane"],
      conditions: unreadCondition,
      style: unreadStyle,
    });
  }

  // ── Message header ──────────────────────────────────────────────
  if (pref("message-colorfont") || pref("message-colorbkgd") ||
      pref("message-setfontstyle") || pref("message-setfontsize") ||
      pref("message-setfromstyle") || pref("message-setfromsize")) {
    let style = {};
    if (pref("message-colorfont") && fontcolor) style.fontColor = fontcolor;
    if (pref("message-colorbkgd") && bkgdcolor) style.backgroundColor = bkgdcolor;
    if (pref("message-setfontstyle")) Object.assign(style, fontStyleToProps(pref("message-fontstyle")));
    if (pref("message-setfontsize")) {
      let sz = validFontSize(pref("message-fontsize"));
      if (sz) style.fontSize = sz;
    }
    if (pref("message-colorbkgd-gradient") && bkgdcolor) style.backgroundStyle = "gradient";
    if (pref("message-colorbkgd-header-label")) {
      style.headerLabelWidth = pref("message-header-label-width");
      if (fontcolor) style.labelColor = fontcolor;
    }

    let columns = {};
    let fromStyle = {};
    if (pref("message-colorfrom") && fontcolor) fromStyle.fontColor = fontcolor;
    if (pref("message-setfromstyle")) Object.assign(fromStyle, fontStyleToProps(pref("message-fromstyle")));
    if (pref("message-setfromsize")) {
      let sz = validFontSize(pref("message-fromsize"));
      if (sz) fromStyle.fontSize = sz;
    }
    if (Object.keys(fromStyle).length) columns.from = fromStyle;
    if (Object.keys(columns).length) style.columns = columns;

    rules.push({
      id: key + "-message",
      priority,
      contexts: ["messageHeader"],
      conditions: condition,
      style,
    });
  }

  // ── Compose window ─────────────────────────────────────────────
  if (pref("compose-colorfont") || pref("compose-colorbkgd") ||
      pref("compose-setfontstyle") || pref("compose-setfontsize")) {
    let style = {};
    if (pref("compose-colorfont") && fontcolor) style.fontColor = fontcolor;
    if (pref("compose-colorbkgd") && bkgdcolor) style.backgroundColor = bkgdcolor;
    if (pref("compose-colorbkgd-gradient") && bkgdcolor) style.backgroundStyle = "gradient";
    if (pref("compose-colorbkgd-idmenu-label")) {
      style.idmenuLabelWidth = pref("compose-idmenu-label-width");
      if (fontcolor) style.labelColor = fontcolor;
    }

    let columns = {};
    let subjectStyle = {};
    if (pref("compose-colorfont") && fontcolor) subjectStyle.fontColor = fontcolor;
    if (pref("compose-setfontstyle")) Object.assign(subjectStyle, fontStyleToProps(pref("compose-fontstyle")));
    if (pref("compose-setfontsize")) {
      let sz = validFontSize(pref("compose-fontsize"));
      if (sz) subjectStyle.fontSize = sz;
    }
    if (Object.keys(subjectStyle).length) columns.subject = subjectStyle;
    if (Object.keys(columns).length) style.columns = columns;

    rules.push({
      id: key + "-compose",
      priority,
      contexts: ["composeWindow"],
      conditions: condition,
      style,
    });
  }
}

// ── Prefs validation ─────────────────────────────────────────────────

async function validatePrefs() {
  await prefsReady;
  let changed = false;

  let accounts = await messenger.accounts.list(false);

  let validKeys = new Set();
  for (let account of accounts) {
    if (account.identities.length === 0) {
      validKeys.add(account.id);
      if (!(account.id + "-fontcolor" in storedPrefs) || !(account.id + "-bkgdcolor" in storedPrefs)) {
        storedPrefs[account.id + "-fontcolor"] = "";
        storedPrefs[account.id + "-bkgdcolor"] = "";
        changed = true;
      }
    } else {
      for (let identity of account.identities) {
        validKeys.add(identity.id);
        if (!(identity.id + "-fontcolor" in storedPrefs) || !(identity.id + "-bkgdcolor" in storedPrefs)) {
          storedPrefs[identity.id + "-fontcolor"] = "";
          storedPrefs[identity.id + "-bkgdcolor"] = "";
          changed = true;
        }
      }
    }
  }

  for (let key of Object.keys(storedPrefs)) {
    let match = key.match(/^(account\d+|id\d+)-(?:fontcolor|bkgdcolor)$/);
    if (match && !validKeys.has(match[1])) {
      delete storedPrefs[key];
      changed = true;
    }
  }

  if (changed) {
    await browser.storage.local.set({ prefs: storedPrefs });
  }
}

// ── Account/identity change listeners ────────────────────────────────

let accountsChangedTimer = null;
function onAccountsChanged() {
  if (accountsChangedTimer) clearTimeout(accountsChangedTimer);
  accountsChangedTimer = setTimeout(async () => {
    accountsChangedTimer = null;
    await validatePrefs();
    await generateRulesSerialized();
  }, 500);
}

messenger.accounts.onCreated.addListener(onAccountsChanged);
messenger.accounts.onDeleted.addListener(onAccountsChanged);
messenger.identities.onCreated.addListener(onAccountsChanged);
messenger.identities.onDeleted.addListener(onAccountsChanged);

// ── Migration helpers ─────────────────────────────────────────────────

function migrateBoldPrefs(prefs) {
  let changed = false;
  if (prefs["thread-boldsubject"] === true) {
    prefs["thread-setunreadfontstyle"] = true;
    prefs["thread-unreadfontstyle"] = 2;
    delete prefs["thread-boldsubject"];
    changed = true;
  }
  if (prefs["thread-boldfrom"] === true) {
    prefs["thread-setunreadfromstyle"] = true;
    prefs["thread-unreadfromstyle"] = 2;
    delete prefs["thread-boldfrom"];
    changed = true;
  }
  return changed;
}

// ── Startup ──────────────────────────────────────────────────────────

(async () => {
  console.log("AccountColors: background.js starting");

  try {
    await messenger.messageStyles.startup();
    console.log("AccountColors: messageStyles.startup() succeeded");
  } catch (e) {
    console.error("AccountColors: messageStyles.startup() failed:", e);
  }

  let data = await browser.storage.local.get("prefs");
  let prefs = data.prefs || null;

  if (!prefs) {
    prefs = await messenger.AccountColors.migratePrefsFromBranch();
    if (prefs && Object.keys(prefs).length > 0) {
      migrateBoldPrefs(prefs);
      await browser.storage.local.set({ prefs });
    } else {
      prefs = {};
    }
  }

  if (migrateBoldPrefs(prefs)) {
    await browser.storage.local.set({ prefs });
  }

  storedPrefs = prefs;
  prefsReadyResolve();

  await validatePrefs();
  await generateRulesSerialized();

  console.log("AccountColors: background.js ready");
})();

