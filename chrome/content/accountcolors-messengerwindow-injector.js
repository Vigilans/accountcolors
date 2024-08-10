// Import any needed modules.
var Services = globalThis.Services ||
  ChromeUtils.import("resource://gre/modules/Services.jsm").Services;

// Load an additional JavaScript file.
Services.scriptloader.loadSubScript("chrome://accountcolors/content/accountcolors-utilities.js", window, "UTF-8");
Services.scriptloader.loadSubScript("chrome://accountcolors/content/accountcolors-messengerwindow.js", window, "UTF-8");
if (window.accountColorsUtilities.thunderbirdVersion.major <= 102) {
  Services.scriptloader.loadSubScript("chrome://accountcolors/content/accountcolors-aboutmessage.js", window, "UTF-8");
  Services.scriptloader.loadSubScript("chrome://accountcolors/content/accountcolors-about3pane.js", window, "UTF-8");
}

function onLoad(activatedWhileWindowOpen) {
  if (window.accountColorsUtilities.thunderbirdVersion.major <= 102) {
    // Legacy CSS for elements in this messenger window prior to TB 102
    WL.injectCSS("chrome://accountcolors-skin/content/accountcolors-messengerwindow-generated.css");
    WL.injectCSS("chrome://accountcolors-skin/content/accountcolors-messengerwindow.css");
  }

  if (window.accountColorsUtilities.thunderbirdVersion.major >= 115) { // toolbaritem element removed since TB 115
    WL.injectElements(
      `
      <toolbar id="toolbar-menubar">
            <menubar id="mail-menubar">
                <menu id="tasksMenu">
                    <menupopup id="taskPopup">
                        <menuitem id="accountcolors-toolsmenu-options" label="&accountcolors.options;" accesskey="&accountcolors.options.ak;"
                                  oncommand="accountColorsMessenger.cmdOptions();" insertafter="menu_accountmgr"/>
                    </menupopup>
                </menu>
            </menubar>
      </toolbar>
`,
      ["chrome://accountcolors/locale/accountcolors.dtd"]
    );
  } if (window.accountColorsUtilities.thunderbirdVersion.major >= 102) { // toolbar id changed to `toolbar-menubar` since TB 102
    WL.injectElements(
      `
      <toolbar id="toolbar-menubar">
          <toolbaritem id="menubar-items">
              <menubar id="mail-menubar">
                  <menu id="tasksMenu">
                      <menupopup id="taskPopup">
                          <menuitem id="accountcolors-toolsmenu-options" label="&accountcolors.options;" accesskey="&accountcolors.options.ak;"
                                    oncommand="accountColorsMessenger.cmdOptions();" insertafter="menu_accountmgr"/>
                      </menupopup>
                  </menu>
              </menubar>
          </toolbaritem>
      </toolbar>
`,
      ["chrome://accountcolors/locale/accountcolors.dtd"]
    );
  } else {
    WL.injectElements(
      `
      <toolbar id="mail-toolbar-menubar2">
          <toolbaritem id="menubar-items">
              <menubar id="mail-menubar">
                  <menu id="tasksMenu">
                      <menupopup id="taskPopup">
                          <menuitem id="accountcolors-toolsmenu-options" label="&accountcolors.options;" accesskey="&accountcolors.options.ak;"
                                    oncommand="accountColorsMessenger.cmdOptions();" insertbefore="menu_preferences"/>
                      </menupopup>
                  </menu>
              </menubar>
          </toolbaritem>
      </toolbar>
`,
      ["chrome://accountcolors/locale/accountcolors.dtd"]
    );
  }

  window.accountColorsMessenger.onLoad();
}

function onUnload(deactivatedWhileWindowOpen) {
  // Cleaning up the window UI is only needed when the
  // add-on is being deactivated/removed while the window
  // is still open. It can be skipped otherwise.
  if (!deactivatedWhileWindowOpen) {
    return;
  }

  window.accountColorsMessenger.onUnload();
}
