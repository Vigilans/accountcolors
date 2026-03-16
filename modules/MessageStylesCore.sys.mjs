/*
 * messageStyles — Core predicate engine and property extraction.
 *
 * Shared ESM module imported by the experiment and context-specific modules.
 *
 * License: MPL-2.0
 */

const { MailServices } = ChromeUtils.importESModule(
  "resource:///modules/MailServices.sys.mjs"
);

// ── Regex cache for condition evaluation ─────────────────────────────

const REGEX_CACHE_MAX = 100;
const regexCache = new Map();

function getCachedRegex(pattern) {
  let cached = regexCache.get(pattern);
  if (cached !== undefined) return cached;
  try {
    let re = new RegExp(pattern, "i");
    if (regexCache.size >= REGEX_CACHE_MAX) regexCache.clear();
    regexCache.set(pattern, re);
    return re;
  } catch (e) {
    console.warn("messageStyles: invalid regex in condition:", pattern, e);
    regexCache.set(pattern, null);
    return null;
  }
}

// ── Predicate evaluation ─────────────────────────────────────────────

/**
 * Evaluate a predicate condition tree against a properties object.
 *
 * Condition format:
 *   Leaf:       { property, op, value }
 *   AND:        { all: [ ...conditions ] }
 *   OR:         { any: [ ...conditions ] }
 *   NOT:        { not: condition }
 *   Always-true: null / undefined / {}
 */
function evaluateCondition(condition, props) {
  if (!condition || Object.keys(condition).length === 0) return true;

  // Logical combinators
  if ("all" in condition) {
    return condition.all.every(c => evaluateCondition(c, props));
  }
  if ("any" in condition) {
    return condition.any.some(c => evaluateCondition(c, props));
  }
  if ("not" in condition) {
    return !evaluateCondition(condition.not, props);
  }

  // Leaf condition
  let propValue = props[condition.property];
  let testValue = condition.value;
  switch (condition.op) {
    case "equals":
    case "eq":
      return propValue === testValue;
    case "notEquals":
    case "ne":
      return propValue !== testValue;
    case "contains":
      if (typeof propValue === "string")
        return propValue.toLowerCase().includes(String(testValue).toLowerCase());
      if (Array.isArray(propValue))
        return propValue.includes(testValue);
      return false;
    case "notContains":
      if (typeof propValue === "string")
        return !propValue.toLowerCase().includes(String(testValue).toLowerCase());
      if (Array.isArray(propValue))
        return !propValue.includes(testValue);
      return true;
    case "matches": {
      let re = getCachedRegex(String(testValue));
      return re ? re.test(String(propValue ?? "")) : false;
    }
    case "startsWith":
      return String(propValue ?? "").toLowerCase()
        .startsWith(String(testValue).toLowerCase());
    case "endsWith":
      return String(propValue ?? "").toLowerCase()
        .endsWith(String(testValue).toLowerCase());
    case "gt":  return Number(propValue) > Number(testValue);
    case "lt":  return Number(propValue) < Number(testValue);
    case "gte": return Number(propValue) >= Number(testValue);
    case "lte": return Number(propValue) <= Number(testValue);
    case "in":
      return Array.isArray(testValue) && testValue.includes(propValue);
    case "exists":
      return propValue !== undefined && propValue !== null && propValue !== "";
    case "notExists":
      return propValue === undefined || propValue === null || propValue === "";
    default:
      return false;
  }
}

// ── Flag constants (from XPCOM interfaces) ──────────────────────────

const nsMsgMessageFlags = Ci.nsMsgMessageFlags;
const nsMsgFolderFlags  = Ci.nsMsgFolderFlags;

// ── Helpers ──────────────────────────────────────────────────────────

