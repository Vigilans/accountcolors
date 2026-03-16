/*
 * Account Colors - Default Preferences & Prefs Proxy
 *
 * Shared between chrome content scripts (loaded via scriptloader) and the
 * WebExtension options page (loaded as a <script> tag).
 *
 * Chrome scripts fetch prefs from background.js via browser.runtime messaging,
 * then create the proxy in their onLoad function.
 */

var ACCOUNTCOLORS_DEFAULT_PREFS = {
  // Color Picker
  "picker-autobkgd": false,
  "picker-applyall": false,
  // Folder Pane
  "folder-setfontstyle": false,
  "folder-fontstyle": 2,
  "folder-setfontsize": false,
  "folder-fontsize": 12,
  "folder-colorfont": true,
  "folder-colorbkgd": true,
  "folder-colorbkgd-gradient": false,
  // Thread Pane
  "thread-setfontstyle": false,
  "thread-fontstyle": 0,
  "thread-setfontsize": false,
  "thread-fontsize": 12,
  "thread-setfromstyle": false,
  "thread-fromstyle": 0,
  "thread-setfromsize": false,
  "thread-fromsize": 12,
  "thread-colorfont": false,
  "thread-colorbkgd": false,
  "thread-colorfrom": false,
  "thread-colorother": false,
  "thread-colorbkgd-gradient": false,
  "thread-colorbkgd-row-label": false,
  "thread-row-label-position": 0,
  "thread-row-label-width": 2,
  "thread-colorbkgd-card-label": false,
  "thread-card-label-width": 4,
  "thread-setunreadfontstyle": false,
  "thread-unreadfontstyle": 2,
  "thread-setunreadfontsize": false,
  "thread-unreadfontsize": 12,
  "thread-setunreadfromstyle": false,
  "thread-unreadfromstyle": 2,
  "thread-setunreadfromsize": false,
  "thread-unreadfromsize": 12,
  // Message Pane/Tab/Window
  "message-setfontstyle": false,
  "message-fontstyle": 2,
  "message-setfontsize": false,
  "message-fontsize": 12,
  "message-setfromstyle": false,
  "message-fromstyle": 0,
  "message-setfromsize": false,
  "message-fromsize": 12,
  "message-colorfont": false,
  "message-colorbkgd": false,
  "message-colorfrom": false,
  "message-colorbkgd-gradient": false,
  "message-colorbkgd-header-label": false,
  "message-header-label-width": 4,
  // Compose Window
  "compose-setfontstyle": false,
  "compose-fontstyle": 0,
  "compose-setfontsize": false,
  "compose-fontsize": 12,
  "compose-colorfont": false,
  "compose-colorbkgd": false,
  "compose-colorbkgd-gradient": false,
  "compose-colorbkgd-idmenu-label": false,
  "compose-idmenu-label-width": 4,
};

/**
 * Creates an nsIPrefBranch-compatible proxy backed by in-memory objects.
 * Chrome scripts call getBoolPref / setCharPref / etc. on this object
 * instead of Components.classes nsIPrefService.
 */
function createAccountColorsPrefsProxy(defaults, stored) {
  return {
    _defaults: defaults,
    _stored: { ...stored },
    _data: { ...defaults, ...stored },

    _update(newStored) {
      this._stored = { ...newStored };
      this._data = { ...this._defaults, ...newStored };
    },

    getBoolPref(key) {
      let v = this._data[key];
      return (v === true || v === false) ? v : !!v;
    },
    getIntPref(key) {
      let v = this._data[key];
      return (typeof v === "number") ? v : (parseInt(v) || 0);
    },
    getCharPref(key) {
      let v = this._data[key];
      return (v != null) ? String(v) : "";
    },

    setBoolPref(key, val) {
      this._stored[key] = !!val;
      this._data[key] = !!val;
    },
    setIntPref(key, val) {
      this._stored[key] = parseInt(val) || 0;
      this._data[key] = parseInt(val) || 0;
    },
    setCharPref(key, val) {
      this._stored[key] = String(val);
      this._data[key] = String(val);
    },

    prefHasUserValue(key) {
      return key in this._stored;
    },
    clearUserPref(key) {
      delete this._stored[key];
      if (key in this._defaults) {
        this._data[key] = this._defaults[key];
      } else {
        delete this._data[key];
      }
    },
    getChildList(prefix, obj) {
      return Object.keys(this._data).filter(k => k.startsWith(prefix));
    },
  };
}

// In chrome windows the proxy is created by each injector's onLoad
// after fetching prefs from background.js via runtime messaging.
