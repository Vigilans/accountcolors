// Import any needed modules.
var Services = globalThis.Services ||
  ChromeUtils.import("resource://gre/modules/Services.jsm").Services;

// Load an additional JavaScript file.
Services.scriptloader.loadSubScript("chrome://accountcolors/content/accountcolors-composewindow.js", window, "UTF-8");
Services.scriptloader.loadSubScript("chrome://accountcolors/content/accountcolors-utilities.js", window, "UTF-8");

function onLoad(activatedWhileWindowOpen) {
  WL.injectCSS("chrome://accountcolors-skin/content/accountcolors-composewindow.css");

  WL.injectElements(
    `
    <toolbar id="compose-toolbar-menubar2">
        <toolbaritem id="menubar-items">
            <menubar id="mail-menubar">
                <menu id="tasksMenu">
                    <menupopup id="taskPopup">
                        <menuitem id="accountcolors-toolsmenu-options" label="&accountcolors.options;" accesskey="&accountcolors.options.ak;"
                                  oncommand="accountColorsCompose.cmdOptions();" insertbefore="menu_preferences"/>
                    </menupopup>
                </menu>
            </menubar>
        </toolbaritem>
    </toolbar>
`,
    ["chrome://accountcolors/locale/accountcolors.dtd"]
  );

  window.accountColorsCompose.onLoad();
}

function onUnload(deactivatedWhileWindowOpen) {
  // Cleaning up the window UI is only needed when the
  // add-on is being deactivated/removed while the window
  // is still open. It can be skipped otherwise.
  if (!deactivatedWhileWindowOpen) {
    return;
  }

  window.accountColorsCompose.onUnload();
}