function getFolderType(folder) {
  let f = folder.flags;
  if (f & nsMsgFolderFlags.Inbox)     return "inbox";
  if (f & nsMsgFolderFlags.SentMail)  return "sent";
  if (f & nsMsgFolderFlags.Drafts)    return "drafts";
  if (f & nsMsgFolderFlags.Trash)     return "trash";
  if (f & nsMsgFolderFlags.Junk)      return "junk";
  if (f & nsMsgFolderFlags.Templates) return "templates";
  if (f & nsMsgFolderFlags.Archive)   return "archive";
  if (f & nsMsgFolderFlags.Queue)     return "queue";
  return "";
}

function canonicalizeEmail(email) {
  email = email.trim().toLowerCase();
  email = email.replace(/\+[^@]*@/, "@");
  // Gmail ignores dots in the local part
  if (email.endsWith("@gmail.com")) {
    email = email.replace(/\.(?=.*@)/g, "");
  }
  return email;
}

// See https://bugzilla.mozilla.org/show_bug.cgi?id=1865068#c1
function findAccountForServer(server) {
  try {
    return MailServices.accounts.findAccountForServer(server);
  } catch (e) {
    try {
      return MailServices.accounts.FindAccountForServer(server);
    } catch (e2) {
      console.warn("messageStyles: findAccountForServer failed:", e2);
      return null;
    }
  }
}

/**
 * Search a set of accounts' identities for one that matches the message
 * via recipients, Received header, CC/BCC, or author.
 * Returns the matching identity key, or null if no match.
 */
function _searchIdentityInAccounts(msgHdr, server, accounts) {
  let identityMap = new Map();
  for (let account of accounts) {
    for (let identity of account.identities || []) {
      let email = canonicalizeEmail(identity.email);
      let list = identityMap.get(email);
      if (!list) {
        list = [];
        identityMap.set(email, list);
      }
      // Prefer same server type
      if (account.incomingServer.type === server.type) {
        list.unshift(identity);
      } else {
        list.push(identity);
      }
    }
  }

  let headerParser = MailServices.headerParser;

  // Search recipients
  for (let addr of headerParser.parseDecodedHeader(msgHdr.mime2DecodedRecipients)) {
    let list = identityMap.get(canonicalizeEmail(addr.email));
    if (list && list.length) return list[0].key;
  }

  // Search Received header for <email>
  let received = msgHdr.getStringProperty("received");
  if (received) {
    let m = received.match(/for\s+<([^>]+)>/);
    if (m) {
      let list = identityMap.get(canonicalizeEmail(m[1]));
      if (list && list.length) return list[0].key;
    }
  }

  // Search CC and BCC
  let ccBcc = [msgHdr.ccList, msgHdr.bccList].filter(Boolean).join(", ");
  if (ccBcc) {
    for (let addr of headerParser.parseDecodedHeader(ccBcc)) {
      let list = identityMap.get(canonicalizeEmail(addr.email));
      if (list && list.length) return list[0].key;
    }
  }

  // Search author (sent messages)
  for (let addr of headerParser.parseDecodedHeader(msgHdr.mime2DecodedAuthor)) {
    let list = identityMap.get(canonicalizeEmail(addr.email));
    if (list && list.length) return list[0].key;
  }

  return null;
}

/**
 * Resolve the identity key that best matches a message.
 * First searches only the message's own account (avoids ambiguity when
 * multiple accounts share the same email), then falls back to all accounts.
 */
function resolveIdentityForMessage(msgHdr) {
  let folder = msgHdr.folder;
  let server = folder.server;
  let msgAccount;

  if (msgHdr.accountKey) {
    msgAccount = MailServices.accounts.getAccount(msgHdr.accountKey);
  }
  if (!msgAccount) {
    msgAccount = findAccountForServer(server);
  }
  if (!msgAccount) return "";

  // First pass: search only the message's own account
  let result = _searchIdentityInAccounts(msgHdr, server, [msgAccount]);
  if (result) return result;

  // Second pass: search all accounts
  result = _searchIdentityInAccounts(msgHdr, server, MailServices.accounts.accounts);
  if (result) return result;

  // Fallback
  if (msgAccount.defaultIdentity) return msgAccount.defaultIdentity.key;
  return msgAccount.key;
}

/**
 * Resolve the identity key that best matches a folder.
 * Checks folder name hierarchy against identity email/name.
 */
