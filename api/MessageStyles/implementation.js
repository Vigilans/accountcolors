/*
 * messageStyles — Experiment API implementation (parent process).
 *
 * Provides the messenger.messageStyles.* API surface.
 * Handles resource URL registration, window lifecycle,
 * rule storage, and ESM module orchestration.
 *
 * License: MPL-2.0
 */

var { ExtensionCommon } = ChromeUtils.importESModule(
  "resource://gre/modules/ExtensionCommon.sys.mjs"
);
var { ExtensionSupport } = ChromeUtils.importESModule(
  "resource:///modules/ExtensionSupport.sys.mjs"
);

const LISTENER_ID = "accountcolors@gazhay";
const MAILNEWS_CUSTOM_HEADERS_PREF = "mailnews.customDBHeaders";
const RESOURCE_ORIGIN = "messagestyles";
const RESOURCE_BASE = "resource://" + RESOURCE_ORIGIN + "/";
const INJECTED_ATTR = "data-messagestyles-injected";
const INJECTED_SELECTOR = "[" + INJECTED_ATTR + "]";

var messageStyles = class extends ExtensionCommon.ExtensionAPI {
  constructor(...args) {
    super(...args);
    this.rules = new Map();
    this.loadedWindows = new Map();   // window → { module, href }
    this.modules = {};
    this.windowMappings = {};
  }

  // ── Lifecycle ──────────────────────────────────────────────────────

  onStartup() {
    console.log("messageStyles: onStartup() called");
    let rootURI = this.extension.rootURI;

    this._registerResourceUrl(rootURI);
    console.log("messageStyles: resource URL registered");
    this._ensureReceivedHeader();
    this._loadModules();
    console.log("messageStyles: modules loaded");

    this.windowMappings = {
      "about:3pane": {
        module: this.modules.about3pane,
        css: [
          RESOURCE_BASE + "messagestyles-about3pane.css",
        ],
      },
      "about:message": {
        module: this.modules.aboutMessage,
        css: [
          RESOURCE_BASE + "messagestyles-aboutmessage.css",
        ],
      },
      "chrome://messenger/content/messengercompose/messengercompose.xhtml": {
        module: this.modules.compose,
        css: [
          RESOURCE_BASE + "messagestyles-compose.css",
        ],
      },
    };

    this._startListening();
    console.log("messageStyles: onStartup() complete");
  }

  onShutdown(isAppShutdown) {
    console.log("messageStyles: onShutdown(isAppShutdown=" + isAppShutdown + ")");
    if (isAppShutdown) return;

    for (let [key, entry] of this.loadedWindows) {
      let win = entry.window || key;
      try { entry.module.onUnload(win); } catch (e) { console.warn("messageStyles: onUnload failed:", e); }
      try {
        let injected = win.document.querySelectorAll(INJECTED_SELECTOR);
        for (let el of injected) el.remove();
      } catch (e) { console.warn("messageStyles: cleanup failed:", e); }
    }
    this.loadedWindows.clear();

    ExtensionSupport.unregisterWindowListener(LISTENER_ID);

    let resProto = Services.io.getProtocolHandler("resource")
      .QueryInterface(Ci.nsIResProtocolHandler);
    resProto.setSubstitution(RESOURCE_ORIGIN, null);

    Services.obs.notifyObservers(null, "startupcache-invalidate");
  }

  // ── Resource URL registration ───────────────────────────────────────

  _registerResourceUrl(rootURI) {
    let resProto = Services.io.getProtocolHandler("resource")
      .QueryInterface(Ci.nsIResProtocolHandler);
    let modulesURI = Services.io.newURI("modules/", null, rootURI);
    resProto.setSubstitution(RESOURCE_ORIGIN, modulesURI);
  }

  _loadModules() {
    this.modules.about3pane = ChromeUtils.importESModule(
      RESOURCE_BASE + "MessageStylesAbout3Pane.sys.mjs"
    );
    this.modules.aboutMessage = ChromeUtils.importESModule(
      RESOURCE_BASE + "MessageStylesAboutMessage.sys.mjs"
    );
    this.modules.compose = ChromeUtils.importESModule(
      RESOURCE_BASE + "MessageStylesCompose.sys.mjs"
    );
  }

  /**
   * Ensure "received" is in mailnews.customDBHeaders so Thunderbird
   * indexes the Received header into the message database. This is
   * needed for identity resolution: when a message lacks an explicit
   * identity match via recipients or author, the Received header's
   * "for <email>" field is parsed to determine which identity received
   * the message. Without this pref, msgHdr.getStringProperty("received")
   * returns an empty string for all messages.
   */
  _ensureReceivedHeader() {
    let customDBHeaders;
    try {
      customDBHeaders = Services.prefs.getCharPref(MAILNEWS_CUSTOM_HEADERS_PREF);
    } catch (_) {
      customDBHeaders = "";
    }
    if (!customDBHeaders.includes("received")) {
      Services.prefs.setCharPref(
        MAILNEWS_CUSTOM_HEADERS_PREF,
        customDBHeaders ? customDBHeaders + " received" : "received"
      );
    }
  }

  // ── Rule management ────────────────────────────────────────────────

  _getRulesArray() {
    let arr = Array.from(this.rules.values());
    arr.sort((a, b) => (a.priority || 0) - (b.priority || 0));
    return arr;
  }

  _broadcastRules() {
    let rulesArray = this._getRulesArray();
    for (let [key, entry] of this.loadedWindows) {
      try {
        entry.module.onRulesChanged(entry.window || key, rulesArray);
      } catch (e) {
        console.warn("messageStyles: failed to broadcast to window", e);
      }
    }
  }

  // ── Window management ──────────────────────────────────────────────

  _startListening() {
    let self = this;

    ExtensionSupport.registerWindowListener(LISTENER_ID, {
      async onLoadWindow(window) {
        if (self.windowMappings.hasOwnProperty(window.location.href)) {
          self._loadIntoWindow(window);
        }
        self._watchBrowserElements(window);
      },
      onUnloadWindow(window) {
        self._unloadFromWindow(window);
      },
    });
    console.log("messageStyles: window listener registered");
  }

  /**
   * Watch <browser> elements in `window` for content that matches a
   * windowMapping.  Periodically checks each browser's contentWindow
   * location (Thunderbird loads content via loadURI() without setting
   * the src attribute, so MutationObservers on src don't work).
   * Recursively descends into already-loaded browser windows to find
   * nested browsers (e.g. about:message inside about:3pane) — this
   * avoids calling setInterval on wrappedJSObject inner windows.
   */
  _watchBrowserElements(window) {
    let self = this;
    let doc = window.document;

    function scanBrowsers(scanDoc, parentHref, depth) {
      let browsers;
      try { browsers = scanDoc.getElementsByTagNameNS("*", "browser"); } catch (e) {
        console.warn("messageStyles: getElementsByTagNameNS failed:", e);
        return;
      }
      for (let i = 0; i < browsers.length; i++) {
        let element = browsers[i];
        // If already loaded, recursively scan its children for nested browsers
        if (element._messageStylesLoaded) {
          try {
            let innerWin = element.contentWindow;
            if (!innerWin) {
              continue;
            }
            let innerDoc;
            try { innerDoc = innerWin.document; } catch (e2) {
              // Try wrappedJSObject
              try {
                innerWin = innerWin.wrappedJSObject || innerWin;
                innerDoc = innerWin.document;
              } catch (e3) {
                continue;
              }
            }
            if (innerDoc) {
              scanBrowsers(innerDoc, innerWin.location.href, depth + 1);
            }
          } catch (e) {
            console.warn("messageStyles: failed to recurse into loaded browser:", e);
          }
          continue;
        }
        let targetWindow;
        try { targetWindow = element.contentWindow; } catch (e) { continue; }
        if (!targetWindow) continue;
        let href;
        try { href = targetWindow.location.href; } catch (e) { continue; }
        if (!href || href === "about:blank") continue;
        if (!self.windowMappings.hasOwnProperty(href)) {
          continue;
        }
        let readyState;
        try { readyState = targetWindow.document.readyState; } catch (e) { continue; }
        if (readyState !== "complete") {
          continue;
        }
        element._messageStylesLoaded = true;
        let innerWindow = targetWindow.wrappedJSObject || targetWindow;
        try {
          self._loadIntoWindow(innerWindow, element);
        } catch (e) {
          element._messageStylesLoaded = false;
          console.error("messageStyles: _loadIntoWindow failed:", e);
        }
      }
    }

    function checkAll() {
      scanBrowsers(doc, window.location.href, 0);
    }

    checkAll();
    let interval = window.setInterval(checkAll, 500);
    window._messageStylesBrowserInterval = interval;
  }

  _loadIntoWindow(window, browserElement) {
    let href = window.location.href;
    if (!this.windowMappings.hasOwnProperty(href)) return;

    let mapping = this.windowMappings[href];

    // Inject CSS
    for (let cssUrl of mapping.css) {
      let link = window.document.createElement("link");
      link.rel = "stylesheet";
      link.href = cssUrl;
      link.setAttribute(INJECTED_ATTR, "true");
      window.document.head.appendChild(link);
    }

    // Initialize the ESM module for this window
    let rulesArray = this._getRulesArray();
    mapping.module.onLoad(window, rulesArray);
    this.loadedWindows.set(browserElement || window, { module: mapping.module, href, window });
  }

  _unloadFromWindow(window) {
    // Stop the browser-element polling interval
    if (window._messageStylesBrowserInterval) {
      window.clearInterval(window._messageStylesBrowserInterval);
      delete window._messageStylesBrowserInterval;
    }

    // Recurse into nested browser elements
    let browsers = window.document.getElementsByTagName("browser");
    for (let element of browsers) {
      delete element._messageStylesLoaded;
      if (element.contentWindow) {
        let targetWindow = element.contentWindow.wrappedJSObject ||
          element.contentWindow;
        this._unloadFromWindow(targetWindow);
      }
      // Also clean up by browser element key
      if (this.loadedWindows.has(element)) {
        let entry = this.loadedWindows.get(element);
        try { entry.module.onUnload(entry.window); } catch (e) { console.warn("messageStyles: onUnload failed:", e); }
        let injected = entry.window.document.querySelectorAll(
          INJECTED_SELECTOR
        );
        for (let el of injected) el.remove();
        this.loadedWindows.delete(element);
      }
    }

    let entry = this.loadedWindows.get(window);
    if (!entry) return;

    try { entry.module.onUnload(entry.window || window); } catch (e) { console.warn("messageStyles: onUnload failed:", e); }

    // Remove injected CSS
    let injected = window.document.querySelectorAll(
      INJECTED_SELECTOR
    );
    for (let el of injected) el.remove();

    this.loadedWindows.delete(window);
  }

  // ── API surface ────────────────────────────────────────────────────

  getAPI(context) {
    let self = this;
    let extensionId = context.extension.id;

    return {
      messageStyles: {
        async startup() {
          // No-op — accessing triggers onStartup().
        },

        async addRule(rule) {
          rule._owner = extensionId;
          self.rules.set(extensionId + "/" + rule.id, rule);
          self._broadcastRules();
        },

        async removeRule(ruleId) {
          self.rules.delete(extensionId + "/" + ruleId);
          self._broadcastRules();
        },

        async getRules() {
          return self._getRulesArray()
            .filter(r => r._owner === extensionId);
        },

        async clearRules() {
          for (let [key, rule] of self.rules) {
            if (rule._owner === extensionId) self.rules.delete(key);
          }
          self._broadcastRules();
        },

        async setRules(rules) {
          for (let [key, rule] of self.rules) {
            if (rule._owner === extensionId) self.rules.delete(key);
          }
          for (let rule of rules) {
            rule._owner = extensionId;
            self.rules.set(extensionId + "/" + rule.id, rule);
          }
          self._broadcastRules();
        },
      },
    };
  }
};
