/*
 * AccountColors — Experiment API (pref migration only).
 *
 * Provides access to legacy Services.prefs for one-time migration of
 * extensions.accountcolors.* preferences to browser.storage.local.
 *
 * License: MPL-2.0
 */

var { ExtensionCommon } = ChromeUtils.importESModule(
  "resource://gre/modules/ExtensionCommon.sys.mjs"
);

const PREF_BRANCH = "extensions.accountcolors.";

var AccountColors = class extends ExtensionCommon.ExtensionAPI {
  _migratePrefsFromBranch() {
    let prefBranch = Services.prefs.getBranch(PREF_BRANCH);
    let result = {};
    let keys;
    try {
      keys = prefBranch.getChildList("", {});
    } catch (e) {
      console.warn("AccountColors: failed to read pref branch:", e);
      return result;
    }
    for (let key of keys) {
      if (!prefBranch.prefHasUserValue(key)) continue;
      let type = prefBranch.getPrefType(key);
      try {
        switch (type) {
          case Services.prefs.PREF_BOOL:
            result[key] = prefBranch.getBoolPref(key);
            break;
          case Services.prefs.PREF_INT:
            result[key] = prefBranch.getIntPref(key);
            break;
          case Services.prefs.PREF_STRING:
            result[key] = prefBranch.getCharPref(key);
            break;
        }
      } catch (e) { console.warn("AccountColors: failed to read pref " + key + ":", e); }
    }
    return result;
  }

  getAPI(context) {
    let self = this;
    return {
      AccountColors: {
        async migratePrefsFromBranch() {
          return self._migratePrefsFromBranch();
        },
      },
    };
  }
};