function resolveIdentityForFolder(folder) {
  let server = folder.server;
  let account = findAccountForServer(server);
  if (!account) return "";

  let identities = account.identities || [];

  // Match folder name (or ancestor) to identity email
  for (let identity of identities) {
    let f = folder;
    while (f && f.parent) {
      if (f.abbreviatedName.toLowerCase() === identity.email.toLowerCase()) {
        return identity.key;
      }
      f = f.parent;
    }
  }

  // Match folder name to identity display name
  for (let identity of identities) {
    let f = folder;
    while (f && f.parent) {
      if (f.abbreviatedName.toLowerCase() === identity.fullName.toLowerCase()) {
        return identity.key;
      }
      f = f.parent;
    }
  }

  if (account.defaultIdentity) return account.defaultIdentity.key;
  return account.key;
}

// ── Property extraction ──────────────────────────────────────────────

/**
 * Build a flat properties object from an nsIMsgDBHdr.
 * The `identity` property is computed lazily.
 */
export function extractMessageProperties(msgHdr) {
  let folder = msgHdr.folder;
  let server = folder.server;
  let now = Date.now();
  let msgDateMs = msgHdr.dateInSeconds * 1000;

  let props = {
    subject:        msgHdr.mime2DecodedSubject || "",
    from:           msgHdr.mime2DecodedAuthor || "",
    to:             msgHdr.mime2DecodedRecipients || "",
    cc:             msgHdr.ccList || "",
    bcc:            msgHdr.bccList || "",
    date:           msgDateMs,
    age:            Math.floor((now - msgDateMs) / 86400000),
    size:           msgHdr.messageSize || 0,
    isRead:         msgHdr.isRead,
    isFlagged:      msgHdr.isFlagged,
    isReplied:      !!(msgHdr.flags & nsMsgMessageFlags.Replied),
    isForwarded:    !!(msgHdr.flags & nsMsgMessageFlags.Forwarded),
    hasAttachments: !!(msgHdr.flags & nsMsgMessageFlags.Attachment),
    keywords:       msgHdr.getStringProperty("keywords") || "",
    priority:       msgHdr.priority,
    junkScore:      parseInt(msgHdr.getStringProperty("junkscore") || "0"),
    account:        msgHdr.accountKey || "",
    folderName:     folder.abbreviatedName || folder.name || "",
    folderPath:     folder.URI || "",
    folderType:     getFolderType(folder),
    serverType:     server.type || "",
    serverHostName: server.hostName || "",
  };

  // Lazy identity resolution — only computed when a rule actually tests it.
  // Self-replacing: after first access, replaces getter with a data property
  // so the closure (and its msgHdr reference) can be GC'd.
  Object.defineProperty(props, "identity", {
    get() {
      let val = resolveIdentityForMessage(msgHdr);
      Object.defineProperty(props, "identity", {
        value: val, enumerable: true, configurable: false,
      });
      return val;
    },
    enumerable: true,
    configurable: true,
  });

  return props;
}

/**
 * Build a flat properties object from an nsIMsgFolder.
 */
export function extractFolderProperties(folder) {
  let server = folder.server;
  let account = findAccountForServer(server);

  let props = {
    folderName:     folder.abbreviatedName || folder.name || "",
    folderPath:     folder.URI || "",
    folderType:     getFolderType(folder),
    serverType:     server.type || "",
    serverHostName: server.hostName || "",
    account:        account ? account.key : "",
  };

  Object.defineProperty(props, "identity", {
    get() {
      let val = resolveIdentityForFolder(folder);
      Object.defineProperty(props, "identity", {
        value: val, enumerable: true, configurable: false,
      });
      return val;
    },
    enumerable: true,
    configurable: true,
  });

  return props;
}

/**
 * Build properties from a compose identity.
 */
export function extractComposeProperties(identity, account) {
  return {
    identity: identity ? identity.key : "",
    account:  account ? account.key : "",
  };
}

// ── Rule matching ────────────────────────────────────────────────────

