/************************************************************************/
/*                                                                      */
/*      Account Colors  -  Thunderbird Extension  -  Options            */
/*                                                                      */
/*      Javascript for Options dialog                                   */
/*                                                                      */
/*      Copyright (C) 2008-2019  by  DW-dev                             */
/*      Copyright (C) 2022-2022  by  MrMelon54                          */
/*                                                                      */
/*      Last Edit  -  15 Jul 2022                                       */
/*                                                                      */
/************************************************************************/

"use strict";

var accountColorsOptions = {

  runtime: Components.classes["@mozilla.org/xre/app-info;1"].getService(Components.interfaces.nsIXULRuntime),

  prefs: Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("extensions.accountcolors."),

  accountManager: Components.classes["@mozilla.org/messenger/account-manager;1"].getService(Components.interfaces.nsIMsgAccountManager),

  theme: null,

  pickerButton: null,

  /********************************************************************/

  /* Init accountColorsOptions */

  onLoad() {
    // Resolve thunderbird current theme before initPrefs
    return new Promise(function (resolve, reject) {
      var theme = null;
      var timeoutId = setTimeout(reject, 10000, "timeout waiting for theme");
      var enumerator = Services.ww.getWindowEnumerator();
      while (enumerator.hasMoreElements()) {
        enumerator.getNext().document.querySelectorAll("browser").forEach(function (browser) {
          if (!theme && browser.messageManager != null) {
            var script = "data:text/plain," + encodeURIComponent(`
              if (content.wrappedJSObject.browser != null) {
                content.wrappedJSObject.browser.theme.getCurrent().then(theme => {
                  sendAsyncMessage("accountcolors-thunderbird-theme-${browser.browserId}", theme)
                });
              } else {
                sendAsyncMessage("accountcolors-thunderbird-theme-${browser.browserId}", null)
              }
            `);
            browser.messageManager.addMessageListener(`accountcolors-thunderbird-theme-${browser.browserId}`, function removeMe(message) {
              browser.messageManager.removeMessageListener(`accountcolors-thunderbird-theme-${browser.browserId}`, removeMe);
              if (message.data != null && theme == null) {
                theme = message.data;
                theme.properties = theme.properties || { color_scheme: "light" };
                theme.colors = theme.colors || { textcolor: null, backgroundcolor: null };
                theme.colors.textcolor = theme.colors.textcolor || (theme.properties.color_scheme == "dark" ? "#FFFFFF" : "#000000"); // Font color
                theme.colors.backgroundcolor = theme.colors.backgroundcolor || (theme.properties.color_scheme == "dark" ? "#000000" : "#FFFFFF"); // Background color
                clearTimeout(timeoutId);
                resolve(theme);
              }
            });
            browser.messageManager.loadFrameScript(script, false);
          }
        });
      }
    }).then(theme => {
      accountColorsOptions.theme = theme;
      accountColorsOptions.initPrefs();
    });
  },

  /* Initialise preferences */

  initPrefs: function () {
    var container, template, accountidbox, account, identity, index, acc, id;
    var background, menulist, color, fontstyle, fontsize, value;
    var checkbox, checkstate;
    var accounts = new Array();
    var identities = new Array();

    /* Add listener for dialog accept button (OK) */

    document.addEventListener("dialogaccept", function (event) {
      accountColorsOptions.savePrefs();
    });

    /* Add listener for dialog extra1 button (Apply) */

    document.addEventListener("dialogextra1", function (event) {
      accountColorsOptions.savePrefs();

      event.preventDefault(); /* prevent dialog closing */
    });

    /* Add listeners for click on font/background palette panels */

    document.getElementById("accountcolors-picker-fontpalette-panel").addEventListener("click", accountColorsOptions.pickerPaletteChange, false);
    document.getElementById("accountcolors-picker-bkgdpalette-panel").addEventListener("click", accountColorsOptions.pickerPaletteChange, false);

    /* Color scheme for dialogs page */
    document.getElementById("accountcolors-options").style.setProperty("color-scheme", accountColorsOptions.theme.properties.color_scheme);
    if (accountColorsOptions.theme.properties.color_scheme == "dark") {
      color = window.getComputedStyle(document.getElementById("accountcolors-options")).backgroundColor.match(/\d+/g).map(Number);
      document.documentElement.style.setProperty("--unselected-tab-color", `rgb(${Math.min(color[0] + 3, 255)}, ${Math.min(color[1] + 3, 255)}, ${Math.min(color[2] + 3, 255)})`);
      document.documentElement.style.setProperty("--selected-tab-color", `rgb(${Math.min(color[0] + 9, 255)}, ${Math.min(color[1] + 9, 255)}, ${Math.min(color[2] + 9, 255)})`);
    } else {
      document.documentElement.style.setProperty("--unselected-tab-color", ""); // Default setup is better for light scheme
      document.documentElement.style.setProperty("--selected-tab-color", "");
    }

    /* Account/Identity Colors */

    index = 0;

    accounts = accountColorsOptions.accountManager.accounts;

    for (acc = 0; acc < accountColorsUtilities.getLength(accounts); acc++) {
      account = accountColorsUtilities.getAccount(accounts, acc);

      identities = account.identities;

      if (accountColorsUtilities.getLength(identities) == 0) {
        /* Local Folders account or Blogs & Newsfeeds account */
        container = document.getElementById("accountcolors-accountidbox-container"); /* accountidbox container */
        template = document.getElementById("accountcolors-accountidbox"); /* accountidbox template */

        accountidbox = container.appendChild(template.cloneNode(true)); /* add new accountidbox */

        accountidbox.setAttribute("id", "accountcolors-accountidbox" + index);
        accountidbox.children[0].setAttribute("id", "accountcolors-accountname" + index);
        accountidbox.children[1].setAttribute("id", "accountcolors-identityname" + index);
        accountidbox.children[2].setAttribute("id", "accountcolors-fontpicker" + index);
        accountidbox.children[3].setAttribute("id", "accountcolors-bkgdpicker" + index);

        document.getElementById("accountcolors-accountidbox" + index).setAttribute("ac-accountidkey", account.key);
        document.getElementById("accountcolors-accountidbox" + index).setAttribute("ac-accountidtype", "account");
        document.getElementById("accountcolors-accountidbox" + index).hidden = false;

        document.getElementById("accountcolors-identityname" + index).style.borderColor = "#E0E0E0";
        document.getElementById("accountcolors-identityname" + index).style.backgroundColor = "#F0F0F0";

        document.getElementById("accountcolors-accountname" + index).value = account.incomingServer.prettyName;

        try {
          color = accountColorsOptions.pickerSetColor("accountcolors-fontpicker" + index, accountColorsOptions.prefs.getCharPref(account.key + "-fontcolor"));
          document.getElementById("accountcolors-accountname" + index).style.color = color;
        } catch (e) {
          if (account.incomingServer == accountColorsOptions.accountManager.localFoldersServer) {
            try {
              /* compatibility with Version 3.0 */
              color = accountColorsOptions.pickerSetColor("accountcolors-fontpicker" + index, accountColorsOptions.prefs.getCharPref("idLF" + "-fontcolor"));
              document.getElementById("accountcolors-accountname" + index).style.color = color;
            } catch (e) {
              color = accountColorsOptions.pickerSetColor("accountcolors-fontpicker" + index, "");
              document.getElementById("accountcolors-accountname" + index).style.color = color;
            }
          } else {
            color = accountColorsOptions.pickerSetColor("accountcolors-fontpicker" + index, "");
            document.getElementById("accountcolors-accountname" + index).style.color = "";
          }
        }

        try {
          color = accountColorsOptions.pickerSetColor("accountcolors-bkgdpicker" + index, accountColorsOptions.prefs.getCharPref(account.key + "-bkgdcolor"));
          document.getElementById("accountcolors-accountname" + index).style.backgroundColor = color;
        } catch (e) {
          if (account.incomingServer == accountColorsOptions.accountManager.localFoldersServer) {
            try {
              /* compatibility with Version 3.0 */
              color = accountColorsOptions.pickerSetColor("accountcolors-bkgdpicker" + index, accountColorsOptions.prefs.getCharPref("idLF" + "-bkgdcolor"));
              document.getElementById("accountcolors-accountname" + index).style.backgroundColor = color;
            } catch (e) {
              color = accountColorsOptions.pickerSetColor("accountcolors-bkgdpicker" + index, "");
              document.getElementById("accountcolors-accountname" + index).style.backgroundColor = color;
            }
          } else {
            color = accountColorsOptions.pickerSetColor("accountcolors-bkgdpicker" + index, "");
            document.getElementById("accountcolors-accountname" + index).style.backgroundColor = color;
          }
        }

        index++;
      } else {
        for (id = 0; id < accountColorsUtilities.getLength(identities); id++) {
          container = document.getElementById("accountcolors-accountidbox-container"); /* accountidbox container */
          template = document.getElementById("accountcolors-accountidbox"); /* accountidbox template */

          accountidbox = container.appendChild(template.cloneNode(true)); /* add new accountidbox */

          accountidbox.setAttribute("id", "accountcolors-accountidbox" + index);
          accountidbox.children[0].setAttribute("id", "accountcolors-accountname" + index);
          accountidbox.children[1].setAttribute("id", "accountcolors-identityname" + index);
          accountidbox.children[2].setAttribute("id", "accountcolors-fontpicker" + index);
          accountidbox.children[3].setAttribute("id", "accountcolors-bkgdpicker" + index);

          identity = accountColorsUtilities.getIdentity(identities, id);

          document.getElementById("accountcolors-accountidbox" + index).setAttribute("ac-accountidkey", identity.key);
          document.getElementById("accountcolors-accountidbox" + index).setAttribute("ac-accountidtype", "accountid");
          document.getElementById("accountcolors-accountidbox" + index).hidden = false;

          if (id > 0) {
            /* not default identity */
            document.getElementById("accountcolors-accountidbox" + index).setAttribute("ac-accountidtype", "id");
            document.getElementById("accountcolors-accountname" + index).style.visibility = "hidden";
          }

          document.getElementById("accountcolors-accountname" + index).value = account.incomingServer.prettyName;
          document.getElementById("accountcolors-identityname" + index).value = identity.identityName;

          try {
            color = accountColorsOptions.pickerSetColor("accountcolors-fontpicker" + index, accountColorsOptions.prefs.getCharPref(identity.key + "-fontcolor"));
            document.getElementById("accountcolors-accountname" + index).style.color = color;
            document.getElementById("accountcolors-identityname" + index).style.color = color;
          } catch (e) {
            try {
              /* compatibility with Version 2.0 */
              color = accountColorsOptions.pickerSetColor("accountcolors-fontpicker" + index, accountColorsOptions.prefs.getCharPref(account.key + "-fontcolor"));
              document.getElementById("accountcolors-accountname" + index).style.color = color;
              document.getElementById("accountcolors-identityname" + index).style.color = color;
            } catch (e) {
              color = accountColorsOptions.pickerSetColor("accountcolors-fontpicker" + index, "");
              document.getElementById("accountcolors-accountname" + index).style.color = color;
              document.getElementById("accountcolors-identityname" + index).style.color = color;
              ;
            }
          }

          try {
            color = accountColorsOptions.pickerSetColor("accountcolors-bkgdpicker" + index, accountColorsOptions.prefs.getCharPref(identity.key + "-bkgdcolor"));
            document.getElementById("accountcolors-accountname" + index).style.backgroundColor = color;
            document.getElementById("accountcolors-identityname" + index).style.backgroundColor = color;
          } catch (e) {
            try {
              /* compatibility with Version 2.0 */
              color = accountColorsOptions.pickerSetColor("accountcolors-bkgdpicker" + index, accountColorsOptions.prefs.getCharPref(account.key + "-bkgdcolor"));
              document.getElementById("accountcolors-accountname" + index).style.backgroundColor = color;
              document.getElementById("accountcolors-identityname" + index).style.backgroundColor = color;
            } catch (e) {
              color = accountColorsOptions.pickerSetColor("accountcolors-bkgdpicker" + index, "");;
              document.getElementById("accountcolors-accountname" + index).style.backgroundColor = color;
              document.getElementById("accountcolors-identityname" + index).style.backgroundColor = color;
            }
          }

          index++;
        }
      }
    }

    container = document.getElementById("accountcolors-accountidbox-container"); /* accountidbox container */
    template = document.getElementById("accountcolors-accountidbox"); /* accountidbox template */
    container.removeChild(template);

    /* Folder Pane Options */

    checkbox = document.getElementById("accountcolors-folder-setfontstyle");
    try {
      checkstate = accountColorsOptions.prefs.getBoolPref("folder-setfontstyle");
      checkbox.checked = checkstate;
    } catch (e) {
      checkbox.checked = false;
    }

    menulist = document.getElementById("accountcolors-folder-fontstyle");
    menulist.disabled = !checkbox.checked;
    menulist.appendItem("Normal", 0);
    menulist.appendItem("Italic", 1);
    menulist.appendItem("Bold", 2);
    menulist.appendItem("Bold Italic", 3);
    try {
      fontstyle = accountColorsOptions.prefs.getIntPref("folder-fontstyle");
      menulist.selectedIndex = fontstyle;
    } catch (e) {
      menulist.selectedIndex = 2;
    }

    checkbox = document.getElementById("accountcolors-folder-setfontsize");
    try {
      checkstate = accountColorsOptions.prefs.getBoolPref("folder-setfontsize");
      checkbox.checked = checkstate;
    } catch (e) {
      checkbox.checked = false;
    }

    menulist = document.getElementById("accountcolors-folder-fontsize");
    menulist.disabled = !checkbox.checked;
    for (index = 10; index <= 18; index++) {
      menulist.appendItem(index, index);
    }
    try {
      fontsize = accountColorsOptions.prefs.getIntPref("folder-fontsize");
      menulist.selectedIndex = fontsize - 10;
    } catch (e) {
      menulist.selectedIndex = 2;
    }

    checkbox = document.getElementById("accountcolors-folder-colorfont");
    try {
      checkstate = accountColorsOptions.prefs.getBoolPref("folder-colorfont");
      checkbox.checked = checkstate;
    } catch (e) {
      checkbox.checked = false;
    }

    checkbox = document.getElementById("accountcolors-folder-colorbkgd");
    try {
      checkstate = accountColorsOptions.prefs.getBoolPref("folder-colorbkgd");
      checkbox.checked = checkstate;
    } catch (e) {
      checkbox.checked = false;
    }

    checkbox = document.getElementById("accountcolors-folder-colorfldfont");
    try {
      checkstate = accountColorsOptions.prefs.getBoolPref("folder-colorfldfont");
      checkbox.checked = checkstate;
    } catch (e) {
      checkbox.checked = false;
    }

    checkbox = document.getElementById("accountcolors-folder-colorfldbkgd");
    try {
      checkstate = accountColorsOptions.prefs.getBoolPref("folder-colorfldbkgd");
      checkbox.checked = checkstate;
    } catch (e) {
      checkbox.checked = false;
    }

    checkbox = document.getElementById("accountcolors-folder-colorother");
    try {
      checkstate = accountColorsOptions.prefs.getBoolPref("folder-colorother");
      checkbox.checked = checkstate;
    } catch (e) {
      checkbox.checked = false;
    }

    checkbox = document.getElementById("accountcolors-folder-colorotherbkgd");
    try {
      if (accountColorsUtilities.thunderbirdVersion.major > 102) {
        checkstate = accountColorsOptions.prefs.getBoolPref("folder-colorotherbkgd");
        checkbox.checked = checkstate;
      } else {
        checkbox.style.display = "none"; // Hide option for thunderbird 102 and below, as not implemented for legacy mail frontend
      }
    } catch (e) {
      checkbox.checked = false;
    }

    checkbox = document.getElementById("accountcolors-folder-blackrowfont");
    try {
      if (accountColorsUtilities.thunderbirdVersion.major <= 102) {
        checkstate = accountColorsOptions.prefs.getBoolPref("folder-blackrowfont");
        checkbox.checked = checkstate;
      } else {
        checkbox.style.display = "none"; // Hide option for thunderbird 103+, as thunderbird theme does better job
      }
    } catch (e) {
      checkbox.checked = false;
    }

    checkbox = document.getElementById("accountcolors-folder-lightpanebkgd");
    try {
      if (accountColorsUtilities.thunderbirdVersion.major <= 102) {
        checkstate = accountColorsOptions.prefs.getBoolPref("folder-lightpanebkgd");
        checkbox.checked = checkstate;
      } else {
        checkbox.style.display = "none"; // Hide option for thunderbird 103+, as thunderbird theme does better job
      }
    } catch (e) {
      checkbox.checked = false;
    }

    checkbox = document.getElementById("accountcolors-folder-whiterowfont");
    try {
      if (accountColorsUtilities.thunderbirdVersion.major <= 102) {
        checkstate = accountColorsOptions.prefs.getBoolPref("folder-whiterowfont");
        checkbox.checked = checkstate;
      } else {
        checkbox.style.display = "none"; // Hide option for thunderbird 103+, as thunderbird theme does better job
      }
    } catch (e) {
      checkbox.checked = false;
    }

    checkbox = document.getElementById("accountcolors-folder-darkpanebkgd");
    try {
      if (accountColorsUtilities.thunderbirdVersion.major <= 102) {
        checkstate = accountColorsOptions.prefs.getBoolPref("folder-darkpanebkgd");
        checkbox.checked = checkstate;
      } else {
        checkbox.style.display = "none"; // Hide option for thunderbird 103+, as thunderbird theme does better job
      }
    } catch (e) {
      checkbox.checked = false;
    }

    // checkbox = document.getElementById("accountcolors-folder-defaultbkgd");
    // try {
    //   checkstate = accountColorsOptions.prefs.getBoolPref("folder-defaultbkgd");
    //   checkbox.checked = checkstate;
    // } catch (e) {
    //   checkbox.checked = false;
    // }

    checkbox = document.getElementById("accountcolors-folder-boldnewmail");
    try {
      checkstate = accountColorsOptions.prefs.getBoolPref("folder-boldnewmail");
      checkbox.checked = checkstate;
    } catch (e) {
      checkbox.checked = false;
    }

    checkbox = document.getElementById("accountcolors-folder-undernewmail");
    try {
      checkstate = accountColorsOptions.prefs.getBoolPref("folder-undernewmail");
      checkbox.checked = checkstate;
    } catch (e) {
      checkbox.checked = false;
    }

    checkbox = document.getElementById("accountcolors-folder-noboldunread");
    try {
      checkstate = accountColorsOptions.prefs.getBoolPref("folder-noboldunread");
      checkbox.checked = checkstate;
    } catch (e) {
      checkbox.checked = false;
    }

    checkbox = document.getElementById("accountcolors-folder-showlines");
    try {
      if (accountColorsUtilities.thunderbirdVersion.major <= 102) {
        checkstate = accountColorsOptions.prefs.getBoolPref("folder-showlines");
        checkbox.checked = checkstate;
      } else {
        checkbox.style.display = "none"; // Hide option for thunderbird 103+, as tree-line is no longer native in folder tree view
      }
    } catch (e) {
      checkbox.checked = false;
    }

    checkbox = document.getElementById("accountcolors-folder-darkerbar");
    try {
      if (accountColorsUtilities.thunderbirdVersion.major <= 68) {
        checkstate = accountColorsOptions.prefs.getBoolPref("folder-darkerbar");
        checkbox.checked = checkstate;
      } else {
        checkbox.style.display = "none"; // Hide option for thunderbird 103+ with new mail frontend
      }
    } catch (e) {
      checkbox.checked = false;
    }

    checkbox = document.getElementById("accountcolors-folder-incspacing");
    try {
      checkstate = accountColorsOptions.prefs.getBoolPref("folder-incspacing");
      checkbox.checked = checkstate;
    } catch (e) {
      checkbox.checked = false;
    }

    checkbox = document.getElementById("accountcolors-folder-hoverselect");
    try {
      if (accountColorsUtilities.thunderbirdVersion.major <= 102) {
        checkstate = accountColorsOptions.prefs.getBoolPref("folder-hoverselect");
        checkbox.checked = checkstate;
      } else {
        checkbox.style.display = "none"; // Hide option for thunderbird 103+, as it is always enabled and strictly stick to system default
      }
    } catch (e) {
      checkbox.checked = false;
    }

    checkbox = document.getElementById("accountcolors-folder-colorbkgd-account-icon");
    try {
      if (accountColorsUtilities.thunderbirdVersion.major > 102) {
        checkstate = accountColorsOptions.prefs.getBoolPref("folder-colorbkgd-account-icon");
        checkbox.checked = checkstate;
      } else {
        checkbox.style.display = "none"; // Hide option for thunderbird 102 and below, as not implemented for legacy mail frontend
      }
    } catch (e) {
      checkbox.checked = false;
    }

    checkbox = document.getElementById("accountcolors-folder-colorbkgd-folder-icon");
    try {
      if (accountColorsUtilities.thunderbirdVersion.major > 102) {
        checkstate = accountColorsOptions.prefs.getBoolPref("folder-colorbkgd-folder-icon");
        checkbox.checked = checkstate;
      } else {
        checkbox.style.display = "none"; // Hide option for thunderbird 102 and below, as not implemented for legacy mail frontend
      }
    } catch (e) {
      checkbox.checked = false;
    }

    /* Thread Pane Options */

    checkbox = document.getElementById("accountcolors-thread-setfontstyle");
    try {
      checkstate = accountColorsOptions.prefs.getBoolPref("thread-setfontstyle");
      checkbox.checked = checkstate;
    } catch (e) {
      checkbox.checked = false;
    }

    menulist = document.getElementById("accountcolors-thread-fontstyle");
    menulist.disabled = !checkbox.checked;
    menulist.appendItem("Normal", 0);
    menulist.appendItem("Italic", 1);
    menulist.appendItem("Bold", 2);
    menulist.appendItem("Bold Italic", 3);
    try {
      fontstyle = accountColorsOptions.prefs.getIntPref("thread-fontstyle");
      menulist.selectedIndex = fontstyle;
    } catch (e) {
      menulist.selectedIndex = 0;
    }

    checkbox = document.getElementById("accountcolors-thread-setfontsize");
    try {
      checkstate = accountColorsOptions.prefs.getBoolPref("thread-setfontsize");
      checkbox.checked = checkstate;
    } catch (e) {
      checkbox.checked = false;
    }

    menulist = document.getElementById("accountcolors-thread-fontsize");
    menulist.disabled = !checkbox.checked;
    for (index = 10; index <= 18; index++) {
      menulist.appendItem(index, index);
    }
    try {
      fontsize = accountColorsOptions.prefs.getIntPref("thread-fontsize");
      menulist.selectedIndex = fontsize - 10;
    } catch (e) {
      menulist.selectedIndex = 2;
    }

    checkbox = document.getElementById("accountcolors-thread-setfromstyle");
    try {
      checkstate = accountColorsOptions.prefs.getBoolPref("thread-setfromstyle");
      checkbox.checked = checkstate;
    } catch (e) {
      checkbox.checked = false;
    }

    menulist = document.getElementById("accountcolors-thread-fromstyle");
    menulist.disabled = !checkbox.checked;
    menulist.appendItem("Normal", 0);
    menulist.appendItem("Italic", 1);
    menulist.appendItem("Bold", 2);
    menulist.appendItem("Bold Italic", 3);
    try {
      fontstyle = accountColorsOptions.prefs.getIntPref("thread-fromstyle");
      menulist.selectedIndex = fontstyle;
    } catch (e) {
      menulist.selectedIndex = 0;
    }

    checkbox = document.getElementById("accountcolors-thread-setfromsize");
    try {
      checkstate = accountColorsOptions.prefs.getBoolPref("thread-setfromsize");
      checkbox.checked = checkstate;
    } catch (e) {
      checkbox.checked = false;
    }

    menulist = document.getElementById("accountcolors-thread-fromsize");
    menulist.disabled = !checkbox.checked;
    for (index = 10; index <= 18; index++) {
      menulist.appendItem(index, index);
    }
    try {
      fontsize = accountColorsOptions.prefs.getIntPref("thread-fromsize");
      menulist.selectedIndex = fontsize - 10;
    } catch (e) {
      menulist.selectedIndex = 2;
    }

    checkbox = document.getElementById("accountcolors-thread-colorfont");
    try {
      checkstate = accountColorsOptions.prefs.getBoolPref("thread-colorfont");
      checkbox.checked = checkstate;
    } catch (e) {
      checkbox.checked = false;
    }

    checkbox = document.getElementById("accountcolors-thread-colorbkgd");
    try {
      checkstate = accountColorsOptions.prefs.getBoolPref("thread-colorbkgd");
      checkbox.checked = checkstate;
    } catch (e) {
      checkbox.checked = false;
    }

    checkbox = document.getElementById("accountcolors-thread-colorfrom");
    try {
      checkstate = accountColorsOptions.prefs.getBoolPref("thread-colorfrom");
      checkbox.checked = checkstate;
    } catch (e) {
      checkbox.checked = false;
    }

    checkbox = document.getElementById("accountcolors-thread-colorother");
    try {
      checkstate = accountColorsOptions.prefs.getBoolPref("thread-colorother");
      checkbox.checked = checkstate;
    } catch (e) {
      checkbox.checked = false;
    }

    checkbox = document.getElementById("accountcolors-thread-colorpanebkgd");
    try {
      if (accountColorsUtilities.thunderbirdVersion.major > 102) {
        checkstate = accountColorsOptions.prefs.getBoolPref("thread-colorpanebkgd");
        checkbox.checked = checkstate;
      } else {
        checkbox.style.display = "none"; // Hide option for thunderbird 102 and below, as not implemented for legacy mail frontend
      }
    } catch (e) {
      checkbox.checked = false;
    }

    checkbox = document.getElementById("accountcolors-thread-blackrowfont");
    try {
      if (accountColorsUtilities.thunderbirdVersion.major <= 102) {
        checkstate = accountColorsOptions.prefs.getBoolPref("thread-blackrowfont");
        checkbox.checked = checkstate;
      } else {
        checkbox.style.display = "none"; // Hide option for thunderbird 103+, as thunderbird theme does better job
      }
    } catch (e) {
      checkbox.checked = false;
    }

    checkbox = document.getElementById("accountcolors-thread-lightpanebkgd");
    try {
      if (accountColorsUtilities.thunderbirdVersion.major <= 102) {
        checkstate = accountColorsOptions.prefs.getBoolPref("thread-lightpanebkgd");
        checkbox.checked = checkstate;
      } else {
        checkbox.style.display = "none"; // Hide option for thunderbird 103+, as thunderbird theme does better job
      }
    } catch (e) {
      checkbox.checked = false;
    }

    checkbox = document.getElementById("accountcolors-thread-whiterowfont");
    try {
      if (accountColorsUtilities.thunderbirdVersion.major <= 102) {
        checkstate = accountColorsOptions.prefs.getBoolPref("thread-whiterowfont");
        checkbox.checked = checkstate;
      } else {
        checkbox.style.display = "none"; // Hide option for thunderbird 103+, as thunderbird theme does better job
      }
    } catch (e) {
      checkbox.checked = false;
    }

    checkbox = document.getElementById("accountcolors-thread-darkpanebkgd");
    try {
      if (accountColorsUtilities.thunderbirdVersion.major <= 102) {
        checkstate = accountColorsOptions.prefs.getBoolPref("thread-darkpanebkgd");
        checkbox.checked = checkstate;
      } else {
        checkbox.style.display = "none"; // Hide option for thunderbird 103+, as thunderbird theme does better job
      }
    } catch (e) {
      checkbox.checked = false;
    }

    checkbox = document.getElementById("accountcolors-thread-hdraccount");
    try {
      checkstate = accountColorsOptions.prefs.getBoolPref("thread-hdraccount");
      checkbox.checked = checkstate;
    } catch (e) {
      checkbox.checked = false;
    }

    checkbox = document.getElementById("accountcolors-thread-boldsubject");
    try {
      checkstate = accountColorsOptions.prefs.getBoolPref("thread-boldsubject");
      checkbox.checked = checkstate;
    } catch (e) {
      checkbox.checked = false;
    }

    checkbox = document.getElementById("accountcolors-thread-boldfrom");
    try {
      checkstate = accountColorsOptions.prefs.getBoolPref("thread-boldfrom");
      checkbox.checked = checkstate;
    } catch (e) {
      checkbox.checked = false;
    }

    checkbox = document.getElementById("accountcolors-thread-showstripes");
    try {
      if (accountColorsUtilities.thunderbirdVersion.major <= 68) {
        checkstate = accountColorsOptions.prefs.getBoolPref("thread-showstripes");
        checkbox.checked = checkstate;
      } else {
        checkbox.style.display = "none"; // Hide option for newer thunderbird, as it is not working (and not having figured out why)
      }
    } catch (e) {
      checkbox.checked = false;
    }

    checkbox = document.getElementById("accountcolors-thread-darkerbar");
    try {
      if (accountColorsUtilities.thunderbirdVersion.major <= 68) {
        checkstate = accountColorsOptions.prefs.getBoolPref("thread-darkerbar");
        checkbox.checked = checkstate;
      } else {
        checkbox.style.display = "none"; // Hide option for thunderbird 103+ with new mail frontend
      }
    } catch (e) {
      checkbox.checked = false;
    }

    checkbox = document.getElementById("accountcolors-thread-incspacing");
    try {
      checkstate = accountColorsOptions.prefs.getBoolPref("thread-incspacing");
      checkbox.checked = checkstate;
    } catch (e) {
      checkbox.checked = false;
    }

    checkbox = document.getElementById("accountcolors-thread-hoverselect");
    try {
      if (accountColorsUtilities.thunderbirdVersion.major <= 102) {
        checkstate = accountColorsOptions.prefs.getBoolPref("thread-hoverselect");
        checkbox.checked = checkstate;
      } else {
        checkbox.style.display = "none"; // Hide option for thunderbird 103+, as it is always enabled and strictly stick to system default
      }
    } catch (e) {
      checkbox.checked = false;
    }

    checkbox = document.getElementById("accountcolors-thread-colorbkgd-row-label");
    try {
      if (accountColorsUtilities.thunderbirdVersion.major > 102) {
        checkstate = accountColorsOptions.prefs.getBoolPref("thread-colorbkgd-row-label");
        checkbox.checked = checkstate;
      } else {
        checkbox.style.display = "none"; // Hide option for thunderbird 102 and below, as not implemented for legacy mail frontend
      }
    } catch (e) {
      checkbox.checked = false;
    }

    menulist = document.getElementById("accountcolors-thread-row-label-position");
    menulist.disabled = !checkbox.checked;
    menulist.appendItem("Subject Column", 0);
    menulist.appendItem("First Column", 1);
    try {
      if (accountColorsUtilities.thunderbirdVersion.major > 102) {
        value = accountColorsOptions.prefs.getIntPref("thread-row-label-position");
        menulist.selectedIndex = value;
      } else {
        menulist.style.display = "none"; // Hide option for thunderbird 102 and below, as not implemented for legacy mail frontend
      }
    } catch (e) {
      menulist.selectedIndex = 0;
    }

    menulist = document.getElementById("accountcolors-thread-row-label-width");
    menulist.disabled = !checkbox.checked;
    menulist.appendItem("Width: 1", 1);
    menulist.appendItem("Width: 2", 2);
    menulist.appendItem("Width: 3", 3);
    menulist.appendItem("Width: 4", 4);
    menulist.appendItem("Width: 5", 5);
    menulist.appendItem("Width: 6", 6);
    menulist.appendItem("Width: 7", 7);
    menulist.appendItem("Width: 8", 8);
    menulist.appendItem("Width: 9", 9);
    menulist.appendItem("Width: 10", 10);
    menulist.appendItem("Width: 11", 11);
    menulist.appendItem("Width: 12", 12);
    try {
      if (accountColorsUtilities.thunderbirdVersion.major > 102) {
        value = accountColorsOptions.prefs.getIntPref("thread-row-label-width");
        menulist.selectedIndex = value - 1;
      } else {
        menulist.style.display = "none"; // Hide option for thunderbird 102 and below, as not implemented for legacy mail frontend
      }
    } catch (e) {
      menulist.selectedIndex = 1;
    }

    checkbox = document.getElementById("accountcolors-thread-colorbkgd-card-label");
    try {
      if (accountColorsUtilities.thunderbirdVersion.major > 102) {
        checkstate = accountColorsOptions.prefs.getBoolPref("thread-colorbkgd-card-label");
        checkbox.checked = checkstate;
      } else {
        checkbox.style.display = "none"; // Hide option for thunderbird 102 and below, as not implemented for legacy mail frontend
      }
    } catch (e) {
      checkbox.checked = false;
    }

    menulist = document.getElementById("accountcolors-thread-card-label-indent");
    menulist.disabled = !checkbox.checked;
    menulist.appendItem("No Indent", 0);
    menulist.appendItem("Indent", 1);
    try {
      if (accountColorsUtilities.thunderbirdVersion.major > 102) {
        value = accountColorsOptions.prefs.getIntPref("thread-card-label-position");
        menulist.selectedIndex = value;
      } else {
        menulist.style.display = "none"; // Hide option for thunderbird 102 and below, as not implemented for legacy mail frontend
      }
    } catch (e) {
      menulist.selectedIndex = 0;
    }

    menulist = document.getElementById("accountcolors-thread-card-label-width");
    menulist.disabled = !checkbox.checked;
    menulist.appendItem("Width: 1", 1);
    menulist.appendItem("Width: 2", 2);
    menulist.appendItem("Width: 3", 3);
    menulist.appendItem("Width: 4", 4);
    menulist.appendItem("Width: 5", 5);
    menulist.appendItem("Width: 6", 6);
    menulist.appendItem("Width: 7", 7);
    menulist.appendItem("Width: 8", 8);
    menulist.appendItem("Width: 9", 9);
    menulist.appendItem("Width: 10", 10);
    menulist.appendItem("Width: 11", 11);
    menulist.appendItem("Width: 12", 12);
    try {
      if (accountColorsUtilities.thunderbirdVersion.major > 102) {
        value = accountColorsOptions.prefs.getIntPref("thread-card-label-width");
        menulist.selectedIndex = value - 1;
      } else {
        menulist.style.display = "none"; // Hide option for thunderbird 102 and below, as not implemented for legacy mail frontend
      }
    } catch (e) {
      menulist.selectedIndex = 1;
    }

    checkbox = document.getElementById("accountcolors-thread-color-unified-only");
    try {
      if (accountColorsUtilities.thunderbirdVersion.major > 102) {
        checkstate = accountColorsOptions.prefs.getBoolPref("thread-color-unified-only");
        checkbox.checked = checkstate;
      } else {
        checkbox.style.display = "none"; // Hide option for thunderbird 102 and below, as not implemented for legacy mail frontend
      }
    } catch (e) {
      checkbox.checked = false;
    }

    /* Message Pane, Message Tab & Message Window Options */

    checkbox = document.getElementById("accountcolors-message-setfontstyle");
    try {
      checkstate = accountColorsOptions.prefs.getBoolPref("message-setfontstyle");
      checkbox.checked = checkstate;
    } catch (e) {
      checkbox.checked = false;
    }

    menulist = document.getElementById("accountcolors-message-fontstyle");
    menulist.disabled = !checkbox.checked;
    menulist.appendItem("Normal", 0);
    menulist.appendItem("Italic", 1);
    menulist.appendItem("Bold", 2);
    menulist.appendItem("Bold Italic", 3);
    try {
      fontstyle = accountColorsOptions.prefs.getIntPref("message-fontstyle");
      menulist.selectedIndex = fontstyle;
    } catch (e) {
      menulist.selectedIndex = 2;
    }

    checkbox = document.getElementById("accountcolors-message-setfontsize");
    try {
      checkstate = accountColorsOptions.prefs.getBoolPref("message-setfontsize");
      checkbox.checked = checkstate;
    } catch (e) {
      checkbox.checked = false;
    }

    menulist = document.getElementById("accountcolors-message-fontsize");
    menulist.disabled = !checkbox.checked;
    for (index = 10; index <= 22; index++) {
      menulist.appendItem(index, index);
    }
    try {
      fontsize = accountColorsOptions.prefs.getIntPref("message-fontsize");
      menulist.selectedIndex = fontsize - 10;
    } catch (e) {
      menulist.selectedIndex = 2;
    }

    checkbox = document.getElementById("accountcolors-message-setfromstyle");
    try {
      checkstate = accountColorsOptions.prefs.getBoolPref("message-setfromstyle");
      checkbox.checked = checkstate;
    } catch (e) {
      checkbox.checked = false;
    }

    menulist = document.getElementById("accountcolors-message-fromstyle");
    menulist.disabled = !checkbox.checked;
    menulist.appendItem("Normal", 0);
    menulist.appendItem("Italic", 1);
    menulist.appendItem("Bold", 2);
    menulist.appendItem("Bold Italic", 3);
    try {
      fontstyle = accountColorsOptions.prefs.getIntPref("message-fromstyle");
      menulist.selectedIndex = fontstyle;
    } catch (e) {
      menulist.selectedIndex = 0;
    }

    checkbox = document.getElementById("accountcolors-message-setfromsize");
    try {
      checkstate = accountColorsOptions.prefs.getBoolPref("message-setfromsize");
      checkbox.checked = checkstate;
    } catch (e) {
      checkbox.checked = false;
    }

    menulist = document.getElementById("accountcolors-message-fromsize");
    menulist.disabled = !checkbox.checked;
    for (index = 10; index <= 22; index++) {
      menulist.appendItem(index, index);
    }
    try {
      fontsize = accountColorsOptions.prefs.getIntPref("message-fromsize");
      menulist.selectedIndex = fontsize - 10;
    } catch (e) {
      menulist.selectedIndex = 2;
    }

    checkbox = document.getElementById("accountcolors-message-colorfont");
    try {
      checkstate = accountColorsOptions.prefs.getBoolPref("message-colorfont");
      checkbox.checked = checkstate;
    } catch (e) {
      checkbox.checked = false;
    }

    checkbox = document.getElementById("accountcolors-message-colorbkgd");
    try {
      checkstate = accountColorsOptions.prefs.getBoolPref("message-colorbkgd");
      checkbox.checked = checkstate;
    } catch (e) {
      checkbox.checked = false;
    }

    checkbox = document.getElementById("accountcolors-message-colorfrom");
    try {
      checkstate = accountColorsOptions.prefs.getBoolPref("message-colorfrom");
      checkbox.checked = checkstate;
    } catch (e) {
      checkbox.checked = false;
    }

    checkbox = document.getElementById("accountcolors-message-blackhdrlabels");
    try {
      if (accountColorsUtilities.thunderbirdVersion.major <= 102) {
        checkstate = accountColorsOptions.prefs.getBoolPref("message-blackhdrlabels");
        checkbox.checked = checkstate;
      } else {
        checkbox.style.display = "none"; // Hide option for thunderbird 103+, as thunderbird theme does better job
      }
    } catch (e) {
      checkbox.checked = false;
    }

    checkbox = document.getElementById("accountcolors-message-whitehdrlabels");
    try {
      if (accountColorsUtilities.thunderbirdVersion.major <= 102) {
        checkstate = accountColorsOptions.prefs.getBoolPref("message-whitehdrlabels");
        checkbox.checked = checkstate;
      } else {
        checkbox.style.display = "none"; // Hide option for thunderbird 103+, as thunderbird theme does better job
      }
    } catch (e) {
      checkbox.checked = false;
    }

    checkbox = document.getElementById("accountcolors-message-hdraccount");
    try {
      checkstate = accountColorsOptions.prefs.getBoolPref("message-hdraccount");
      checkbox.checked = checkstate;
    } catch (e) {
      checkbox.checked = false;
    }

    // checkbox = document.getElementById("accountcolors-message-defaultbkgd");
    // try {
    //   checkstate = accountColorsOptions.prefs.getBoolPref("message-defaultbkgd");
    //   checkbox.checked = checkstate;
    // } catch (e) {
    //   checkbox.checked = false;
    // }

    checkbox = document.getElementById("accountcolors-message-colorbkgd-header-label");
    try {
      if (accountColorsUtilities.thunderbirdVersion.major > 102) {
        checkstate = accountColorsOptions.prefs.getBoolPref("message-colorbkgd-header-label");
        checkbox.checked = checkstate;
      } else {
        checkbox.style.display = "none"; // Hide option for thunderbird 102 and below, as not implemented for legacy mail frontend
      }
    } catch (e) {
      checkbox.checked = false;
    }

    menulist = document.getElementById("accountcolors-message-header-label-width");
    menulist.disabled = !checkbox.checked;
    menulist.appendItem("Width: 1", 1);
    menulist.appendItem("Width: 2", 2);
    menulist.appendItem("Width: 3", 3);
    menulist.appendItem("Width: 4", 4);
    menulist.appendItem("Width: 5", 5);
    menulist.appendItem("Width: 6", 6);
    menulist.appendItem("Width: 7", 7);
    menulist.appendItem("Width: 8", 8);
    menulist.appendItem("Width: 9", 9);
    menulist.appendItem("Width: 10", 10);
    menulist.appendItem("Width: 11", 11);
    menulist.appendItem("Width: 12", 12);
    try {
      if (accountColorsUtilities.thunderbirdVersion.major > 102) {
        value = accountColorsOptions.prefs.getIntPref("message-header-label-width");
        menulist.selectedIndex = value - 1;
      } else {
        menulist.style.display = "none"; // Hide option for thunderbird 102 and below, as not implemented for legacy mail frontend
      }
    } catch (e) {
      menulist.selectedIndex = 1;
    }

    /* Compose Window Options */

    checkbox = document.getElementById("accountcolors-compose-setfontstyle");
    try {
      checkstate = accountColorsOptions.prefs.getBoolPref("compose-setfontstyle");
      checkbox.checked = checkstate;
    } catch (e) {
      checkbox.checked = false;
    }

    menulist = document.getElementById("accountcolors-compose-fontstyle");
    menulist.disabled = !checkbox.checked;
    menulist.appendItem("Normal", 0);
    menulist.appendItem("Italic", 1);
    menulist.appendItem("Bold", 2);
    menulist.appendItem("Bold Italic", 3);
    try {
      fontstyle = accountColorsOptions.prefs.getIntPref("compose-fontstyle");
      menulist.selectedIndex = fontstyle;
    } catch (e) {
      menulist.selectedIndex = 0;
    }

    checkbox = document.getElementById("accountcolors-compose-setfontsize");
    try {
      checkstate = accountColorsOptions.prefs.getBoolPref("compose-setfontsize");
      checkbox.checked = checkstate;
    } catch (e) {
      checkbox.checked = false;
    }

    menulist = document.getElementById("accountcolors-compose-fontsize");
    menulist.disabled = !checkbox.checked;
    for (index = 10; index <= 22; index++) {
      menulist.appendItem(index, index);
    }
    try {
      fontsize = accountColorsOptions.prefs.getIntPref("compose-fontsize");
      menulist.selectedIndex = fontsize - 10;
    } catch (e) {
      menulist.selectedIndex = 2;
    }

    checkbox = document.getElementById("accountcolors-compose-setidfontstyle");
    try {
      checkstate = accountColorsOptions.prefs.getBoolPref("compose-setidfontstyle");
      checkbox.checked = checkstate;
    } catch (e) {
      checkbox.checked = false;
    }

    menulist = document.getElementById("accountcolors-compose-idfontstyle");
    menulist.disabled = !checkbox.checked;
    menulist.appendItem("Normal", 0);
    menulist.appendItem("Italic", 1);
    menulist.appendItem("Bold", 2);
    menulist.appendItem("Bold Italic", 3);
    try {
      fontstyle = accountColorsOptions.prefs.getIntPref("compose-idfontstyle");
      menulist.selectedIndex = fontstyle;
    } catch (e) {
      menulist.selectedIndex = 0;
    }

    checkbox = document.getElementById("accountcolors-compose-setidfontsize");
    try {
      checkstate = accountColorsOptions.prefs.getBoolPref("compose-setidfontsize");
      checkbox.checked = checkstate;
    } catch (e) {
      checkbox.checked = false;
    }

    menulist = document.getElementById("accountcolors-compose-idfontsize");
    menulist.disabled = !checkbox.checked;
    for (index = 10; index <= 22; index++) {
      menulist.appendItem(index, index);
    }
    try {
      fontsize = accountColorsOptions.prefs.getIntPref("compose-idfontsize");
      menulist.selectedIndex = fontsize - 10;
    } catch (e) {
      menulist.selectedIndex = 2;
    }

    checkbox = document.getElementById("accountcolors-compose-colorfont");
    try {
      checkstate = accountColorsOptions.prefs.getBoolPref("compose-colorfont");
      checkbox.checked = checkstate;
    } catch (e) {
      checkbox.checked = false;
    }

    checkbox = document.getElementById("accountcolors-compose-colorbkgd");
    try {
      checkstate = accountColorsOptions.prefs.getBoolPref("compose-colorbkgd");
      checkbox.checked = checkstate;
    } catch (e) {
      checkbox.checked = false;
    }

    checkbox = document.getElementById("accountcolors-compose-colorfromfont");
    try {
      checkstate = accountColorsOptions.prefs.getBoolPref("compose-colorfromfont");
      checkbox.checked = checkstate;
    } catch (e) {
      checkbox.checked = false;
    }

    checkbox = document.getElementById("accountcolors-compose-colorfrombkgd");
    try {
      checkstate = accountColorsOptions.prefs.getBoolPref("compose-colorfrombkgd");
      checkbox.checked = checkstate;
    } catch (e) {
      checkbox.checked = false;
    }

    checkbox = document.getElementById("accountcolors-compose-colortofont");
    try {
      checkstate = accountColorsOptions.prefs.getBoolPref("compose-colortofont");
      checkbox.checked = checkstate;
    } catch (e) {
      checkbox.checked = false;
    }

    checkbox = document.getElementById("accountcolors-compose-colortobkgd");
    try {
      checkstate = accountColorsOptions.prefs.getBoolPref("compose-colortobkgd");
      checkbox.checked = checkstate;
    } catch (e) {
      checkbox.checked = false;
    }

    checkbox = document.getElementById("accountcolors-compose-coloratmfont");
    try {
      checkstate = accountColorsOptions.prefs.getBoolPref("compose-coloratmfont");
      checkbox.checked = checkstate;
    } catch (e) {
      checkbox.checked = false;
    }

    checkbox = document.getElementById("accountcolors-compose-coloratmbkgd");
    try {
      checkstate = accountColorsOptions.prefs.getBoolPref("compose-coloratmbkgd");
      checkbox.checked = checkstate;
    } catch (e) {
      checkbox.checked = false;
    }

    checkbox = document.getElementById("accountcolors-compose-colorhdrfont");
    try {
      if (accountColorsUtilities.thunderbirdVersion.major > 102) {
        checkstate = accountColorsOptions.prefs.getBoolPref("compose-colorhdrfont");
        checkbox.checked = checkstate;
      } else {
        checkbox.style.display = "none"; // Hide option for thunderbird 102 and below, as not implemented for legacy mail frontend
      }
    } catch (e) {
      checkbox.checked = false;
    }

    checkbox = document.getElementById("accountcolors-compose-colorhdrbkgd");
    try {
      checkstate = accountColorsOptions.prefs.getBoolPref("compose-colorhdrbkgd");
      checkbox.checked = checkstate;
    } catch (e) {
      checkbox.checked = false;
    }

    checkbox = document.getElementById("accountcolors-compose-blackhdrlabels");
    try {
      if (accountColorsUtilities.thunderbirdVersion.major <= 102) {
        checkstate = accountColorsOptions.prefs.getBoolPref("compose-blackhdrlabels");
        checkbox.checked = checkstate;
      } else {
        checkbox.style.display = "none"; // Hide option for thunderbird 103+, as thunderbird theme does better job
      }
    } catch (e) {
      checkbox.checked = false;
    }

    checkbox = document.getElementById("accountcolors-compose-whitehdrlabels");
    try {
      if (accountColorsUtilities.thunderbirdVersion.major <= 102) {
        checkstate = accountColorsOptions.prefs.getBoolPref("compose-whitehdrlabels");
        checkbox.checked = checkstate;
      } else {
        checkbox.style.display = "none"; // Hide option for thunderbird 103+, as thunderbird theme does better job
      }
    } catch (e) {
      checkbox.checked = false;
    }

    checkbox = document.getElementById("accountcolors-compose-blackfieldfont");
    try {
      if (accountColorsUtilities.thunderbirdVersion.major <= 102) {
        checkstate = accountColorsOptions.prefs.getBoolPref("compose-blackfieldfont");
        checkbox.checked = checkstate;
      } else {
        checkbox.style.display = "none"; // Hide option for thunderbird 103+, as thunderbird theme does better job
      }
    } catch (e) {
      checkbox.checked = false;
    }

    checkbox = document.getElementById("accountcolors-compose-lightfieldbkgd");
    try {
      if (accountColorsUtilities.thunderbirdVersion.major <= 102) {
        checkstate = accountColorsOptions.prefs.getBoolPref("compose-lightfieldbkgd");
        checkbox.checked = checkstate;
      } else {
        checkbox.style.display = "none"; // Hide option for thunderbird 103+, as thunderbird theme does better job
      }
    } catch (e) {
      checkbox.checked = false;
    }

    checkbox = document.getElementById("accountcolors-compose-whitefieldfont");
    try {
      if (accountColorsUtilities.thunderbirdVersion.major <= 102) {
        checkstate = accountColorsOptions.prefs.getBoolPref("compose-whitefieldfont");
        checkbox.checked = checkstate;
      } else {
        checkbox.style.display = "none"; // Hide option for thunderbird 103+, as thunderbird theme does better job
      }
    } catch (e) {
      checkbox.checked = false;
    }

    checkbox = document.getElementById("accountcolors-compose-darkfieldbkgd");
    try {
      if (accountColorsUtilities.thunderbirdVersion.major <= 102) {
        checkstate = accountColorsOptions.prefs.getBoolPref("compose-darkfieldbkgd");
        checkbox.checked = checkstate;
      } else {
        checkbox.style.display = "none"; // Hide option for thunderbird 103+, as thunderbird theme does better job
      }
    } catch (e) {
      checkbox.checked = false;
    }

    // checkbox = document.getElementById("accountcolors-compose-defaultbkgd");
    // try {
    //   checkstate = accountColorsOptions.prefs.getBoolPref("compose-defaultbkgd");
    //   checkbox.checked = checkstate;
    // } catch (e) {
    //   checkbox.checked = false;
    // }

    checkbox = document.getElementById("accountcolors-compose-hoverfrom");
    try {
      if (accountColorsUtilities.thunderbirdVersion.major <= 102) {
        checkstate = accountColorsOptions.prefs.getBoolPref("compose-hoverfrom");
        checkbox.checked = checkstate;
      } else {
        checkbox.style.display = "none"; // Hide option for thunderbird 103+, as it is always enabled and strictly stick to system default
      }
    } catch (e) {
      checkbox.checked = false;
    }

    checkbox = document.getElementById("accountcolors-compose-colorbkgd-idmenu-label");
    try {
      if (accountColorsUtilities.thunderbirdVersion.major > 102) {
        checkstate = accountColorsOptions.prefs.getBoolPref("compose-colorbkgd-idmenu-label");
        checkbox.checked = checkstate;
      } else {
        checkbox.style.display = "none"; // Hide option for thunderbird 102 and below, as not implemented for legacy mail frontend
      }
    } catch (e) {
      checkbox.checked = false;
    }

    menulist = document.getElementById("accountcolors-compose-idmenu-label-width");
    menulist.disabled = !checkbox.checked;
    menulist.appendItem("Width: 1", 1);
    menulist.appendItem("Width: 2", 2);
    menulist.appendItem("Width: 3", 3);
    menulist.appendItem("Width: 4", 4);
    menulist.appendItem("Width: 5", 5);
    menulist.appendItem("Width: 6", 6);
    menulist.appendItem("Width: 7", 7);
    menulist.appendItem("Width: 8", 8);
    menulist.appendItem("Width: 9", 9);
    menulist.appendItem("Width: 10", 10);
    menulist.appendItem("Width: 11", 11);
    menulist.appendItem("Width: 12", 12);
    try {
      if (accountColorsUtilities.thunderbirdVersion.major > 102) {
        value = accountColorsOptions.prefs.getIntPref("compose-idmenu-label-width");
        menulist.selectedIndex = value - 1;
      } else {
        menulist.style.display = "none"; // Hide option for thunderbird 102 and below, as not implemented for legacy mail frontend
      }
    } catch (e) {
      menulist.selectedIndex = 1;
    }
  },

  /********************************************************************/

  /* Save preferences */

  savePrefs: function () {
    var container, accountidkey, index;

    /* Account/Identity Colors */

    container = document.getElementById("accountcolors-accountidbox-container"); /* accountidbox container */

    for (index = 0; index < container.children.length; index++) {
      if (document.getElementById("accountcolors-accountidbox" + index).hidden == false) {
        accountidkey = document.getElementById("accountcolors-accountidbox" + index).getAttribute("ac-accountidkey");
        accountColorsOptions.prefs.setCharPref(accountidkey + "-fontcolor", accountColorsOptions.pickerGetColor("accountcolors-fontpicker" + index));
        accountColorsOptions.prefs.setCharPref(accountidkey + "-bkgdcolor", accountColorsOptions.pickerGetColor("accountcolors-bkgdpicker" + index));
      }
    }

    /* Folder Pane Options */

    accountColorsOptions.prefs.setBoolPref("folder-setfontstyle", document.getElementById("accountcolors-folder-setfontstyle").checked);
    accountColorsOptions.prefs.setIntPref("folder-fontstyle", document.getElementById("accountcolors-folder-fontstyle").value);
    accountColorsOptions.prefs.setBoolPref("folder-setfontsize", document.getElementById("accountcolors-folder-setfontsize").checked);
    accountColorsOptions.prefs.setIntPref("folder-fontsize", document.getElementById("accountcolors-folder-fontsize").value);
    accountColorsOptions.prefs.setBoolPref("folder-colorfont", document.getElementById("accountcolors-folder-colorfont").checked);
    accountColorsOptions.prefs.setBoolPref("folder-colorbkgd", document.getElementById("accountcolors-folder-colorbkgd").checked);
    accountColorsOptions.prefs.setBoolPref("folder-colorfldfont", document.getElementById("accountcolors-folder-colorfldfont").checked);
    accountColorsOptions.prefs.setBoolPref("folder-colorfldbkgd", document.getElementById("accountcolors-folder-colorfldbkgd").checked);
    accountColorsOptions.prefs.setBoolPref("folder-colorother", document.getElementById("accountcolors-folder-colorother").checked);
    accountColorsOptions.prefs.setBoolPref("folder-colorotherbkgd", document.getElementById("accountcolors-folder-colorotherbkgd").checked);
    accountColorsOptions.prefs.setBoolPref("folder-blackrowfont", document.getElementById("accountcolors-folder-blackrowfont").checked);
    accountColorsOptions.prefs.setBoolPref("folder-lightpanebkgd", document.getElementById("accountcolors-folder-lightpanebkgd").checked);
    accountColorsOptions.prefs.setBoolPref("folder-whiterowfont", document.getElementById("accountcolors-folder-whiterowfont").checked);
    accountColorsOptions.prefs.setBoolPref("folder-darkpanebkgd", document.getElementById("accountcolors-folder-darkpanebkgd").checked);
    // accountColorsOptions.prefs.setBoolPref("folder-defaultbkgd", document.getElementById("accountcolors-folder-defaultbkgd").checked);
    accountColorsOptions.prefs.setBoolPref("folder-boldnewmail", document.getElementById("accountcolors-folder-boldnewmail").checked);
    accountColorsOptions.prefs.setBoolPref("folder-undernewmail", document.getElementById("accountcolors-folder-undernewmail").checked);
    accountColorsOptions.prefs.setBoolPref("folder-noboldunread", document.getElementById("accountcolors-folder-noboldunread").checked);
    accountColorsOptions.prefs.setBoolPref("folder-showlines", document.getElementById("accountcolors-folder-showlines").checked);
    accountColorsOptions.prefs.setBoolPref("folder-darkerbar", document.getElementById("accountcolors-folder-darkerbar").checked);
    accountColorsOptions.prefs.setBoolPref("folder-incspacing", document.getElementById("accountcolors-folder-incspacing").checked);
    accountColorsOptions.prefs.setBoolPref("folder-hoverselect", document.getElementById("accountcolors-folder-hoverselect").checked);
    accountColorsOptions.prefs.setBoolPref("folder-colorbkgd-account-icon", document.getElementById("accountcolors-folder-colorbkgd-account-icon").checked);
    accountColorsOptions.prefs.setBoolPref("folder-colorbkgd-folder-icon", document.getElementById("accountcolors-folder-colorbkgd-folder-icon").checked);

    /* Thread Pane Options */

    accountColorsOptions.prefs.setBoolPref("thread-setfontstyle", document.getElementById("accountcolors-thread-setfontstyle").checked);
    accountColorsOptions.prefs.setIntPref("thread-fontstyle", document.getElementById("accountcolors-thread-fontstyle").value);
    accountColorsOptions.prefs.setBoolPref("thread-setfontsize", document.getElementById("accountcolors-thread-setfontsize").checked);
    accountColorsOptions.prefs.setIntPref("thread-fontsize", document.getElementById("accountcolors-thread-fontsize").value);
    accountColorsOptions.prefs.setBoolPref("thread-setfromstyle", document.getElementById("accountcolors-thread-setfromstyle").checked);
    accountColorsOptions.prefs.setIntPref("thread-fromstyle", document.getElementById("accountcolors-thread-fromstyle").value);
    accountColorsOptions.prefs.setBoolPref("thread-setfromsize", document.getElementById("accountcolors-thread-setfromsize").checked);
    accountColorsOptions.prefs.setIntPref("thread-fromsize", document.getElementById("accountcolors-thread-fromsize").value);
    accountColorsOptions.prefs.setBoolPref("thread-colorfont", document.getElementById("accountcolors-thread-colorfont").checked);
    accountColorsOptions.prefs.setBoolPref("thread-colorbkgd", document.getElementById("accountcolors-thread-colorbkgd").checked);
    accountColorsOptions.prefs.setBoolPref("thread-colorfrom", document.getElementById("accountcolors-thread-colorfrom").checked);
    accountColorsOptions.prefs.setBoolPref("thread-colorother", document.getElementById("accountcolors-thread-colorother").checked);
    accountColorsOptions.prefs.setBoolPref("thread-colorpanebkgd", document.getElementById("accountcolors-thread-colorpanebkgd").checked);
    accountColorsOptions.prefs.setBoolPref("thread-blackrowfont", document.getElementById("accountcolors-thread-blackrowfont").checked);
    accountColorsOptions.prefs.setBoolPref("thread-lightpanebkgd", document.getElementById("accountcolors-thread-lightpanebkgd").checked);
    accountColorsOptions.prefs.setBoolPref("thread-whiterowfont", document.getElementById("accountcolors-thread-whiterowfont").checked);
    accountColorsOptions.prefs.setBoolPref("thread-darkpanebkgd", document.getElementById("accountcolors-thread-darkpanebkgd").checked);
    accountColorsOptions.prefs.setBoolPref("thread-hdraccount", document.getElementById("accountcolors-thread-hdraccount").checked);
    accountColorsOptions.prefs.setBoolPref("thread-boldsubject", document.getElementById("accountcolors-thread-boldsubject").checked);
    accountColorsOptions.prefs.setBoolPref("thread-boldfrom", document.getElementById("accountcolors-thread-boldfrom").checked);
    accountColorsOptions.prefs.setBoolPref("thread-showstripes", document.getElementById("accountcolors-thread-showstripes").checked);
    accountColorsOptions.prefs.setBoolPref("thread-darkerbar", document.getElementById("accountcolors-thread-darkerbar").checked);
    accountColorsOptions.prefs.setBoolPref("thread-incspacing", document.getElementById("accountcolors-thread-incspacing").checked);
    accountColorsOptions.prefs.setBoolPref("thread-hoverselect", document.getElementById("accountcolors-thread-hoverselect").checked);
    accountColorsOptions.prefs.setBoolPref("thread-colorbkgd-row-label", document.getElementById("accountcolors-thread-colorbkgd-row-label").checked);
    accountColorsOptions.prefs.setIntPref("thread-row-label-position", document.getElementById("accountcolors-thread-row-label-position").value);
    accountColorsOptions.prefs.setIntPref("thread-row-label-width", document.getElementById("accountcolors-thread-row-label-width").value);
    accountColorsOptions.prefs.setBoolPref("thread-colorbkgd-card-label", document.getElementById("accountcolors-thread-colorbkgd-card-label").checked);
    accountColorsOptions.prefs.setIntPref("thread-card-label-position", document.getElementById("accountcolors-thread-card-label-indent").value);
    accountColorsOptions.prefs.setIntPref("thread-card-label-width", document.getElementById("accountcolors-thread-card-label-width").value);
    accountColorsOptions.prefs.setBoolPref("thread-color-unified-only", document.getElementById("accountcolors-thread-color-unified-only").checked);

    /* Message Pane, Message Tab & Message Window Options */

    accountColorsOptions.prefs.setBoolPref("message-setfontstyle", document.getElementById("accountcolors-message-setfontstyle").checked);
    accountColorsOptions.prefs.setIntPref("message-fontstyle", document.getElementById("accountcolors-message-fontstyle").value);
    accountColorsOptions.prefs.setBoolPref("message-setfontsize", document.getElementById("accountcolors-message-setfontsize").checked);
    accountColorsOptions.prefs.setIntPref("message-fontsize", document.getElementById("accountcolors-message-fontsize").value);
    accountColorsOptions.prefs.setBoolPref("message-setfromstyle", document.getElementById("accountcolors-message-setfromstyle").checked);
    accountColorsOptions.prefs.setIntPref("message-fromstyle", document.getElementById("accountcolors-message-fromstyle").value);
    accountColorsOptions.prefs.setBoolPref("message-setfromsize", document.getElementById("accountcolors-message-setfromsize").checked);
    accountColorsOptions.prefs.setIntPref("message-fromsize", document.getElementById("accountcolors-message-fromsize").value);
    accountColorsOptions.prefs.setBoolPref("message-colorfont", document.getElementById("accountcolors-message-colorfont").checked);
    accountColorsOptions.prefs.setBoolPref("message-colorbkgd", document.getElementById("accountcolors-message-colorbkgd").checked);
    accountColorsOptions.prefs.setBoolPref("message-colorfrom", document.getElementById("accountcolors-message-colorfrom").checked);
    accountColorsOptions.prefs.setBoolPref("message-blackhdrlabels", document.getElementById("accountcolors-message-blackhdrlabels").checked);
    accountColorsOptions.prefs.setBoolPref("message-whitehdrlabels", document.getElementById("accountcolors-message-whitehdrlabels").checked);
    // accountColorsOptions.prefs.setBoolPref("message-defaultbkgd", document.getElementById("accountcolors-message-defaultbkgd").checked);
    accountColorsOptions.prefs.setBoolPref("message-hdraccount", document.getElementById("accountcolors-message-hdraccount").checked);
    accountColorsOptions.prefs.setBoolPref("message-colorbkgd-header-label", document.getElementById("accountcolors-message-colorbkgd-header-label").checked);
    accountColorsOptions.prefs.setIntPref("message-header-label-width", document.getElementById("accountcolors-message-header-label-width").value);

    /* Compose Window Options */

    accountColorsOptions.prefs.setBoolPref("compose-setfontstyle", document.getElementById("accountcolors-compose-setfontstyle").checked);
    accountColorsOptions.prefs.setIntPref("compose-fontstyle", document.getElementById("accountcolors-compose-fontstyle").value);
    accountColorsOptions.prefs.setBoolPref("compose-setfontsize", document.getElementById("accountcolors-compose-setfontsize").checked);
    accountColorsOptions.prefs.setIntPref("compose-fontsize", document.getElementById("accountcolors-compose-fontsize").value);
    accountColorsOptions.prefs.setBoolPref("compose-setidfontstyle", document.getElementById("accountcolors-compose-setidfontstyle").checked);
    accountColorsOptions.prefs.setIntPref("compose-idfontstyle", document.getElementById("accountcolors-compose-idfontstyle").value);
    accountColorsOptions.prefs.setBoolPref("compose-setidfontsize", document.getElementById("accountcolors-compose-setidfontsize").checked);
    accountColorsOptions.prefs.setIntPref("compose-idfontsize", document.getElementById("accountcolors-compose-idfontsize").value);
    accountColorsOptions.prefs.setBoolPref("compose-colorfont", document.getElementById("accountcolors-compose-colorfont").checked);
    accountColorsOptions.prefs.setBoolPref("compose-colorbkgd", document.getElementById("accountcolors-compose-colorbkgd").checked);
    accountColorsOptions.prefs.setBoolPref("compose-colorfromfont", document.getElementById("accountcolors-compose-colorfromfont").checked);
    accountColorsOptions.prefs.setBoolPref("compose-colorfrombkgd", document.getElementById("accountcolors-compose-colorfrombkgd").checked);
    accountColorsOptions.prefs.setBoolPref("compose-colortofont", document.getElementById("accountcolors-compose-colortofont").checked);
    accountColorsOptions.prefs.setBoolPref("compose-colortobkgd", document.getElementById("accountcolors-compose-colortobkgd").checked);
    accountColorsOptions.prefs.setBoolPref("compose-coloratmfont", document.getElementById("accountcolors-compose-coloratmfont").checked);
    accountColorsOptions.prefs.setBoolPref("compose-coloratmbkgd", document.getElementById("accountcolors-compose-coloratmbkgd").checked);
    accountColorsOptions.prefs.setBoolPref("compose-colorhdrfont", document.getElementById("accountcolors-compose-colorhdrfont").checked);
    accountColorsOptions.prefs.setBoolPref("compose-colorhdrbkgd", document.getElementById("accountcolors-compose-colorhdrbkgd").checked);
    accountColorsOptions.prefs.setBoolPref("compose-blackhdrlabels", document.getElementById("accountcolors-compose-blackhdrlabels").checked);
    accountColorsOptions.prefs.setBoolPref("compose-whitehdrlabels", document.getElementById("accountcolors-compose-whitehdrlabels").checked);
    accountColorsOptions.prefs.setBoolPref("compose-blackfieldfont", document.getElementById("accountcolors-compose-blackfieldfont").checked);
    accountColorsOptions.prefs.setBoolPref("compose-lightfieldbkgd", document.getElementById("accountcolors-compose-lightfieldbkgd").checked);
    accountColorsOptions.prefs.setBoolPref("compose-whitefieldfont", document.getElementById("accountcolors-compose-whitefieldfont").checked);
    accountColorsOptions.prefs.setBoolPref("compose-darkfieldbkgd", document.getElementById("accountcolors-compose-darkfieldbkgd").checked);
    // accountColorsOptions.prefs.setBoolPref("compose-defaultbkgd", document.getElementById("accountcolors-compose-defaultbkgd").checked);
    accountColorsOptions.prefs.setBoolPref("compose-hoverfrom", document.getElementById("accountcolors-compose-hoverfrom").checked);
    accountColorsOptions.prefs.setBoolPref("compose-colorbkgd-idmenu-label", document.getElementById("accountcolors-compose-colorbkgd-idmenu-label").checked);
    accountColorsOptions.prefs.setIntPref("compose-idmenu-label-width", document.getElementById("accountcolors-compose-idmenu-label-width").value);
  },

  /********************************************************************/

  /* Update functions */

  setMenuState: function (element) {
    document.getElementById(element.substr(0, element.lastIndexOf("-") + 1) + element.substr(element.lastIndexOf("-") + 4)).disabled = !document.getElementById(element).checked;
  },

  setMenuStateByCheckbox: function (checkbox, ...menulists) {
    var menulist;
    for (menulist of menulists) {
      document.getElementById(menulist).disabled = !document.getElementById(checkbox).checked;
    }
  },

  updateFontColor: function (index) {
    var i, length;

    if (accountColorsOptions.prefs.getBoolPref("picker-autobkgd")) {
      accountColorsOptions.pickerSetColor("accountcolors-bkgdpicker" + index, accountColorsOptions.autoBkgdColor(accountColorsOptions.pickerGetColor("accountcolors-fontpicker" + index)));
    }

    document.getElementById("accountcolors-accountname" + index).style.color = accountColorsOptions.pickerGetColor("accountcolors-fontpicker" + index);
    document.getElementById("accountcolors-accountname" + index).style.backgroundColor = accountColorsOptions.pickerGetColor("accountcolors-bkgdpicker" + index);

    if (document.getElementById("accountcolors-accountidbox" + index).getAttribute("ac-accountidtype") != "account") {
      document.getElementById("accountcolors-identityname" + index).style.color = accountColorsOptions.pickerGetColor("accountcolors-fontpicker" + index);
      document.getElementById("accountcolors-identityname" + index).style.backgroundColor = accountColorsOptions.pickerGetColor("accountcolors-bkgdpicker" + index);
    }

    if (document.getElementById("accountcolors-accountidbox" + index).getAttribute("ac-accountidtype") == "accountid") {
      if (accountColorsOptions.prefs.getBoolPref("picker-applyall")) {
        length = document.getElementById("accountcolors-accountidbox-container").children.length;

        for (i = index + 1; i < length && document.getElementById("accountcolors-accountidbox" + i).getAttribute("ac-accountidtype") == "id"; i++) {
          color = accountColorsOptions.pickerSetColor("accountcolors-fontpicker" + i, accountColorsOptions.pickerGetColor("accountcolors-fontpicker" + index));
          document.getElementById("accountcolors-accountname" + i).style.color = color;
          document.getElementById("accountcolors-identityname" + i).style.color = color;

          color = accountColorsOptions.pickerSetColor("accountcolors-bkgdpicker" + i, accountColorsOptions.pickerGetColor("accountcolors-bkgdpicker" + index));
          document.getElementById("accountcolors-accountname" + i).style.backgroundColor = color;
          document.getElementById("accountcolors-identityname" + i).style.backgroundColor = color;
        }
      }
    }
  },

  updateBkgdColor: function (index) {
    var i, length;

    document.getElementById("accountcolors-accountname" + index).style.backgroundColor = accountColorsOptions.pickerGetColor("accountcolors-bkgdpicker" + index);

    if (document.getElementById("accountcolors-accountidbox" + index).getAttribute("ac-accountidtype") != "account") {
      document.getElementById("accountcolors-identityname" + index).style.backgroundColor = accountColorsOptions.pickerGetColor("accountcolors-bkgdpicker" + index);
    }

    if (document.getElementById("accountcolors-accountidbox" + index).getAttribute("ac-accountidtype") == "accountid") {
      if (accountColorsOptions.prefs.getBoolPref("picker-applyall")) {
        length = document.getElementById("accountcolors-accountidbox-container").children.length;

        for (i = index + 1; i < length && document.getElementById("accountcolors-accountidbox" + i).getAttribute("ac-accountidtype") == "id"; i++) {
          color = accountColorsOptions.pickerSetColor("accountcolors-bkgdpicker" + i, accountColorsOptions.pickerGetColor("accountcolors-bkgdpicker" + index));
          document.getElementById("accountcolors-accountname" + i).style.backgroundColor = color;
          document.getElementById("accountcolors-identityname" + i).style.backgroundColor = color;
        }
      }
    }
  },

  /********************************************************************/

  /* Color picker functions */

  pickerOpen: function (pickerbutton) {
    var index, r, g, b, hexstr, element;
    var rgbColors = new Array();
    var HSV = new Object();

    document.getElementById("accountcolors-picker-panel").hidePopup();

    accountColorsOptions.pickerButton = pickerbutton;

    rgbColors = pickerbutton.children[0].style.getPropertyValue("background-color").match(/rgb\((\d+),\s(\d+),\s(\d+)\)/);

    r = Number(rgbColors[1]);
    g = Number(rgbColors[2]);
    b = Number(rgbColors[3]);

    hexstr = accountColorsOptions.pickerMakeHexStr(r, g, b);

    document.getElementById("accountcolors-picker-separator-3").hidden = true;

    if (pickerbutton.id.indexOf("font") >= 0) {
      document.getElementById("accountcolors-picker-separator-3").hidden = false;

      document.getElementById("accountcolors-picker-fonttitle").hidden = false;
      document.getElementById("accountcolors-picker-bkgdtitle").hidden = true;

      document.getElementById("accountcolors-picker-fontpalette").hidden = false;
      document.getElementById("accountcolors-picker-bkgdpalette").hidden = true;

      document.getElementById("accountcolors-picker-autobkgd-box").hidden = false;

      element = document
        .getElementById("accountcolors-picker-fontpalette-panel")
        .getElementsByAttribute("color", "#" + hexstr)
        .item(0);
      if (element != null) document.getElementById("accountcolors-picker-fontpalette").children[0].style.setProperty("background-color", "#" + hexstr, "");
      else document.getElementById("accountcolors-picker-fontpalette").children[0].style.setProperty("background-color", "#E1E1E1");
    } else {
      document.getElementById("accountcolors-picker-fonttitle").hidden = true;
      document.getElementById("accountcolors-picker-bkgdtitle").hidden = false;

      document.getElementById("accountcolors-picker-fontpalette").hidden = true;
      document.getElementById("accountcolors-picker-bkgdpalette").hidden = false;

      document.getElementById("accountcolors-picker-autobkgd-box").hidden = true;

      element = document
        .getElementById("accountcolors-picker-bkgdpalette-panel")
        .getElementsByAttribute("color", "#" + hexstr)
        .item(0);
      if (element != null) document.getElementById("accountcolors-picker-bkgdpalette").children[0].style.setProperty("background-color", "#" + hexstr, "");
      else document.getElementById("accountcolors-picker-bkgdpalette").children[0].style.setProperty("background-color", "#E1E1E1");
    }

    document.getElementById("accountcolors-picker-autobkgd").checked = accountColorsOptions.prefs.getBoolPref("picker-autobkgd");

    index = Number(pickerbutton.id.substr(24));
    if (document.getElementById("accountcolors-accountidbox" + index).getAttribute("ac-accountidtype") != "id") {
      document.getElementById("accountcolors-picker-separator-3").hidden = false;

      document.getElementById("accountcolors-picker-applyall-box").hidden = false;
    } else document.getElementById("accountcolors-picker-applyall-box").hidden = true;

    document.getElementById("accountcolors-picker-applyall").checked = accountColorsOptions.prefs.getBoolPref("picker-applyall");

    document.getElementById("accountcolors-picker-panel").openPopup(pickerbutton, "after_end", -1, 1, false, false, null);

    accountColorsOptions.pickerRGBtoHSV(r, g, b, HSV);
    accountColorsOptions.pickerUpdateElements(r, g, b, HSV.h, HSV.s, HSV.v);

    document.getElementById("accountcolors-picker-autobkgd").checked = accountColorsOptions.prefs.getBoolPref("picker-autobkgd");

    window.addEventListener("keypress", accountColorsOptions.pickerReturn, true);
  },

  pickerRGBScaleChange: function () {
    var r, g, b;
    var HSV = new Object();

    r = +document.getElementById("accountcolors-picker-r-scale").value;
    g = +document.getElementById("accountcolors-picker-g-scale").value;
    b = +document.getElementById("accountcolors-picker-b-scale").value;

    accountColorsOptions.pickerRGBtoHSV(r, g, b, HSV);
    accountColorsOptions.pickerUpdateElements(r, g, b, HSV.h, HSV.s, HSV.v);
  },

  pickerHSVScaleChange: function () {
    var h, s, v;
    var RGB = new Object();

    h = +document.getElementById("accountcolors-picker-h-scale").value;
    s = +document.getElementById("accountcolors-picker-s-scale").value;
    v = +document.getElementById("accountcolors-picker-v-scale").value;

    accountColorsOptions.pickerHSVtoRGB(h, s, v, RGB);
    accountColorsOptions.pickerUpdateElements(RGB.r, RGB.g, RGB.b, h, s, v);
  },

  pickerRGBValueChange: function () {
    var r, g, b;
    var HSV = new Object();

    if (+document.getElementById("accountcolors-picker-r-value").value < 0) document.getElementById("accountcolors-picker-r-value").value = 0;
    if (+document.getElementById("accountcolors-picker-g-value").value < 0) document.getElementById("accountcolors-picker-g-value").value = 0;
    if (+document.getElementById("accountcolors-picker-b-value").value < 0) document.getElementById("accountcolors-picker-b-value").value = 0;

    if (+document.getElementById("accountcolors-picker-r-value").value > 255) document.getElementById("accountcolors-picker-r-value").value = 255;
    if (+document.getElementById("accountcolors-picker-g-value").value > 255) document.getElementById("accountcolors-picker-g-value").value = 255;
    if (+document.getElementById("accountcolors-picker-b-value").value > 255) document.getElementById("accountcolors-picker-b-value").value = 255;

    r = +document.getElementById("accountcolors-picker-r-value").value;
    g = +document.getElementById("accountcolors-picker-g-value").value;
    b = +document.getElementById("accountcolors-picker-b-value").value;

    accountColorsOptions.pickerRGBtoHSV(r, g, b, HSV);
    accountColorsOptions.pickerUpdateElements(r, g, b, HSV.h, HSV.s, HSV.v);
  },

  pickerHSVValueChange: function () {
    var h, s, v;
    var RGB = new Object();

    if (+document.getElementById("accountcolors-picker-h-value").value < 0) document.getElementById("accountcolors-picker-h-value").value = 0;
    if (+document.getElementById("accountcolors-picker-s-value").value < 0) document.getElementById("accountcolors-picker-s-value").value = 0;
    if (+document.getElementById("accountcolors-picker-v-value").value < 0) document.getElementById("accountcolors-picker-v-value").value = 0;

    if (+document.getElementById("accountcolors-picker-h-value").value > 360) document.getElementById("accountcolors-picker-h-value").value = 360;
    if (+document.getElementById("accountcolors-picker-s-value").value > 100) document.getElementById("accountcolors-picker-s-value").value = 100;
    if (+document.getElementById("accountcolors-picker-v-value").value > 100) document.getElementById("accountcolors-picker-v-value").value = 100;

    h = +document.getElementById("accountcolors-picker-h-value").value;
    s = +document.getElementById("accountcolors-picker-s-value").value;
    v = +document.getElementById("accountcolors-picker-v-value").value;

    accountColorsOptions.pickerHSVtoRGB(h, s, v, RGB);
    accountColorsOptions.pickerUpdateElements(RGB.r, RGB.g, RGB.b, h, s, v);
  },

  pickerHexStrChange: function () {
    var hexstr, i, value, r, g, b;
    var HSV = new Object();

    hexstr = document.getElementById("accountcolors-picker-hexstr").value;

    for (i = 0; i < hexstr.length; i++) {
      if (hexstr.charAt(i) >= "0" && hexstr.charAt(i) <= "9") continue;
      if (hexstr.charAt(i) >= "A" && hexstr.charAt(i) <= "F") continue;
      if (hexstr.charAt(i) >= "a" && hexstr.charAt(i) <= "f") continue;
      hexstr = hexstr.substr(0, i) + hexstr.substr(i + 1);
      i--;
    }

    hexstr = hexstr.toUpperCase();
    hexstr = hexstr.substr(-6);
    while (hexstr.length < 6) hexstr = "0" + hexstr;

    i = document.getElementById("accountcolors-picker-hexstr").selectionEnd;
    i += 6 - document.getElementById("accountcolors-picker-hexstr").textLength;
    document.getElementById("accountcolors-picker-hexstr").value = hexstr;
    document.getElementById("accountcolors-picker-hexstr").selectionEnd = i;

    value = parseInt(hexstr, 16);

    r = (value >> 16) & 0xff;
    g = (value >> 8) & 0xff;
    b = value & 0xff;

    accountColorsOptions.pickerRGBtoHSV(r, g, b, HSV);
    accountColorsOptions.pickerUpdateElements(r, g, b, HSV.h, HSV.s, HSV.v);
  },

  pickerPaletteOpen: function (palettebutton) {
    var r, g, b, hexstr, element;
    var rgbColors = new Array();

    rgbColors = palettebutton.children[0].style.getPropertyValue("background-color").match(/rgb\((\d+),\s(\d+),\s(\d+)\)/);

    r = Number(rgbColors[1]);
    g = Number(rgbColors[2]);
    b = Number(rgbColors[3]);

    hexstr = accountColorsOptions.pickerMakeHexStr(r, g, b);

    document.getElementById("accountcolors-picker-fontpalette-panel").hidePopup();
    document.getElementById("accountcolors-picker-bkgdpalette-panel").hidePopup();

    if (palettebutton.id.indexOf("font") >= 0) {
      element = document.getElementById("accountcolors-picker-fontpalette-panel").getElementsByAttribute("selected", "true").item(0);
      if (element != null) element.removeAttribute("selected");

      element = document
        .getElementById("accountcolors-picker-fontpalette-panel")
        .getElementsByAttribute("color", "#" + hexstr)
        .item(0);
      if (element != null) element.setAttribute("selected", "true");

      document.getElementById("accountcolors-picker-fontpalette-panel").openPopup(palettebutton, "after_start", -2, 10, false, false, null);
    } else {
      element = document.getElementById("accountcolors-picker-bkgdpalette-panel").getElementsByAttribute("selected", "true").item(0);
      if (element != null) element.removeAttribute("selected");

      element = document
        .getElementById("accountcolors-picker-bkgdpalette-panel")
        .getElementsByAttribute("color", "#" + hexstr)
        .item(0);
      if (element != null) element.setAttribute("selected", "true");

      document.getElementById("accountcolors-picker-bkgdpalette-panel").openPopup(palettebutton, "after_start", -2, 10, false, false, null);
    }
  },

  pickerPaletteChange: function (event) {
    var pickerbutton, hexstr, value, r, g, b;
    var HSV = new Object();

    pickerbutton = accountColorsOptions.pickerButton;

    if (pickerbutton.id.indexOf("font") >= 0) {
      hexstr = event.target.getAttribute("color").substr(1);

      document.getElementById("accountcolors-picker-fontpalette").children[0].style.setProperty("background-color", "#" + hexstr, "");

      document.getElementById("accountcolors-picker-fontpalette-panel").hidePopup();
    } else {
      hexstr = event.target.getAttribute("color").substr(1);

      document.getElementById("accountcolors-picker-bkgdpalette").children[0].style.setProperty("background-color", "#" + hexstr, "");

      document.getElementById("accountcolors-picker-bkgdpalette-panel").hidePopup();
    }

    value = parseInt(hexstr, 16);

    r = (value >> 16) & 0xff;
    g = (value >> 8) & 0xff;
    b = value & 0xff;

    accountColorsOptions.pickerRGBtoHSV(r, g, b, HSV);
    accountColorsOptions.pickerUpdateElements(r, g, b, HSV.h, HSV.s, HSV.v);
  },

  pickerAutoBkgdChange: function () {
    var r, g, b;
    var HSV = new Object();

    accountColorsOptions.prefs.setBoolPref("picker-autobkgd", document.getElementById("accountcolors-picker-autobkgd").checked);

    r = +document.getElementById("accountcolors-picker-r-scale").value;
    g = +document.getElementById("accountcolors-picker-g-scale").value;
    b = +document.getElementById("accountcolors-picker-b-scale").value;

    accountColorsOptions.pickerRGBtoHSV(r, g, b, HSV);
    accountColorsOptions.pickerUpdateElements(r, g, b, HSV.h, HSV.s, HSV.v);
  },

  pickerApplyAllChange: function () {
    var r, g, b;
    var HSV = new Object();

    accountColorsOptions.prefs.setBoolPref("picker-applyall", document.getElementById("accountcolors-picker-applyall").checked);

    r = +document.getElementById("accountcolors-picker-r-scale").value;
    g = +document.getElementById("accountcolors-picker-g-scale").value;
    b = +document.getElementById("accountcolors-picker-b-scale").value;

    accountColorsOptions.pickerRGBtoHSV(r, g, b, HSV);
    accountColorsOptions.pickerUpdateElements(r, g, b, HSV.h, HSV.s, HSV.v);
  },

  pickerUpdateElements: function (r, g, b, h, s, v) {
    var i, pickerbutton, hexlo, hexhi, hexstr, element, index;
    var RGB = new Object();

    pickerbutton = accountColorsOptions.pickerButton;

    /* Update RGB scales and values */

    document.getElementById("accountcolors-picker-r-scale").value = r;
    document.getElementById("accountcolors-picker-g-scale").value = g;
    document.getElementById("accountcolors-picker-b-scale").value = b;

    document.getElementById("accountcolors-picker-r-value").value = r;
    document.getElementById("accountcolors-picker-g-value").value = g;
    document.getElementById("accountcolors-picker-b-value").value = b;

    hexlo = accountColorsOptions.pickerMakeHexStr(0, g, b);
    hexhi = accountColorsOptions.pickerMakeHexStr(255, g, b);
    document.getElementById("accountcolors-picker-r-scale").style.setProperty("--r-scale-image", "-moz-linear-gradient(left,#" + hexlo + ",#" + hexhi + ")", "");

    hexlo = accountColorsOptions.pickerMakeHexStr(r, 0, b);
    hexhi = accountColorsOptions.pickerMakeHexStr(r, 255, b);
    document.getElementById("accountcolors-picker-g-scale").style.setProperty("--g-scale-image", "-moz-linear-gradient(left,#" + hexlo + ",#" + hexhi + ")", "");

    hexlo = accountColorsOptions.pickerMakeHexStr(r, g, 0);
    hexhi = accountColorsOptions.pickerMakeHexStr(r, g, 255);
    document.getElementById("accountcolors-picker-b-scale").style.setProperty("--b-scale-image", "-moz-linear-gradient(left,#" + hexlo + ",#" + hexhi + ")", "");

    /* Update HSV scales and values */

    document.getElementById("accountcolors-picker-h-scale").value = h;
    document.getElementById("accountcolors-picker-s-scale").value = s;
    document.getElementById("accountcolors-picker-v-scale").value = v;

    document.getElementById("accountcolors-picker-h-value").value = h;
    document.getElementById("accountcolors-picker-s-value").value = s;
    document.getElementById("accountcolors-picker-v-value").value = v;

    document.getElementById("accountcolors-picker-h-scale").style.setProperty("--h-scale-image", "-moz-linear-gradient(left,red,yellow,lime,aqua,blue,fuchsia,red)", "");

    accountColorsOptions.pickerHSVtoRGB(0, 0, v, RGB);
    hexlo = accountColorsOptions.pickerMakeHexStr(RGB.r, RGB.g, RGB.b);
    accountColorsOptions.pickerHSVtoRGB(h, 100, v, RGB);
    hexhi = accountColorsOptions.pickerMakeHexStr(RGB.r, RGB.g, RGB.b);
    document.getElementById("accountcolors-picker-s-scale").style.setProperty("--s-scale-image", "-moz-linear-gradient(left,#" + hexlo + ",#" + hexhi + ")", "");

    accountColorsOptions.pickerHSVtoRGB(h, s, 100, RGB);
    hexhi = accountColorsOptions.pickerMakeHexStr(RGB.r, RGB.g, RGB.b);
    document.getElementById("accountcolors-picker-v-scale").style.setProperty("--v-scale-image", "-moz-linear-gradient(left,#000000,#" + hexhi + ")", "");

    /* Update hex string */

    hexstr = accountColorsOptions.pickerMakeHexStr(r, g, b);
    document.getElementById("accountcolors-picker-hexstr").value = hexstr;

    /* Update palette*/

    if (pickerbutton.id.indexOf("font") >= 0) {
      element = document
        .getElementById("accountcolors-picker-fontpalette-panel")
        .getElementsByAttribute("color", "#" + hexstr)
        .item(0);
      if (element != null) document.getElementById("accountcolors-picker-fontpalette").children[0].style.setProperty("background-color", "#" + hexstr, "");
      else document.getElementById("accountcolors-picker-fontpalette").children[0].style.setProperty("background-color", "#E1E1E1");
    } else {
      element = document
        .getElementById("accountcolors-picker-bkgdpalette-panel")
        .getElementsByAttribute("color", "#" + hexstr)
        .item(0);
      if (element != null) document.getElementById("accountcolors-picker-bkgdpalette").children[0].style.setProperty("background-color", "#" + hexstr, "");
      else document.getElementById("accountcolors-picker-bkgdpalette").children[0].style.setProperty("background-color", "#E1E1E1");
    }

    /* Update sample */

    if (pickerbutton.id.indexOf("font") >= 0) {
      index = Number(pickerbutton.id.substr(24));

      document.getElementById("accountcolors-picker-sample").style.setProperty("color", "#" + hexstr, "");

      if (accountColorsOptions.prefs.getBoolPref("picker-autobkgd")) {
        document.getElementById("accountcolors-picker-sample").style.setProperty("background-color", accountColorsOptions.autoBkgdColor("#" + hexstr), "");
      } else document.getElementById("accountcolors-picker-sample").style.setProperty("background-color", accountColorsOptions.pickerGetColor("accountcolors-bkgdpicker" + index), "");
    } else {
      index = Number(pickerbutton.id.substr(24));

      document.getElementById("accountcolors-picker-sample").style.setProperty("color", accountColorsOptions.pickerGetColor("accountcolors-fontpicker" + index), "");

      document.getElementById("accountcolors-picker-sample").style.setProperty("background-color", "#" + hexstr, "");
    }
  },

  pickerClose: function () {
    document.getElementById("accountcolors-picker-panel").hidePopup();

    window.removeEventListener("keypress", accountColorsOptions.pickerReturn, true);
  },

  pickerOkay: function () {
    var pickerbutton, hexstr;

    pickerbutton = accountColorsOptions.pickerButton;

    hexstr = document.getElementById("accountcolors-picker-hexstr").value;

    accountColorsOptions.pickerSetColor(pickerbutton.id, "#" + hexstr);

    if (pickerbutton.id.indexOf("font") >= 0) accountColorsOptions.updateFontColor(Number(pickerbutton.id.substr(24)));
    else accountColorsOptions.updateBkgdColor(Number(pickerbutton.id.substr(24)));

    document.getElementById("accountcolors-picker-panel").hidePopup();

    window.removeEventListener("keypress", accountColorsOptions.pickerReturn, true);
  },

  pickerReturn: function (event) {
    if (event.keyCode == event.DOM_VK_RETURN) {
      accountColorsOptions.pickerOkay();

      event.preventDefault();
      event.stopPropagation();
    }
  },

  pickerGetColor: function (pickerId) {
    var pickerbutton, r, g, b, hexstr;
    var rgbColors = new Array();

    pickerbutton = document.getElementById(pickerId);

    if (pickerbutton.children[0].style.getPropertyPriority("background-color") != "important") {
      return "" // If not user-defined color, return empty string to use system default color prevent storing it to prefs
    }

    rgbColors = pickerbutton.children[0].style.getPropertyValue("background-color").match(/rgb\((\d+),\s(\d+),\s(\d+)\)/);

    r = Number(rgbColors[1]).toString(16).toUpperCase();
    if (r.length < 2) r = "0" + r;
    g = Number(rgbColors[2]).toString(16).toUpperCase();
    if (g.length < 2) g = "0" + g;
    b = Number(rgbColors[3]).toString(16).toUpperCase();
    if (b.length < 2) b = "0" + b;

    hexstr = r + g + b;

    return "#" + hexstr;
  },

  pickerSetColor: function (pickerId, color) {
    var pickerbutton;

    pickerbutton = document.getElementById(pickerId);

    if (!!color) {
      pickerbutton.children[0].style.setProperty("background-color", color, "important"); // Use a special priority flag to indicate it's user-defined color (instead of default)
    } else {
      if (pickerId.indexOf("font") >= 0) {
        color = accountColorsOptions.theme.colors.textcolor;
      } else if (pickerId.indexOf("bkgd") >= 0) {
        color = accountColorsOptions.theme.colors.backgroundcolor;
      }
      pickerbutton.children[0].style.setProperty("background-color", color, ""); // Use a default light scheme before resolving theme from promise
    }

    return color;
  },

  autoBkgdColor: function (fontcolor) {
    var red, green, blue;

    red = parseInt(fontcolor.substr(1, 2), 16);
    red = (255 - Math.round((255 - red) / 8.5)).toString(16).toUpperCase();

    green = parseInt(fontcolor.substr(3, 2), 16);
    green = (255 - Math.round((255 - green) / 8.5)).toString(16).toUpperCase();

    blue = parseInt(fontcolor.substr(5, 2), 16);
    blue = (255 - Math.round((255 - blue) / 8.5)).toString(16).toUpperCase();

    if (fontcolor == "#000000") red = green = blue = "FF";

    return "#" + red + green + blue;
  },

  pickerMakeHexStr: function (r, g, b) {
    var hexstr;

    r = r.toString(16).toUpperCase();
    if (r.length < 2) r = "0" + r;
    g = g.toString(16).toUpperCase();
    if (g.length < 2) g = "0" + g;
    b = b.toString(16).toUpperCase();
    if (b.length < 2) b = "0" + b;

    hexstr = "" + r + g + b;

    return hexstr;
  },

  pickerRGBtoHSV: function (r, g, b, HSV) {
    var min, max, chroma, h, s, v;

    r = r / 255;
    g = g / 255;
    b = b / 255;

    min = Math.min(r, g, b);
    max = Math.max(r, g, b);
    chroma = max - min;

    v = max;

    if (chroma == 0) s = 0;
    else s = chroma / max;

    if (chroma == 0) h = 0; /* greys */
    else if (r == max) h = (g - b) / chroma + 0; /* between yellow and magenta */
    else if (g == max) h = (b - r) / chroma + 2; /* between cyan and yellow */
    else if (b == max) h = (r - g) / chroma + 4; /* between magenta and cyan */
    if (h < 0) h = h + 6;
    h = h / 6;

    HSV.h = Math.round(h * 360);
    HSV.s = Math.round(s * 100);
    HSV.v = Math.round(v * 100);
  },

  pickerHSVtoRGB: function (h, s, v, RGB) {
    var i, f, chroma, x0, x1, r, g, b;

    h = h / 360;
    s = s / 100;
    v = v / 100;

    i = Math.floor(h * 6);
    f = h * 6 - i;
    chroma = v * s;
    x0 = chroma * f;
    x1 = chroma * (1 - f);

    switch (i % 6) {
      case 0:
        r = chroma;
        g = x0;
        b = 0;
        break;
      case 1:
        r = x1;
        g = chroma;
        b = 0;
        break;
      case 2:
        r = 0;
        g = chroma;
        b = x0;
        break;
      case 3:
        r = 0;
        g = x1;
        b = chroma;
        break;
      case 4:
        r = x0;
        g = 0;
        b = chroma;
        break;
      case 5:
        r = chroma;
        g = 0;
        b = x1;
        break;
    }

    r = r + (v - chroma);
    g = g + (v - chroma);
    b = b + (v - chroma);

    RGB.r = Math.round(r * 255);
    RGB.g = Math.round(g * 255);
    RGB.b = Math.round(b * 255);
  },
};
