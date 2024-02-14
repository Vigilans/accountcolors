/************************************************************************/
/*                                                                      */
/*      Account Colors  -  Thunderbird Extension  -  Compose Window     */
/*                                                                      */
/*      Javascript for Compose Window overlay                           */
/*                                                                      */
/*      Copyright (C) 2008-2019  by  DW-dev                             */
/*      Copyright (C) 2022-2022  by  MrMelon54                          */
/*                                                                      */
/*      Last Edit  -  15 Jul 2022                                       */
/*                                                                      */
/************************************************************************/

"use strict";

var accountColorsCompose = {
  prefs: Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("extensions.accountcolors."),

  accountManager: Components.classes["@mozilla.org/messenger/account-manager;1"].getService(Components.interfaces.nsIMsgAccountManager),

  winmed: Components.classes["@mozilla.org/appshell/window-mediator;1"].getService(Components.interfaces.nsIWindowMediator),

  /* Listen for changes to settings */

  prefsObserver: {
    register: function () {
      /* Add the observer */
      this.registered = true;
      accountColorsCompose.prefs.addObserver("", this, false);
    },

    unregister: function () {
      if (!this.registered) return;

      accountColorsCompose.prefs.removeObserver("", this);
    },

    observe: function (subject, topic, data) {
      if (topic != "nsPref:changed") return;

      /* Update Compose Window */

      accountColorsCompose.composeWindow();
    },
  },

  /* On Unload */

  onUnload: function () {
    accountColorsCompose.prefsObserver.unregister();
    window.removeEventListener("compose-window-init", accountColorsCompose.composeWindow, true);
    window.removeEventListener("compose-from-changed", accountColorsCompose.composeWindow, true);
    // Clear colors during unload.
    accountColorsCompose.composeWindow(null, true);
  },

  /* On Load */

  onLoad: function () {
    var element, style, fontcolor;

    window.removeEventListener("load", accountColorsCompose.onLoad, false);

    /* Register preferences observer */

    accountColorsCompose.prefsObserver.register();

    /* Add listeners for Compose Window */
    window.addEventListener("compose-window-init", accountColorsCompose.composeWindow, true);
    window.addEventListener("compose-from-changed", accountColorsCompose.composeWindow, true);

    /* Initial call for Compose Window */

    accountColorsCompose.composeWindow();
  },

  /* Compose Window */

  composeWindow: function (event, clear = false) {
    var i, menulist, accountidkey, menupopup, menuitem;
    var defaultbkgd, bkgdcolor, fontcolor, element, idkey, fontstyle, fontsize, width;

    menulist = document.getElementById("msgIdentity");

    // Abort if no entry is selected yet.
    if (!menulist.selectedItem) return;

    // Use an empty id to cause color clearing.
    accountidkey = clear ? "" : menulist.selectedItem.getAttribute("identitykey");

    bkgdcolor = accountColorsUtilities.bkgdColorPref(accountidkey);

    if (accountColorsCompose.prefs.getBoolPref("compose-defaultbkgd") && bkgdcolor == "#FFFFFF") defaultbkgd = true;
    else defaultbkgd = false;

    /* Color subject font */

    if (accountColorsCompose.prefs.getBoolPref("compose-colorfont")) {
      document.getElementById("msgSubject").style.color = accountColorsUtilities.fontColorPref(accountidkey);
    } else {
      document.getElementById("msgSubject").style.color = "";
    }

    /* Color subject background */

    if (accountColorsCompose.prefs.getBoolPref("compose-colorbkgd")) {
      bkgdcolor = accountColorsUtilities.bkgdColorPref(accountidkey) || "var(--toolbar-bgcolor)";

      element = document.getElementById("msgSubject");
      if (defaultbkgd) {
        element.style.backgroundColor = "";
      } else if (accountColorsCompose.prefs.getBoolPref("compose-colorbkgd-gradient")) {
        element.style.setProperty("background-image", "linear-gradient(to right, " + bkgdcolor + ", transparent 100%", "important");
      } else {
        element.style.setProperty("background-color", bkgdcolor, "important");
      }
    } else {
      element = document.getElementById("msgSubject");
      element.style.setProperty("background-color", "", "");
      element.style.setProperty("background-image", "", "");
    }

    /* Color from font */

    if (accountColorsCompose.prefs.getBoolPref("compose-colorfromfont")) {
      menulist = document.getElementById("msgIdentity");
      if (accountColorsUtilities.thunderbirdVersion.major >= 102 || menulist.children[1] == null) {
        menulist.style.color = accountColorsUtilities.fontColorPref(accountidkey); // At least after TB 102 (in fact, the same holds for 91,78...), menulist.children[1] does not exist.
      } else {
        menulist.children[1].children[1].style.color = accountColorsUtilities.fontColorPref(accountidkey);
        menulist.children[1].children[2].style.color = accountColorsUtilities.fontColorPref(accountidkey);
        menulist.children[2].children[0].style.color = accountColorsUtilities.fontColorPref(accountidkey);
      }

      menupopup = document.getElementById("msgIdentityPopup");

      for (i = 0; i < menupopup.childNodes.length - 1; i++ /* exclude 'Customize From Address...' menu item */) {
        menuitem = menupopup.childNodes[i];

        if (menuitem.localName == "menuitem") {
          /* not menu separator */
          idkey = menuitem.getAttribute("identitykey");

          menuitem.children[1].style.color = accountColorsUtilities.fontColorPref(idkey); // menu-iconic-text
          menuitem.children[3].style.color = accountColorsUtilities.fontColorPref(idkey); // menu-description
        }
      }
    } else {
      menulist = document.getElementById("msgIdentity");
      if (accountColorsUtilities.thunderbirdVersion.major >= 102 || menulist.children[1] == null) {
        menulist.style.color = "";
      } else {
        menulist.children[1].children[1].style.color = "";
        menulist.children[1].children[2].style.color = "";
        menulist.children[2].children[0].style.color = "";
      }

      menupopup = document.getElementById("msgIdentityPopup");

      for (i = 0; i < menupopup.childNodes.length - 1; i++ /* exclude 'Customize From Address...' menu item */) {
        menuitem = menupopup.childNodes[i];

        if (menuitem.localName == "menuitem") {
          /* not menu separator */
          menuitem.children[1].style.color = "";
          menuitem.children[3].style.color = "";
        }
      }
    }

    /* Color from background */

    if (accountColorsCompose.prefs.getBoolPref("compose-colorfrombkgd")) {
      bkgdcolor = accountColorsUtilities.bkgdColorPref(accountidkey);

      if (accountColorsCompose.prefs.getBoolPref("compose-colorbkgd-idmenu-label")) { // Do not render background color of selected identity box in label mode
        menulist = document.getElementById("msgIdentity");
        menulist.style.backgroundColor = "";
        menulist.style.backgroundImage = "";
      } else if (accountColorsCompose.prefs.getBoolPref("compose-colorbkgd-gradient")) {
        menulist.style.backgroundImage = "linear-gradient(to right, " + bkgdcolor + ", transparent 100%)";
        menulist.style.backgroundColor = "";
      } else if (defaultbkgd) {
        menulist = document.getElementById("msgIdentity");
        menulist.style.backgroundColor = "";
        menulist.style.backgroundImage = "";
      } else {
        menulist = document.getElementById("msgIdentity");
        menulist.style.backgroundColor = bkgdcolor;
      }

      menupopup = document.getElementById("msgIdentityPopup");

      for (i = 0; i < menupopup.childNodes.length - 1; i++ /* exclude 'Customize From Address...' menu item */) {
        menuitem = menupopup.childNodes[i];

        if (menuitem.localName == "menuitem") {
          /* not menu separator */
          idkey = menuitem.getAttribute("identitykey");
          bkgdcolor = accountColorsUtilities.bkgdColorPref(idkey);

          if (accountColorsCompose.prefs.getBoolPref("compose-colorbkgd-idmenu-label")) {
            width = accountColorsCompose.prefs.getIntPref("compose-idmenu-label-width") + "px";
            menuitem.style.backgroundImage = "linear-gradient(to right, " + bkgdcolor + ", " + bkgdcolor + " " + width + ", transparent " + width + ", transparent 100%)";
            menuitem.style.backgroundColor = "";
            menuitem.style.setProperty("border-radius", "0", "");
          } else if (accountColorsCompose.prefs.getBoolPref("compose-colorbkgd-gradient")) {
            menuitem.style.backgroundImage = "linear-gradient(to right, " + bkgdcolor + ", transparent 100%)";
            menuitem.style.backgroundColor = "";
            menuitem.style.removeProperty("border-radius");
          } else {
            menuitem.style.backgroundColor = bkgdcolor;
            menuitem.style.backgroundImage = "";
            menuitem.style.removeProperty("border-radius");
          }
        }
      }
    } else {
      menulist = document.getElementById("msgIdentity");
      menulist.style.backgroundColor = "";
      menulist.style.backgroundImage = "";

      menupopup = document.getElementById("msgIdentityPopup");

      for (i = 0; i < menupopup.childNodes.length - 1; i++ /* exclude 'Customize From Address...' menu item */) {
        menuitem = menupopup.childNodes[i];

        if (menuitem.localName == "menuitem") {
          /* not menu separator */
          menuitem.style.backgroundColor = "";
          menuitem.style.backgroundImage = "";
        }
      }
    }

    /* Color to/cc/bcc fonts */

    if (accountColorsCompose.prefs.getBoolPref("compose-colortofont")) {
      fontcolor = accountColorsUtilities.fontColorPref(accountidkey);

      document.documentElement.style.setProperty("--ac-colortofont", fontcolor, "");
      document.getElementById("msgcomposeWindow").setAttribute("ac-colortofont", "");
    } else {
      document.documentElement.style.removeProperty("--ac-colortofont");
      document.getElementById("msgcomposeWindow").removeAttribute("ac-colortofont");
    }

    /* Color to/cc/bcc background */

    if (accountColorsCompose.prefs.getBoolPref("compose-colortobkgd")) {
      bkgdcolor = accountColorsUtilities.bkgdColorPref(accountidkey);

      if (defaultbkgd) {
        document.documentElement.style.removeProperty("--ac-colortobkgd");
        document.getElementById("msgcomposeWindow").removeAttribute("ac-colortobkgd");
        document.getElementById("msgcomposeWindow").removeAttribute("ac-colortobkgd-asgradient");
      } else if (accountColorsCompose.prefs.getBoolPref("compose-colorbkgd-gradient")) {
        document.documentElement.style.setProperty("--ac-colortobkgd", bkgdcolor, "");
        document.getElementById("msgcomposeWindow").setAttribute("ac-colortobkgd-asgradient", "");
      } else {
        document.documentElement.style.setProperty("--ac-colortobkgd", bkgdcolor, "");
        document.getElementById("msgcomposeWindow").setAttribute("ac-colortobkgd", "");
      }
    } else {
      document.documentElement.style.removeProperty("--ac-colortobkgd");
      document.getElementById("msgcomposeWindow").removeAttribute("ac-colortobkgd");
      document.getElementById("msgcomposeWindow").removeAttribute("ac-colortobkgd-asgradient");
    }

    /* Color attachment font */

    if (accountColorsCompose.prefs.getBoolPref("compose-coloratmfont")) {
      fontcolor = accountColorsUtilities.fontColorPref(accountidkey);

      document.documentElement.style.setProperty("--ac-coloratmfont", fontcolor, "");
      document.getElementById("msgcomposeWindow").setAttribute("ac-coloratmfont", "");
    } else {
      document.documentElement.style.removeProperty("--ac-coloratmfont");
      document.getElementById("msgcomposeWindow").removeAttribute("ac-coloratmfont");
    }

    /* Color attachment background */

    if (accountColorsCompose.prefs.getBoolPref("compose-coloratmbkgd")) {
      bkgdcolor = accountColorsUtilities.bkgdColorPref(accountidkey);

      element = document.getElementById("attachmentBucket");
      if (defaultbkgd) {
        element.style.backgroundColor = "";
      } else if (accountColorsCompose.prefs.getBoolPref("compose-colorbkgd-gradient")) {
        element.style.setProperty("background-image", "linear-gradient(to right, " + bkgdcolor + ", transparent 100%", "important");
      } else {
        element.style.setProperty("background-color", bkgdcolor, "important");
      }
    } else {
      element = document.getElementById("attachmentBucket");
      element.style.setProperty("background-color", "", "");
      element.style.setProperty("background-image", "", "");
    }

    /* Color header font */

    if (accountColorsCompose.prefs.getBoolPref("compose-colorhdrfont")) {
      fontcolor = accountColorsUtilities.fontColorPref(accountidkey);

      // msgheaderstoolbar-box replaced by MsgHeadersToolbar since TB 102.
      element = document.getElementById("MsgHeadersToolbar") || document.getElementById("msgheaderstoolbar-box");
      if (element != null) {
        if (defaultbkgd) element.style.color = "";
        else element.style.setProperty("color", fontcolor, "important");
      }
      element = document.getElementById("attachmentArea");
      element = element && element.querySelector("html summary");
      if (element != null) {
        if (defaultbkgd) element.style.color = "";
        else element.style.setProperty("color", fontcolor, "important");
      }
    } else {
      element = document.getElementById("MsgHeadersToolbar") || document.getElementById("msgheaderstoolbar-box");
      if (element != null) {
        element.style.setProperty("color", "", "");
      }
      element = document.getElementById("attachmentArea");
      element = element && element.querySelector("html summary");
      if (element != null) {
        element.style.setProperty("color", "", "");
      }
    }

    /* Color header background */

    if (accountColorsCompose.prefs.getBoolPref("compose-colorhdrbkgd")) {
      bkgdcolor = accountColorsUtilities.bkgdColorPref(accountidkey);

      // msgheaderstoolbar-box replaced by MsgHeadersToolbar since TB 102.
      element = document.getElementById("MsgHeadersToolbar") || document.getElementById("msgheaderstoolbar-box");
      if (element != null) {
        if (defaultbkgd) {
          element.style.backgroundColor = "";
        } else if (accountColorsCompose.prefs.getBoolPref("compose-colorbkgd-gradient")) {
          element.style.setProperty("background-image", "linear-gradient(to right, " + bkgdcolor + ", transparent 100%", "important");
        } else {
          element.style.setProperty("background-color", bkgdcolor, "important");
        }
      }
      element = document.getElementById("attachmentArea");
      element = element && element.querySelector("html summary");
      if (element != null) {
        if (defaultbkgd) {
          element.style.backgroundColor = "";
        } else if (accountColorsCompose.prefs.getBoolPref("compose-colorbkgd-gradient")) {
          element.style.setProperty("background-image", "linear-gradient(to right, " + bkgdcolor + ", transparent 100%", "important");
        } else {
          element.style.setProperty("background-color", bkgdcolor, "important");
        }
      }
    } else {
      element = document.getElementById("MsgHeadersToolbar") || document.getElementById("msgheaderstoolbar-box");
      if (element != null) {
        element.style.setProperty("background-color", "", "");
        element.style.setProperty("background-image", "", "");
      }
      element = document.getElementById("attachmentArea");
      element = element && element.querySelector("html summary");
      if (element != null) {
        element.style.setProperty("background-color", "", "");
        element.style.setProperty("background-image", "", "");
      }
    }

    /* Black/White header labels */

    if (accountColorsCompose.prefs.getBoolPref("compose-blackhdrlabels")) {
      document.getElementById("identityLabel").style.color = "black";
      document.getElementById("subjectLabel").style.color = "black";
      document.getElementById("attachmentBucketCount").style.color = "black";
      document.getElementById("attachmentBucketSize").style.color = "black";

      document.getElementById("msgcomposeWindow").setAttribute("ac-blackhdrlabels", "");
      document.getElementById("msgcomposeWindow").removeAttribute("ac-whitehdrlabels");
    } else if (accountColorsCompose.prefs.getBoolPref("compose-whitehdrlabels")) {
      document.getElementById("identityLabel").style.color = "white";
      document.getElementById("subjectLabel").style.color = "white";
      document.getElementById("attachmentBucketCount").style.color = "white";
      document.getElementById("attachmentBucketSize").style.color = "white";

      document.getElementById("msgcomposeWindow").removeAttribute("ac-blackhdrlabels");
      document.getElementById("msgcomposeWindow").setAttribute("ac-whitehdrlabels", "");
    } else {
      document.getElementById("identityLabel").style.color = "";
      document.getElementById("subjectLabel").style.color = "";
      document.getElementById("attachmentBucketCount").style.color = "";
      document.getElementById("attachmentBucketSize").style.color = "";

      document.getElementById("msgcomposeWindow").removeAttribute("ac-blackhdrlabels");
      document.getElementById("msgcomposeWindow").removeAttribute("ac-whitehdrlabels");
    }

    /* Black/White field fonts */

    if (accountColorsCompose.prefs.getBoolPref("compose-blackfieldfont")) {
      document.getElementById("msgcomposeWindow").setAttribute("ac-blackfieldfont", "");
      document.getElementById("msgcomposeWindow").removeAttribute("ac-whitefieldfont");
    } else if (accountColorsCompose.prefs.getBoolPref("compose-whitefieldfont")) {
      document.getElementById("msgcomposeWindow").removeAttribute("ac-blackfieldfont");
      document.getElementById("msgcomposeWindow").setAttribute("ac-whitefieldfont", "");
    } else {
      document.getElementById("msgcomposeWindow").removeAttribute("ac-blackfieldfont");
      document.getElementById("msgcomposeWindow").removeAttribute("ac-whitefieldfont");
    }

    /* Light/Dark field backgrounds on hover or focus */

    if (accountColorsCompose.prefs.getBoolPref("compose-lightfieldbkgd")) {
      document.getElementById("msgcomposeWindow").setAttribute("ac-lightfieldbkgd", "");
      document.getElementById("msgcomposeWindow").removeAttribute("ac-darkfieldbkgd");
    } else if (accountColorsCompose.prefs.getBoolPref("compose-darkfieldbkgd")) {
      document.getElementById("msgcomposeWindow").removeAttribute("ac-lightfieldbkgd");
      document.getElementById("msgcomposeWindow").setAttribute("ac-darkfieldbkgd", "");
    } else {
      document.getElementById("msgcomposeWindow").removeAttribute("ac-lightfieldbkgd");
      document.getElementById("msgcomposeWindow").removeAttribute("ac-darkfieldbkgd");
    }

    /* Reinstate default hover style on from menu */

    if (accountColorsCompose.prefs.getBoolPref("compose-hoverfrom")) {
      document.getElementById("msgcomposeWindow").setAttribute("ac-hoverfrom", "");
    } else {
      document.getElementById("msgcomposeWindow").removeAttribute("ac-hoverfrom");
    }

    /* Subject font style */

    if (accountColorsCompose.prefs.getBoolPref("compose-setfontstyle")) {
      fontstyle = accountColorsCompose.prefs.getIntPref("compose-fontstyle");

      element = document.getElementById("msgSubject");

      switch (fontstyle) {
        case 0 /* Normal */:
          element.style.fontStyle = "normal";
          element.style.fontWeight = "normal";
          break;
        case 1 /* Italic */:
          element.style.fontStyle = "italic";
          element.style.fontWeight = "normal";
          break;
        case 2 /* Bold */:
          element.style.fontStyle = "normal";
          element.style.fontWeight = "bold";
          break;
        case 3 /* Bold Italic */:
          element.style.fontStyle = "italic";
          element.style.fontWeight = "bold";
          break;
      }
    } else {
      element = document.getElementById("msgSubject");
      element.style.fontStyle = "";
      element.style.fontWeight = "";
    }

    /* Subject font size */

    if (accountColorsCompose.prefs.getBoolPref("compose-setfontsize")) {
      fontsize = accountColorsCompose.prefs.getIntPref("compose-fontsize");

      element = document.getElementById("msgSubject");
      element.style.fontSize = fontsize + "px";
    } else {
      element = document.getElementById("msgSubject");
      element.style.fontSize = "";
    }

    /* From font style */

    if (accountColorsCompose.prefs.getBoolPref("compose-setidfontstyle")) {
      fontstyle = accountColorsCompose.prefs.getIntPref("compose-idfontstyle");

      menulist = document.getElementById("msgIdentity");

      if (accountColorsUtilities.thunderbirdVersion.major >= 102 || menulist.children[1] == null) {
        element = menulist;
      } else {
        element = menulist.children[1].children[1];
      }

      switch (fontstyle) {
        case 0 /* Normal */:
          element.style.fontStyle = "normal";
          element.style.fontWeight = "normal";
          break;
        case 1 /* Italic */:
          element.style.fontStyle = "italic";
          element.style.fontWeight = "normal";
          break;
        case 2 /* Bold */:
          element.style.fontStyle = "normal";
          element.style.fontWeight = "bold";
          break;
        case 3 /* Bold Italic */:
          element.style.fontStyle = "italic";
          element.style.fontWeight = "bold";
          break;
      }

      if (accountColorsUtilities.thunderbirdVersion.major >= 102 || menulist.children[1] == null) {
        element = menulist;
      } else {
        element = menulist.children[1].children[3];
      }

      switch (fontstyle) {
        case 0 /* Normal */:
          element.style.fontStyle = "normal";
          element.style.fontWeight = "normal";
          break;
        case 1 /* Italic */:
          element.style.fontStyle = "italic";
          element.style.fontWeight = "normal";
          break;
        case 2 /* Bold */:
          element.style.fontStyle = "normal";
          element.style.fontWeight = "bold";
          break;
        case 3 /* Bold Italic */:
          element.style.fontStyle = "italic";
          element.style.fontWeight = "bold";
          break;
      }
    } else {
      menulist = document.getElementById("msgIdentity");

      if (accountColorsUtilities.thunderbirdVersion.major >= 102 || menulist.children[1] == null) {
        element = menulist;
        element.style.fontStyle = "";
        element.style.fontWeight = "";
      } else {
        element = menulist.children[1].children[1];
        element.style.fontStyle = "";
        element.style.fontWeight = "";

        element = menulist.children[1].children[3];
        element.style.fontStyle = "";
        element.style.fontWeight = "";
      }
    }

    /* From font size */

    if (accountColorsCompose.prefs.getBoolPref("compose-setidfontsize")) {
      fontsize = accountColorsCompose.prefs.getIntPref("compose-idfontsize");

      element = document.getElementById("msgIdentity");
      element.style.fontSize = fontsize + "px";
    } else {
      element = document.getElementById("msgIdentity");
      element.style.fontSize = "";
    }
  },

  cmdOptions: function () {
    var optionsWindow;

    optionsWindow = accountColorsCompose.winmed.getMostRecentWindow("accountcolors-options");

    if (optionsWindow) optionsWindow.focus();
    else window.openDialog("chrome://accountcolors/content/accountcolors-options.xhtml", "", "chrome,dialog,titlebar,centerscreen", null);
  },
};
