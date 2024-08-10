// Import any needed modules.
var Services = globalThis.Services ||
  ChromeUtils.import("resource://gre/modules/Services.jsm").Services;

// Load an additional JavaScript file.
Services.scriptloader.loadSubScript("chrome://accountcolors/content/accountcolors-utilities.js", window, "UTF-8");
Services.scriptloader.loadSubScript("chrome://accountcolors/content/accountcolors-about3pane.js", window, "UTF-8");

function onLoad(activatedWhileWindowOpen) {
  WL.injectCSS("chrome://accountcolors-skin/content/accountcolors-about3pane.css");

  window.accountColorsAbout3Pane.onLoad();
}

function onUnload(deactivatedWhileWindowOpen) {
  // Cleaning up the window UI is only needed when the
  // add-on is being deactivated/removed while the window
  // is still open. It can be skipped otherwise.
  if (!deactivatedWhileWindowOpen) {
    return;
  }

  window.accountColorsAbout3Pane.onUnload();
}