/**
 * Evaluate all rules against properties for a given context.
 * Returns merged StyleProperties from all matching rules
 * (higher priority overrides lower per-property), or null if none match.
 */
export function findMatchingStyles(rules, props, context) {
  if (!rules || rules.length === 0) return null;

  let matching = [];
  for (let rule of rules) {
    if (!rule.contexts.includes(context)) continue;
    if (evaluateCondition(rule.conditions, props)) {
      matching.push(rule);
    }
  }
  if (matching.length === 0) return null;

  // Rules are pre-sorted by priority; filter preserves order
  let result = {};
  for (let rule of matching) {
    let s = rule.style;
    if (s.fontColor != null)       result.fontColor = s.fontColor;
    if (s.backgroundColor != null) result.backgroundColor = s.backgroundColor;
    if (s.fontWeight != null)      result.fontWeight = s.fontWeight;
    if (s.fontStyle != null)       result.fontStyle = s.fontStyle;
    if (s.fontSize != null)        result.fontSize = s.fontSize;
    if (s.backgroundStyle != null) result.backgroundStyle = s.backgroundStyle;
    if (s.rowLabelWidth != null)   result.rowLabelWidth = s.rowLabelWidth;
    if (s.rowLabelPosition != null) result.rowLabelPosition = s.rowLabelPosition;
    if (s.cardLabelWidth != null)  result.cardLabelWidth = s.cardLabelWidth;
    if (s.headerLabelWidth != null)  result.headerLabelWidth = s.headerLabelWidth;
    if (s.idmenuLabelWidth != null)  result.idmenuLabelWidth = s.idmenuLabelWidth;
    if (s.labelColor != null)        result.labelColor = s.labelColor;
    if (s.columns) {
      result.columns = result.columns || {};
      for (let [col, colStyle] of Object.entries(s.columns)) {
        // Filter out null values from schema normalization before merging
        let filtered = {};
        for (let [k, v] of Object.entries(colStyle)) {
          if (v != null) filtered[k] = v;
        }
        result.columns[col] = Object.assign({}, result.columns[col] || {}, filtered);
      }
    }
  }
  return result;
}

// ── Background application helpers ───────────────────────────────────

/**
 * Apply background color + gradient using inline styles.
 * Used by about:message and compose window modules.
 */
export function applyBackgroundInline(el, style) {
  if (!el) return;
  let labelWidth = style && (style.headerLabelWidth || style.idmenuLabelWidth);
  if (labelWidth) {
    let labelColor = (style.labelColor || style.fontColor || style.backgroundColor || "");
    if (labelColor) {
      let w = labelWidth + "px";
      el.style.backgroundImage =
        `linear-gradient(to right, ${labelColor}, ${labelColor} ${w}, transparent ${w}, transparent 100%)`;
      el.style.backgroundColor = "";
    } else {
      el.style.backgroundColor = "";
      el.style.backgroundImage = "";
    }
  } else if (style && style.backgroundColor) {
    if (style.backgroundStyle === "gradient") {
      el.style.backgroundImage =
        `linear-gradient(to right, ${style.backgroundColor} 0%, transparent 100%)`;
      el.style.backgroundColor = "";
    } else {
      el.style.backgroundColor = style.backgroundColor;
      el.style.backgroundImage = "";
    }
  } else {
    el.style.backgroundColor = "";
    el.style.backgroundImage = "";
  }
}

/**
 * Apply background color + gradient using CSS custom properties.
 * Used by about:3pane module (folder pane, thread pane).
 */
export function applyBackgroundCustomProps(el, style) {
  if (!el) return;
  if (style && style.backgroundColor) {
    el.style.setProperty("--ms-bkgd-color", style.backgroundColor);
    if (style.backgroundStyle === "gradient") {
      el.setAttribute("ms-gradient", "");
    } else {
      el.removeAttribute("ms-gradient");
    }
  } else {
    el.style.removeProperty("--ms-bkgd-color");
    el.removeAttribute("ms-gradient");
  }
}

export { findAccountForServer };
