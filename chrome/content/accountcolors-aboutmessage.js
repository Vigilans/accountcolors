/************************************************************************/
/*                                                                      */
/*      Account Colors  -  Thunderbird Extension  -  about:message      */
/*                                                                      */
/*      Javascript for about:message overlay                            */
/*                                                                      */
/*      Copyright (C) 2008-2019  by  DW-dev                             */
/*      Copyright (C) 2022-2022  by  MrMelon54                          */
/*                                                                      */
/*      Last Edit  -  15 Jul 2022                                       */
/*                                                                      */
/************************************************************************/

var accountColorsAboutMessage = {
  prefs: Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("extensions.accountcolors."),

  accountManager: Components.classes["@mozilla.org/messenger/account-manager;1"].getService(Components.interfaces.nsIMsgAccountManager),

  messenger: window.top && window.top.messenger || window.messenger,

  /* Listen for changes to settings */

  prefsObserver: {
    register: function () {
      /* Add the observer */
      this.registered = true;
      accountColorsAboutMessage.prefs.addObserver("", this, false);
    },

    unregister: function () {
      if (!this.registered) return;

      accountColorsAboutMessage.prefs.removeObserver("", this);
    },

    observe: function (subject, topic, data) {
      var element;

      if (topic != "nsPref:changed") return;

      /* Update Message Pane & Message Tab */

      accountColorsAboutMessage.messageWindow();
    },
  },

  /* Listen for the existence of */

  headerObserver: {
    register: function () {
      var elements = [
        "expandedsubjectBox",
        "expandedHeaderView",
        "expandedfromBox",
        "expandedfromLabel",
        "expandedsubjectLabel",
        "expandedtoLabel",
        "expandedtoBox",
        "dateValueBox",
        "header-view-toolbar",
      ];
      /* Add the observer */
      this.registered = true;
      this.observer = new MutationObserver(this.observe);
      for (var element of elements) {
        element = window.document.getElementById(element);
        if (element != null) {
          this.observer.observe(element, { attributes: true, attributeFilter: ["style"] });
        }
      }
    },

    unregister: function () {
      if (!this.registered) return;
      this.observer.disconnect();
    },

    observe: function (mutationsList, observer) {
      for(let mutation of mutationsList) {
        if (mutation.type === 'attributes' && mutation.attributeName == "style") {
          accountColorsAboutMessage.messageWindow();
          return;
        }
      }
    }
  },

  /* Get messsage header */

  getMsgHdr(window) {
    if (!!window.gMessage) {
      return window.gMessage; /* if message already displayed, thunderbird 115+ */
    } else if (!!window.gFolderDisplay) {
      return window.gFolderDisplay.selectedMessage; /* if message already displayed */
    } else if (!!window.gMessageDisplay && !!window.gMessageDisplay.folderDisplay.selectedMessageUris && !!window.gMessageDisplay.folderDisplay.selectedMessageUris[0]) {
      return accountColorsAboutMessage.messenger.msgHdrFromURI(window.gMessageDisplay.folderDisplay.selectedMessageUris[0]); /* for messenger window */
    } else if (!!window.arguments && !!window.arguments[0] && "wrappedJSObject" in window.arguments[0]) {
      return window.arguments[0].wrappedJSObject.msgHdr;
    }  else if (!!window.arguments && window.arguments[0] instanceof Components.interfaces.nsIMsgDBHdr) {
      return window.arguments[0];
    }
    return null;
  },

  /* On Unload */

  onUnload: function () {
    accountColorsAboutMessage.prefsObserver.unregister();
    accountColorsAboutMessage.headerObserver.unregister();
    window.document.getElementById("messagepane").removeEventListener("load", accountColorsAboutMessage.messageWindow, true);
    accountColorsAboutMessage.messageWindow(null, true); // Clear colors during unload.
  },

  /* On Load */

  onLoad: function () {
    window.removeEventListener("load", accountColorsAboutMessage.onLoad, false);

    /* Register preferences observer */

    accountColorsAboutMessage.prefsObserver.register(window);

    /* Register header observer */

    accountColorsAboutMessage.headerObserver.register();

    /* Add listeners for Message Window */

    window.document.getElementById("messagepane").addEventListener("load", accountColorsAboutMessage.messageWindow, true);

    /* Initial call for Message Window */

    accountColorsAboutMessage.messageWindow();
  },

  /* Message Window */

  messageWindow: function (event, clear) {
    var document = window.document;
    var msgHdr = accountColorsAboutMessage.getMsgHdr(window);
    var accountkey, account, accountidkey, folder, server;
    var element, fontcolor, bkgdcolor, fontstyle, style, weight, fontsize;

    /* Check message header exists */
    if (msgHdr == null) {
      return;
    }

    if (clear) {
      accountidkey = ""; // Use an empty id to cause color clearing.
    } else if (accountColorsUtilities.thunderbirdVersion.major >= 102) {
      accountidkey = accountColorsUtilities.resolveAccountIdentityKeyForMessage(msgHdr, accountColorsAboutMessage.prefs.getBoolPref("message-hdraccount"));
    } else {
      /* Color based on received account */

      if (accountColorsAboutMessage.prefs.getBoolPref("message-hdraccount")) {
        /* color using account in message header */
        accountkey = accountColorsUtilities.getAccountKey(msgHdr); /* null string if sent message */
        account = accountColorsAboutMessage.accountManager.getAccount(accountkey);

        if (account == null) accountidkey = null; /* sent message */
        else if (account.defaultIdentity == null) accountidkey = account.key;
        else accountidkey = account.defaultIdentity.key;
      } /* color using account in which folder is located */ else {
        folder = msgHdr.folder;
        server = folder.server;
        account = accountColorsUtilities.findAccountForServer(server);

        if (account.defaultIdentity == null) accountidkey = account.key;
        else accountidkey = account.defaultIdentity.key;
      }
    }

    /* Color subject font */

    if (accountColorsAboutMessage.prefs.getBoolPref("message-colorfont")) {
      fontcolor = accountColorsUtilities.fontColorPref(accountidkey);

      document.getElementById("expandedsubjectBox").style.color = fontcolor;

      /* For CompactHeader add-on */

      element = document.getElementById("CompactHeader_collapsed1LsubjectBox");
      if (element != null) element.style.color = fontcolor;

      element = document.getElementById("CompactHeader_collapsed2LsubjectBox");
      if (element != null) element.style.color = fontcolor;
    } else {
      document.getElementById("expandedsubjectBox").style.color = "";

      /* For CompactHeader add-on */

      element = document.getElementById("CompactHeader_collapsed1LsubjectBox");
      if (element != null) element.style.color = "";

      element = document.getElementById("CompactHeader_collapsed2LsubjectBox");
      if (element != null) element.style.color = "";
    }

    /* Color header background */

    if (accountColorsAboutMessage.prefs.getBoolPref("message-colorbkgd")) {
      bkgdcolor = accountColorsUtilities.bkgdColorPref(accountidkey);
      if (accountColorsAboutMessage.prefs.getBoolPref("message-defaultbkgd") && bkgdcolor == "#FFFFFF") bkgdcolor = "";

      if (accountColorsAboutMessage.prefs.getBoolPref("message-colorbkgd-header-label")) {
        element = document.getElementById("messageHeader");
        if (element != null) {
          width = accountColorsAboutMessage.prefs.getIntPref("message-header-label-width") + "px";
          element.style.backgroundImage = "linear-gradient(to right, " + bkgdcolor + ", " + bkgdcolor + " " + width + ", transparent " + width + ", transparent 100%)";
          element.style.backgroundColor = "";
        }
      } else if (accountColorsAboutMessage.prefs.getBoolPref("message-colorbkgd-gradient")) {
        element = document.getElementById("messageHeader");
        if (element != null) {
          element.style.backgroundImage = "linear-gradient(to right, " + bkgdcolor + " 0%, transparent 100%)";
          element.style.backgroundColor = "";
        }
      } else {
        element = document.getElementById("expandedHeaderView"); // Removed since TB 102+
        if (element != null) element.style.backgroundColor = bkgdcolor;

        element = document.getElementById("messageHeader");
        if (element != null) {
          element.style.backgroundColor = bkgdcolor;
          element.style.backgroundImage = "";
        }

        /* For CompactHeader add-on */

        element = document.getElementById("CompactHeader_collapsedHeaderView");
        if (element != null) element.style.backgroundColor = bkgdcolor;
      }
    } else {
      element = document.getElementById("expandedHeaderView"); // Removed since TB 102+
      if (element != null) element.style.backgroundColor = "";

      element = document.getElementById("messageHeader");
      if (element != null) {
        element.style.backgroundColor = "";
        element.style.backgroundImage = "";
      }

      /* For CompactHeader add-on */

      element = document.getElementById("CompactHeader_collapsedHeaderView");
      if (element != null) element.style.backgroundColor = "";
    }

    /* Color from font */

    if (accountColorsAboutMessage.prefs.getBoolPref("message-colorfrom")) {
      fontcolor = accountColorsUtilities.fontColorPref(accountidkey);

      element = document.getElementById("expandedfromBox");
      if (element.children[0].id == "fromHeading") { // expandedfromBox.children[0] becomes fromHeading span in newer TB version
        element.style.color = fontcolor; // And color the whole element is enough
      } else {
        element.children[0].children[0].style.color = fontcolor;
      }

      /* For CompactHeader add-on */

      element = document.getElementById("CompactHeader_collapsed1LfromBox");
      if (element != null) element.children[0].children[0].style.color = fontcolor;

      element = document.getElementById("CompactHeader_collapsed2LfromBox");
      if (element != null) element.children[0].children[0].style.color = fontcolor;
    } else {
      element = document.getElementById("expandedfromBox");
      if (element.children[0].id == "fromHeading") { // expandedfromBox.children[0] becomes fromHeading span in newer TB version
        element.style.color = "";
      } else {
        element.children[0].children[0].style.color = "";
      }

      /* For CompactHeader add-on */

      element = document.getElementById("CompactHeader_collapsed1LfromBox");
      if (element != null) element.children[0].children[0].style.color = "";

      element = document.getElementById("CompactHeader_collapsed2LfromBox");
      if (element != null) element.children[0].children[0].style.color = "";
    }

    /* Black/White header labels */

    if (accountColorsAboutMessage.prefs.getBoolPref("message-blackhdrlabels")) {
      document.getElementById("expandedfromLabel").style.color = "black";
      document.getElementById("expandedsubjectLabel").style.color = "black";
      document.getElementById("expandedtoLabel").style.color = "black";

      element = document.getElementById("expandedtoBox");
      if (element.children[0].id == "toHeading") { // expandedtoBox.children[0] becomes toHeading span in newer TB version
        element.style.color = "black"; // And color the whole element is enough
      } else {
        element.children[0].children[0].style.color = "black";
        element.children[1].style.color = "black";
      }

      element = document.getElementById("dateValueBox"); // Removed since TB 102+
      if (element != null) element.style.color = "black";

      document.getElementById("header-view-toolbar").style.color = "black";

      /* For CompactHeader add-on */

      element = document.getElementById("CompactHeader_collapsed1LdateBox");
      if (element != null) element.style.color = "black";
    } else if (accountColorsAboutMessage.prefs.getBoolPref("message-whitehdrlabels")) {
      document.getElementById("expandedfromLabel").style.color = "white";
      document.getElementById("expandedsubjectLabel").style.color = "white";
      document.getElementById("expandedtoLabel").style.color = "white";

      element = document.getElementById("expandedtoBox");
      if (element.children[0].id == "toHeading") { // expandedtoBox.children[0] becomes toHeading span in newer TB version
        element.style.color = "white"; // And color the whole element is enough
      } else {
        element.children[0].children[0].style.color = "white";
        element.children[1].style.color = "white";
      }

      element = document.getElementById("dateValueBox"); // Removed since TB 102+
      if (element != null) element.style.color = "white";

      document.getElementById("header-view-toolbar").style.color = "white";

      /* For CompactHeader add-on */

      element = document.getElementById("CompactHeader_collapsed1LdateBox");
      if (element != null) element.style.color = "white";
    } else {
      document.getElementById("expandedfromLabel").style.color = "";
      document.getElementById("expandedsubjectLabel").style.color = "";
      document.getElementById("expandedtoLabel").style.color = "";

      element = document.getElementById("expandedtoBox");
      if (element.children[0].id == "toHeading") { // expandedtoBox.children[0] becomes toHeading span in newer TB version
        element.style.color = "";
      } else {
        element.children[0].children[0].style.color = "";
        element.children[1].style.color = "";
      }

      element = document.getElementById("dateValueBox"); // Removed since TB 102+
      if (element != null) element.style.color = "";

      document.getElementById("header-view-toolbar").style.color = "";

      /* For CompactHeader add-on */

      element = document.getElementById("CompactHeader_collapsed1LdateBox");
      if (element != null) element.style.color = "";
    }

    /* Subject font style */

    if (accountColorsAboutMessage.prefs.getBoolPref("message-setfontstyle")) {
      fontstyle = accountColorsAboutMessage.prefs.getIntPref("message-fontstyle");

      switch (fontstyle) {
        case 0 /* Normal */:
          style = "normal";
          weight = "normal";
          break;
        case 1 /* Italic */:
          style = "italic";
          weight = "normal";
          break;
        case 2 /* Bold */:
          style = "normal";
          weight = "bold";
          break;
        case 3 /* Bold Italic */:
          style = "italic";
          weight = "bold";
          break;
      }

      document.getElementById("expandedsubjectBox").style.fontStyle = style;
      document.getElementById("expandedsubjectBox").style.fontWeight = weight;

      /* For CompactHeader add-on */

      element = document.getElementById("CompactHeader_collapsed1LsubjectBox");
      if (element != null) element.style.fontStyle = "";
      if (element != null) element.style.fontWeight = "";

      element = document.getElementById("CompactHeader_collapsed2LsubjectBox");
      if (element != null) element.style.fontStyle = "";
      if (element != null) element.style.fontWeight = "";
    } else {
      document.getElementById("expandedsubjectBox").style.fontStyle = "";
      document.getElementById("expandedsubjectBox").style.fontWeight = "";

      /* For CompactHeader add-on */

      element = document.getElementById("CompactHeader_collapsed1LsubjectBox");
      if (element != null) element.style.fontStyle = "";
      if (element != null) element.style.fontWeight = "";

      element = document.getElementById("CompactHeader_collapsed2LsubjectBox");
      if (element != null) element.style.fontStyle = "";
      if (element != null) element.style.fontWeight = "";
    }

    /* Subject font size */

    if (accountColorsAboutMessage.prefs.getBoolPref("message-setfontsize")) {
      fontsize = accountColorsAboutMessage.prefs.getIntPref("message-fontsize");

      document.getElementById("expandedsubjectBox").style.fontSize = fontsize + "px";

      /* For CompactHeader add-on */

      element = document.getElementById("CompactHeader_collapsed1LsubjectBox");
      if (element != null) element.style.fontSize = fontsize + "px";

      element = document.getElementById("CompactHeader_collapsed2LsubjectBox");
      if (element != null) element.style.fontSize = fontsize + "px";
    } else {
      document.getElementById("expandedsubjectBox").style.fontSize = "";

      /* For CompactHeader add-on */

      element = document.getElementById("CompactHeader_collapsed1LsubjectBox");
      if (element != null) element.style.fontSize = "";

      element = document.getElementById("CompactHeader_collapsed2LsubjectBox");
      if (element != null) element.style.fontSize = "";
    }

    /* From font style */

    if (accountColorsAboutMessage.prefs.getBoolPref("message-setfromstyle")) {
      fontstyle = accountColorsAboutMessage.prefs.getIntPref("message-fromstyle");

      switch (fontstyle) {
        case 0 /* Normal */:
          style = "normal";
          weight = "normal";
          break;
        case 1 /* Italic */:
          style = "italic";
          weight = "normal";
          break;
        case 2 /* Bold */:
          style = "normal";
          weight = "bold";
          break;
        case 3 /* Bold Italic */:
          style = "italic";
          weight = "bold";
          break;
      }

      element = document.getElementById("expandedfromBox");
      if (element.children[0].id == "fromHeading") { // expandedfromBox.children[0] becomes fromHeading span in newer TB version
        element.style.fontStyle = style;
        element.style.fontWeight = weight;
      } else {
        element.children[0].children[0].style.fontStyle = style;
        element.children[0].children[0].style.fontWeight = weight;
      }

      /* For CompactHeader add-on */

      element = document.getElementById("CompactHeader_collapsed1LfromBox");
      if (element != null) element.children[0].children[0].style.fontStyle = style;
      if (element != null) element.children[0].children[0].style.fontWeight = weight;

      element = document.getElementById("CompactHeader_collapsed2LfromBox");
      if (element != null) element.children[0].children[0].style.fontStyle = style;
      if (element != null) element.children[0].children[0].style.fontWeight = weight;
    } else {
      element = document.getElementById("expandedfromBox");
      if (element.children[0].id == "fromHeading") { // expandedfromBox.children[0] becomes fromHeading span in newer TB version
        element.style.fontStyle = "";
        element.style.fontWeight = "";
      } else {
        element.children[0].children[0].style.fontStyle = "";
        element.children[0].children[0].style.fontWeight = "";
      }

      /* For CompactHeader add-on */

      element = document.getElementById("CompactHeader_collapsed1LfromBox");
      if (element != null) element.children[0].children[0].style.fontStyle = "";
      if (element != null) element.children[0].children[0].style.fontWeight = "";

      element = document.getElementById("CompactHeader_collapsed2LfromBox");
      if (element != null) element.children[0].children[0].style.fontStyle = "";
      if (element != null) element.children[0].children[0].style.fontWeight = "";
    }

    /* From font size */

    if (accountColorsAboutMessage.prefs.getBoolPref("message-setfromsize")) {
      fontsize = accountColorsAboutMessage.prefs.getIntPref("message-fromsize");

      element = document.getElementById("expandedfromBox");
      if (element.children[0].id == "fromHeading") { // expandedfromBox.children[0] becomes fromHeading span in newer TB version
        element.style.fontSize = fontsize + "px";
      } else {
        element.children[0].children[0].style.fontSize = fontsize + "px";
      }

      /* For CompactHeader add-on */

      element = document.getElementById("CompactHeader_collapsed1LfromBox");
      if (element != null) element.children[0].children[0].style.fontSize = fontsize + "px";

      element = document.getElementById("CompactHeader_collapsed2LfromBox");
      if (element != null) element.children[0].children[0].style.fontSize = fontsize + "px";
    } else {
      element = document.getElementById("expandedfromBox");
      if (element.children[0].id == "fromHeading") { // expandedfromBox.children[0] becomes fromHeading span in newer TB version
        element.style.fontSize = "";
      } else {
        element.children[0].children[0].style.fontSize = "";
      }

      /* For CompactHeader add-on */

      element = document.getElementById("CompactHeader_collapsed1LfromBox");
      if (element != null) element.children[0].children[0].style.fontSize = "";

      element = document.getElementById("CompactHeader_collapsed2LfromBox");
      if (element != null) element.children[0].children[0].style.fontSize = "";
    }
  },
};
