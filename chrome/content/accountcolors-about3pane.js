/************************************************************************/
/*                                                                      */
/*      Account Colors  -  Thunderbird Extension  -  about:3pane        */
/*                                                                      */
/*      Javascript for about:3pane overlay                              */
/*                                                                      */
/*      Copyright (C) 2008-2019  by  DW-dev                             */
/*      Copyright (C) 2022-2022  by  MrMelon54                          */
/*                                                                      */
/*      Last Edit  -  15 Jul 2022                                       */
/*                                                                      */
/************************************************************************/

var accountColorsAbout3Pane_102 = {
  prefs: Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("extensions.accountcolors."),

  obs: Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService),

  hdr: Components.classes["@mozilla.org/messenger/headerparser;1"].getService(Components.interfaces.nsIMsgHeaderParser),

  accountManager: Components.classes["@mozilla.org/messenger/account-manager;1"].getService(Components.interfaces.nsIMsgAccountManager),

  messenger: window.top && window.top.messenger || window.messenger,

  folderTree: window.folderTree || document.getElementById("folderTree"),

  threadTree: window.threadTree || document.getElementById("threadTree"),

  /* Listen for changes to account colors settings */

  prefsObserver: {
    register: function () {
      /* Add the observer */
      this.registered = true;
      accountColorsAbout3Pane.prefs.addObserver("", this, false);
    },

    unregister: function () {
      if (!this.registered) return;

      accountColorsAbout3Pane.prefs.removeObserver("", this);
    },

    observe: function (subject, topic, data) {
      var element;

      if (topic != "nsPref:changed") return;

      /* Generate CSS tree coloring rules */

      accountColorsAbout3Pane.generateRules();

      /* Update Folder Pane */

      accountColorsAbout3Pane.folderPane();
      accountColorsAbout3Pane.folderPaneManager.reload();

      /* Update Thread Pane */

      accountColorsAbout3Pane.threadPane();
      accountColorsAbout3Pane.threadPaneManager.reload();

      /* Update Message Pane & Message Tab */

      accountColorsAbout3Pane.messagePane();
      accountColorsAbout3Pane.messagePaneManager.reload();
    },
  },

  /* On Unload */

  onUnload: function () {
    accountColorsAbout3Pane.prefsObserver.unregister();

    accountColorsAbout3Pane.messagePaneManager.onUnload();
    accountColorsAbout3Pane.threadPaneManager.onUnload();
    accountColorsAbout3Pane.folderPaneManager.onUnload();

    // Clear on unload.
    accountColorsAbout3Pane.messagePane(null, true);
  },

  /* On Load */

  onLoad: function () {
    /* Wait for Thunderbird to finish parsing CSS style sheets and initializing folder tree */

    window.setTimeout(checkReady, 10, 0);

    function checkReady(retry) {
      var i, ready, sheet, count, row;

      ready = false;

      try {
        for (i = 0; i < document.styleSheets.length; i++) {
          if (document.styleSheets[i].href == "chrome://accountcolors-skin/content/accountcolors-messengerwindow-generated.css") {
            sheet = document.styleSheets[i];
          }
        }

        count = sheet.cssRules.length; /* throws exception if parsing of CSS not complete */

        row = gFolderTreeView.getIndexOfFolder(gFolderTreeView.getSelectedFolders()[0]); /* throws exception if folder tree not initialized */

        ready = true;
      } catch (e) {
        if (retry < 5) {
          window.setTimeout(checkReady, 20, retry + 1);
        } else {
          console.error(e);
        }
      }

      if (ready)
        window.setTimeout(function () {
          accountColorsAbout3Pane.initializePanes();
        }, 0); /* break execution */
    }
  },

  /* Initialize Folder/Thread/Message Panes */

  initializePanes: function () {
    var row;

    /* Generate CSS tree coloring rules */

    accountColorsAbout3Pane.generateRules();

    /* Register preferences observers */

    accountColorsAbout3Pane.prefsObserver.register();

    /* Setup for Folder/Thread Panes */

    accountColorsAbout3Pane.folderPaneManager.onLoad();

    accountColorsAbout3Pane.threadPaneManager.onLoad();

    accountColorsAbout3Pane.messagePaneManager.onLoad();

    /* Initial calls for Folder/Thread/Message Panes */

    accountColorsAbout3Pane.folderPane();

    accountColorsAbout3Pane.threadPane();

    accountColorsAbout3Pane.messagePane();

    /* Selecting folder in folder pane forces coloring of thread pane */
    /* Selecting top and bottom folders in folder pane forces coloring of all of folder pane */

    if (gFolderTreeView._rowMap.length) {
      row = gFolderTreeView.getIndexOfFolder(gFolderTreeView.getSelectedFolders()[0]);
      gFolderTreeView.selectFolder(gFolderTreeView._rowMap[gFolderTreeView._rowMap.length - 1]._folder);
      gFolderTreeView.selectFolder(gFolderTreeView._rowMap[0]._folder);
      gFolderTreeView.selectFolder(gFolderTreeView._rowMap[row]._folder);
    }
  },

  /* Generate CSS coloring rules for folderTree and threadTree */

  generateRules: function () {
    var i, sheet, color;
    var children = new Array();

    for (i = 0; i < document.styleSheets.length; i++) {
      if (document.styleSheets[i].href == "chrome://accountcolors-skin/content/accountcolors-messengerwindow-generated.css") {
        sheet = document.styleSheets[i];
      }
    }

    while (sheet.cssRules.length > 0) sheet.deleteRule(0);

    children = accountColorsAbout3Pane.prefs.getChildList("account", {});

    for (i = 0; i < children.length; i++) {
      color = accountColorsAbout3Pane.prefs.getCharPref(children[i]).substr(1);

      if (children[i].substr(children[i].length - 9) == "fontcolor") {
        sheet.insertRule("#folderPaneBox #folderTree treechildren::-moz-tree-cell-text(ac-fc-" + color + ",not-selected,not-dragOn) { color: #" + color + "; }", sheet.cssRules.length);
        sheet.insertRule("#threadPaneBox #threadTree treechildren::-moz-tree-cell-text(ac-fc-" + color + ",not-selected,untagged) { color: #" + color + "; }", sheet.cssRules.length);
        sheet.insertRule(":root[lwt-tree] #folderPaneBox #folderTree treechildren::-moz-tree-cell-text(ac-fc-" + color + ",not-selected,not-dragOn) { color: #" + color + "; }", sheet.cssRules.length);
        sheet.insertRule(":root[lwt-tree] #threadPaneBox #threadTree treechildren::-moz-tree-cell-text(ac-fc-" + color + ",not-selected,untagged) { color: #" + color + "; }", sheet.cssRules.length);
      } else if (children[i].substr(children[i].length - 9) == "bkgdcolor") {
        sheet.insertRule("#folderPaneBox #folderTree treechildren::-moz-tree-row(ac-bc-" + color + ",not-selected,not-dragOn) { background-color: #" + color + "; }", sheet.cssRules.length);
        sheet.insertRule("#threadPaneBox #threadTree treechildren::-moz-tree-row(ac-bc-" + color + ",not-selected) { background-color: #" + color + "; }", sheet.cssRules.length);
        sheet.insertRule(":root[lwt-tree] #folderPaneBox #folderTree treechildren::-moz-tree-row(ac-bc-" + color + ",not-selected,not-dragOn) { background-color: #" + color + "; }", sheet.cssRules.length);
        sheet.insertRule(":root[lwt-tree] #threadPaneBox #threadTree treechildren::-moz-tree-row(ac-bc-" + color + ",not-selected) { background-color: #" + color + "; }", sheet.cssRules.length);
      }
    }

    children = accountColorsAbout3Pane.prefs.getChildList("id", {});

    for (i = 0; i < children.length; i++) {
      color = accountColorsAbout3Pane.prefs.getCharPref(children[i]).substr(1);

      if (children[i].substr(children[i].length - 9) == "fontcolor") {
        sheet.insertRule("#folderPaneBox #folderTree treechildren::-moz-tree-cell-text(ac-fc-" + color + ",not-selected,not-dragOn) { color: #" + color + "; }", sheet.cssRules.length);
        sheet.insertRule("#threadPaneBox #threadTree treechildren::-moz-tree-cell-text(ac-fc-" + color + ",not-selected,untagged) { color: #" + color + "; }", sheet.cssRules.length);
        sheet.insertRule(":root[lwt-tree] #folderPaneBox #folderTree treechildren::-moz-tree-cell-text(ac-fc-" + color + ",not-selected,not-dragOn) { color: #" + color + " !important; }", sheet.cssRules.length); /* !important necessary to override new mail font color in Dark Theme */
        sheet.insertRule(":root[lwt-tree] #threadPaneBox #threadTree treechildren::-moz-tree-cell-text(ac-fc-" + color + ",not-selected,untagged) { color: #" + color + " !important; }", sheet.cssRules.length); /* !important necessary to override unread message font color in Dark Theme */
      } else if (children[i].substr(children[i].length - 9) == "bkgdcolor") {
        sheet.insertRule("#folderPaneBox #folderTree treechildren::-moz-tree-row(ac-bc-" + color + ",not-selected,not-dragOn) { background-color: #" + color + "; }", sheet.cssRules.length);
        sheet.insertRule("#threadPaneBox #threadTree treechildren::-moz-tree-row(ac-bc-" + color + ",not-selected) { background-color: #" + color + "; }", sheet.cssRules.length);
        sheet.insertRule(":root[lwt-tree] #folderPaneBox #folderTree treechildren::-moz-tree-row(ac-bc-" + color + ",not-selected,not-dragOn) { background-color: #" + color + "; }", sheet.cssRules.length);
        sheet.insertRule(":root[lwt-tree] #threadPaneBox #threadTree treechildren::-moz-tree-row(ac-bc-" + color + ",not-selected) { background-color: #" + color + "; }", sheet.cssRules.length);
      }
    }
  },

  folderPaneManager: {
    hoverRow: null,

    dragOnRow: null,

    originalGetRowProperties: null,

    originalGetCellProperties: null,

    onLoad: function () {
      /* Detour getRowProperties and getCellProperties of gFolderTreeView */
      if (!accountColorsAbout3Pane.folderPaneManager.originalGetRowProperties) {
        accountColorsAbout3Pane.folderPaneManager.originalGetRowProperties = gFolderTreeView.getRowProperties;
        gFolderTreeView.getRowProperties = accountColorsAbout3Pane.folderPaneManager.getRowProperties;
      }
      if (!accountColorsAbout3Pane.folderPaneManager.originalGetCellProperties) {
        accountColorsAbout3Pane.folderPaneManager.originalGetCellProperties = gFolderTreeView.getCellProperties;
        gFolderTreeView.getCellProperties = accountColorsAbout3Pane.folderPaneManager.getCellProperties;
      }

      window.addEventListener("load", accountColorsAbout3Pane.folderPane, false);
      accountColorsAbout3Pane.folderTree.addEventListener("mousemove", accountColorsAbout3Pane.folderPaneManager.onMouseMove, false);
      accountColorsAbout3Pane.folderTree.addEventListener("dragover", accountColorsAbout3Pane.folderPaneManager.onDragOver, false);
      accountColorsAbout3Pane.folderTree.addEventListener("dragleave", accountColorsAbout3Pane.folderPaneManager.onDrop, false);
      accountColorsAbout3Pane.folderTree.addEventListener("drop", accountColorsAbout3Pane.folderPaneManager.onDrop, false);
    },

    onUnload: function () {
      window.removeEventListener("load", accountColorsAbout3Pane.folderPane, false);
      accountColorsAbout3Pane.folderTree.removeEventListener("mousemove", accountColorsAbout3Pane.folderPaneManager.onMouseMove, false);
      accountColorsAbout3Pane.folderTree.removeEventListener("dragover", accountColorsAbout3Pane.folderPaneManager.onDragOver, false);
      accountColorsAbout3Pane.folderTree.removeEventListener("dragleave", accountColorsAbout3Pane.folderPaneManager.onDrop, false);
      accountColorsAbout3Pane.folderTree.removeEventListener("drop", accountColorsAbout3Pane.folderPaneManager.onDrop, false);

      /* Restore getRowProperties and getCellProperties of gFolderTreeView */
      if (!!accountColorsAbout3Pane.folderPaneManager.originalGetRowProperties) {
        gFolderTreeView.getRowProperties = accountColorsAbout3Pane.folderPaneManager.originalGetRowProperties;
        accountColorsAbout3Pane.folderPaneManager.originalGetRowProperties = null;
      }
      if (!!accountColorsAbout3Pane.folderPaneManager.originalGetCellProperties) {
        gFolderTreeView.getCellProperties = accountColorsAbout3Pane.folderPaneManager.originalGetCellProperties;
        accountColorsAbout3Pane.folderPaneManager.originalGetCellProperties = null;
      }
    },

    onMouseMove: function (event) { /* Detect mouse hovering over row in folder or thread pane */
      accountColorsAbout3Pane.folderPaneManager.hoverRow = this.getRowAt(event.clientX, event.clientY);
    },

    onDragOver: function (event) { /* Detect message dragged over row in folder pane */
      /* Derived from dragover event handler in tree.xml */

      var rowHeight, eventY, orientation;
      var row = {};
      var col = {};
      var child = {};

      this.getCellAt(event.clientX, event.clientY, row, col, child);

      rowHeight = this.rowHeight;
      eventY = event.clientY - this.treeBody.boxObject.y - rowHeight * (row.value - this.getFirstVisibleRow());

      if (row.value == -1) orientation = Components.interfaces.nsITreeView.DROP_ON;
      else if (eventY > rowHeight * 0.75) orientation = Components.interfaces.nsITreeView.DROP_AFTER;
      else if (eventY < rowHeight * 0.25) orientation = Components.interfaces.nsITreeView.DROP_BEFORE;
      else orientation = Components.interfaces.nsITreeView.DROP_ON;

      if (!gFolderTreeView.canDrop(row.value, orientation)) row.value = null;

      accountColorsAbout3Pane.folderPaneManager.dragOnRow = row.value;
    },

    onDrop: function (event) {
      if (accountColorsAbout3Pane.folderPaneManager.dragOnRow != null) {
        accountColorsAbout3Pane.folderPaneManager.dragOnRow = null;
        gFolderTreeView._tree.invalidate();
      }
    },

    reload: function() {
      element = accountColorsAbout3Pane.folderTree; /* Force re-load of Folder Tree */
      element.invalidate();

      element = accountColorsAbout3Pane.folderTree; /* Causes CSS Folder Tree -moz-tree-row height change to take effect */
      element.style.visibility = "hidden";
      element.style.visibility = "";
    },

    getRowProperties: function(row) {
      var props, server, account, accountidkey;
      var bkgdcolor, red, green, blue, brightness;

      if (!!accountColorsAbout3Pane.folderPaneManager.originalGetRowProperties) {
        props = accountColorsAbout3Pane.folderPaneManager.originalGetRowProperties.call(gFolderTreeView, row); /* call original handler */
      } else {
        props = ""
      }

      if (!gFolderTreeView._rowMap[row]._folder) {
        return props; // Unified Inbox row's _folder may be null
      }

      if (accountColorsUtilities.thunderbirdVersion.major >= 102) {
        accountidkey = accountColorsUtilities.resolveAccountIdentityKeyForFolder(gFolderTreeView._rowMap[row]._folder);
      } else {
        server = gFolderTreeView._rowMap[row]._folder.server;
        account = accountColorsUtilities.findAccountForServer(server);

        if (account.defaultIdentity == null) accountidkey = account.key;
        else accountidkey = account.defaultIdentity.key;
      }

      /* add extra properties for not-hover, not-dragOn, not-selected, not-focused, background color, folder background color, and darker selection bar */
      /* required to select tree element styles defined in accountcolors-messengerwindow[-generated].css */

      if (row != accountColorsAbout3Pane.hoverRow) {
        props += " " + "not-hover";
      }

      if (row != accountColorsAbout3Pane.dragOnRow) {
        props += " " + "not-dragOn";
      }

      if (!gFolderTreeView.selection.isSelected(row)) {
        props += " " + "not-selected";
      }

      if (!accountColorsAbout3Pane.folderTree.focused) {
        props += " " + "not-focused";
      }

      /* Color account/folders background */

      if ((accountColorsAbout3Pane.prefs.getBoolPref("folder-colorbkgd") && gFolderTreeView._rowMap[row]._folder.isServer) || (accountColorsAbout3Pane.prefs.getBoolPref("folder-colorfldbkgd") && !gFolderTreeView._rowMap[row]._folder.isServer)) {
        bkgdcolor = accountColorsUtilities.bkgdColorPref(accountidkey);

        if (!(accountColorsAbout3Pane.prefs.getBoolPref("folder-defaultbkgd") && bkgdcolor == "#FFFFFF")) {
          props += " " + "ac-bc-" + bkgdcolor.substr(1, 6);
        }
      }

      /* Darker unfocused select bar */

      if (accountColorsAbout3Pane.prefs.getBoolPref("folder-darkerbar")) {
        props += " " + "ac-darkerbar";
      }

      return props;
    },

    getCellProperties: function(row, col) {
      var props, server, account, accountidkey;
      var fontcolor, fontstyle, fontsize;
      var bkgdcolor, red, green, blue, brightness;

      if (!!accountColorsAbout3Pane.folderPaneManager.originalGetCellProperties) {
        props = accountColorsAbout3Pane.folderPaneManager.originalGetCellProperties.call(gFolderTreeView, row, col); /* call original handler */
      } else {
        props = ""
      }

      if (accountColorsUtilities.thunderbirdVersion.major >= 102) {
        accountidkey = accountColorsUtilities.resolveAccountIdentityKeyForFolder(gFolderTreeView._rowMap[row]._folder);
      } else {
        server = gFolderTreeView._rowMap[row]._folder.server;
        account = accountColorsUtilities.findAccountForServer(server);

        if (account.defaultIdentity == null) accountidkey = account.key;
        else accountidkey = account.defaultIdentity.key;
      }

      /* add extra properties for not-hover, not-dragOn, not-selected */
      /* required to select tree element styles defined in accountcolors-messengerwindow[-generated].css */

      if (row != accountColorsAbout3Pane.hoverRow) {
        props += " " + "not-hover";
      }

      if (row != accountColorsAbout3Pane.dragOnRow) {
        props += " " + "not-dragOn";
      }

      if (!gFolderTreeView.selection.isSelected(row)) {
        props += " " + "not-selected";
      }

      if (col.id == "folderNameCol") {
        /* add extra properties for font color, font style, font size, folder font color, no bold on unread, and show tree lines */
        /* required to select tree element styles defined in accountcolors-messengerwindow[-generated].css */

        if (gFolderTreeView._rowMap[row]._folder.isServer) {
          /* account folder */
          /* Color account font */

          if (accountColorsAbout3Pane.prefs.getBoolPref("folder-colorfont")) {
            fontcolor = accountColorsUtilities.fontColorPref(accountidkey);
            props += " " + "ac-fc-" + fontcolor.substr(1, 6);
          }

          /* Account font style */

          if (accountColorsAbout3Pane.prefs.getBoolPref("folder-setfontstyle")) {
            fontstyle = accountColorsAbout3Pane.prefs.getIntPref("folder-fontstyle");

            switch (fontstyle) {
              case 0 /* Normal */:
                props += " " + "ac-fs-normal";
                break;
              case 1 /* Italic */:
                props += " " + "ac-fs-italic";
                break;
              case 2 /* Bold */:
                props += " " + "ac-fs-bold";
                break;
              case 3 /* Bold Italic */:
                props += " " + "ac-fs-bolditalic";
                break;
            }
          }

          /* Account font size */

          if (accountColorsAbout3Pane.prefs.getBoolPref("folder-setfontsize")) {
            if (accountColorsAbout3Pane.prefs.getBoolPref("folder-incspacing")) {
              fontsize = accountColorsAbout3Pane.prefs.getIntPref("folder-fontsize");
              props += " " + "ac-fs-" + fontsize + "-is";
            } else {
              fontsize = accountColorsAbout3Pane.prefs.getIntPref("folder-fontsize");
              props += " " + "ac-fs-" + fontsize;
            }
          }
        } /* sub-folder */ else {
          /* Color folder font */

          if (accountColorsAbout3Pane.prefs.getBoolPref("folder-colorfldfont")) {
            fontcolor = accountColorsUtilities.fontColorPref(accountidkey);
            props += " " + "ac-fc-" + fontcolor.substr(1, 6);
          }

          /* No bold on Folders with unread messages */

          if (accountColorsAbout3Pane.prefs.getBoolPref("folder-noboldunread")) {
            props += " " + "ac-noboldunread";
          }
        }

        /* Show tree lines */

        if ((accountColorsAbout3Pane.prefs.getBoolPref("folder-colorbkgd") && gFolderTreeView._rowMap[row]._folder.isServer) || (accountColorsAbout3Pane.prefs.getBoolPref("folder-colorfldbkgd") && !gFolderTreeView._rowMap[row]._folder.isServer)) {
          bkgdcolor = accountColorsUtilities.bkgdColorPref(accountidkey);

          if (!(accountColorsAbout3Pane.prefs.getBoolPref("folder-defaultbkgd") && bkgdcolor == "#FFFFFF")) {
            red = parseInt(bkgdcolor.substr(1, 2), 16);
            green = parseInt(bkgdcolor.substr(3, 2), 16);
            blue = parseInt(bkgdcolor.substr(5, 2), 16);

            brightness = 0.299 * red + 0.587 * green + 0.114 * blue;

            if (brightness >= 144) props += " " + "ac-blackline";
            else props += " " + "ac-whiteline";
          } else if (accountColorsAbout3Pane.prefs.getBoolPref("folder-lightpanebkgd")) {
            props += " " + "ac-blackline";
          } else if (accountColorsAbout3Pane.prefs.getBoolPref("folder-darkpanebkgd")) {
            props += " " + "ac-whiteline";
          }
        }
      } /* any other column */ else {
        /* add extra properties for font color */
        /* required to select tree element styles defined in accountcolors-messengerwindow[-generated].css */

        /* Color unread/total/size fonts */

        if (accountColorsAbout3Pane.prefs.getBoolPref("folder-colorother")) {
          fontcolor = accountColorsUtilities.fontColorPref(accountidkey);
          props += " " + "ac-fc-" + fontcolor.substr(1, 6);
        }
      }

      return props;
    },
  },

  folderPane: function () {
    accountColorsAbout3Pane_115.folderPane(); // Must ensure that accountColorsAbout3Pane_112 has all fields required by accountColorsAbout3Pane in referenced code
  },

  /* Thread Pane in Main Tab */

  threadPaneManager: {
    hoverRow: null,

    columnHandlers: new Map(),

    onLoad: function() {
      accountColorsAbout3Pane.obs.addObserver(this, "MsgCreateDBView", false);
      accountColorsAbout3Pane.folderTree.addEventListener("select", accountColorsAbout3Pane.threadPane, false);
      accountColorsAbout3Pane.threadTree.addEventListener("mousemove", accountColorsAbout3Pane.threadPaneManager.onMouseMove, false);
    },

    onUnload: function() {
      accountColorsAbout3Pane.folderTree.removeEventListener("select", accountColorsAbout3Pane.threadPane, false);
      accountColorsAbout3Pane.threadTree.removeEventListener("mousemove", accountColorsAbout3Pane.threadPaneManager.onMouseMove, false);

      accountColorsAbout3Pane.obs.removeObserver(this, "MsgCreateDBView");
      for (const [col, columnHandler] of this.columnHandlers.entries()) {
        gDBView.removeColumnHandler(col, columnHandler);
      }
    },

    onMouseMove: function (event) { /* Detect mouse hovering over row in folder or thread pane */
      accountColorsAbout3Pane.threadPaneManager.hoverRow = this.getRowAt(event.clientX, event.clientY);
    },

    observe: function (displayedFolder, topic, data) {
      if (topic != "MsgCreateDBView") return;

      // Register all columns
      for (const colId of gFolderDisplay.COLUMNS_MAP.keys()) {
        this.addColumnHandler(colId);
      }
      for (const colId of gFolderDisplay.COLUMNS_MAP_NOSORT.keys()) {
        this.addColumnHandler(colId);
      }
    },

    reload: function() {
      element = accountColorsAbout3Pane.threadTree; /* Force re-load of Thread Tree */
      element.invalidate();

      element = accountColorsAbout3Pane.threadTree; /* Causes CSS Thread Tree -moz-tree-row height change to take effect */
      element.style.visibility = "hidden";
      element.style.visibility = "";
    },

    addColumnHandler(colId) {
      var columnHandler = {
        /* Thread column Handler functions for nsITreeView called from nsMsgDBView.cpp */
        /* - for getRowProperties: m_customColumnHandlers[i]->GetRowProperties(index,extra) */
        /* - for other functions: colHandler->getCellProperties(row,col,properties) */

        getRowProperties: function (row) {
          var props, msgHdr, accountkey, account, accountidkey, folder, server;
          var bkgdcolor;

          props = " ";

          msgHdr = gDBView.getMsgHdrAt(row);

          if (accountColorsUtilities.thunderbirdVersion.major >= 102) {
            accountColorsUtilities.resolveAccountIdentityKeyForMessage(msgHdr, accountColorsAbout3Pane.prefs.getBoolPref("thread-hdraccount"));
          } else {
            /* Color based on received account */

            if (accountColorsAbout3Pane.prefs.getBoolPref("thread-hdraccount")) {
              /* color using account in message header */
              accountkey = accountColorsUtilities.getAccountKey(msgHdr); /* null string if sent message */
              account = accountColorsAbout3Pane.accountManager.getAccount(accountkey);

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

          /* add extra properties for not-hover, not-selected, not-focused, background color, show row stripes, darker selection bar */
          /* required to select tree element styles defined in accountcolors-messengerwindow[-generated].css */

          if (row != accountColorsAbout3Pane.hoverRow) {
            props += " " + "not-hover";
          }

          if (!gDBView.selection.isSelected(row)) {
            props += " " + "not-selected";
          }

          if (!accountColorsAbout3Pane.threadTree.focused) {
            props += " " + "not-focused";
          }

          /* Color row background */

          if (accountColorsAbout3Pane.prefs.getBoolPref("thread-colorbkgd")) {
            bkgdcolor = accountColorsUtilities.bkgdColorPref(accountidkey);
            props += " " + "ac-bc-" + bkgdcolor.substr(1, 6);
          }

          /* Show row stripes */

          if (accountColorsAbout3Pane.prefs.getBoolPref("thread-showstripes")) {
            props += " " + "ac-showstripes";
          }

          /* Darker unfocused select bar */

          if (accountColorsAbout3Pane.prefs.getBoolPref("thread-darkerbar")) {
            props += " " + "ac-darkerbar";
          }

          return props;
        },

        getCellProperties: function (row, col) {
          var props, msgHdr, accountkey, account, accountidkey, folder, server, value;
          var fontcolor, fontstyle, fontsize, fromcolor, fromstyle, fromsize;

          props = " ";

          msgHdr = gDBView.getMsgHdrAt(row);

          if (accountColorsUtilities.thunderbirdVersion.major >= 102) {
            accountColorsUtilities.resolveAccountIdentityKeyForMessage(msgHdr, accountColorsAbout3Pane.prefs.getBoolPref("thread-hdraccount"));
          } else {
            /* Color based on received account */

            if (accountColorsAbout3Pane.prefs.getBoolPref("thread-hdraccount")) {
              /* color using account in message header */
              accountkey = accountColorsUtilities.getAccountKey(msgHdr); /* null string if sent message */
              account = accountColorsAbout3Pane.accountManager.getAccount(accountkey);

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

          /* add extra properties for not-hover and not-selected */
          /* required to select tree element styles defined in accountcolors-messengerwindow[-generated].css */

          if (row != accountColorsAbout3Pane.hoverRow) {
            props += " " + "not-hover";
          }

          if (!gDBView.selection.isSelected(row)) {
            props += " " + "not-selected";
          }

          if (col.id == "subjectCol") {
            /* add extra properties for font color, font style, font size and bold subject */
            /* required to select tree element styles defined in accountcolors-messengerwindow[-generated].css */

            /* Color subject font */

            if (accountColorsAbout3Pane.prefs.getBoolPref("thread-colorfont")) {
              fontcolor = accountColorsUtilities.fontColorPref(accountidkey);
              props += " " + "ac-fc-" + fontcolor.substr(1, 6);
            }

            /* Subject font style */

            if (accountColorsAbout3Pane.prefs.getBoolPref("thread-setfontstyle")) {
              fontstyle = accountColorsAbout3Pane.prefs.getIntPref("thread-fontstyle");

              switch (fontstyle) {
                case 0 /* Normal */:
                  props += " " + "ac-fs-normal";
                  break;
                case 1 /* Italic */:
                  props += " " + "ac-fs-italic";
                  break;
                case 2 /* Bold */:
                  props += " " + "ac-fs-bold";
                  break;
                case 3 /* Bold Italic */:
                  props += " " + "ac-fs-bolditalic";
                  break;
              }
            }

            /* Subject font size */

            if (accountColorsAbout3Pane.prefs.getBoolPref("thread-setfontsize")) {
              if (accountColorsAbout3Pane.prefs.getBoolPref("thread-incspacing")) {
                fontsize = accountColorsAbout3Pane.prefs.getIntPref("thread-fontsize");
                props += " " + "ac-fs-" + fontsize + "-is";
              } else {
                fontsize = accountColorsAbout3Pane.prefs.getIntPref("thread-fontsize");
                props += " " + "ac-fs-" + fontsize;
              }
            }

            /* Bold Subject on unread messages */

            if (accountColorsAbout3Pane.prefs.getBoolPref("thread-boldsubject")) {
              props += " " + "ac-boldsubject";
            }
          } else if (col.id == "senderCol") {
            /* add extra properties for from color, from style, from size and bold */
            /* required to select tree element styles defined in accountcolors-messengerwindow[-generated].css */

            /* Color from font */

            if (accountColorsAbout3Pane.prefs.getBoolPref("thread-colorfrom")) {
              fromcolor = accountColorsUtilities.fontColorPref(accountidkey);
              props += " " + "ac-fc-" + fromcolor.substr(1, 6);
            }

            /* From font style */

            if (accountColorsAbout3Pane.prefs.getBoolPref("thread-setfromstyle")) {
              fromstyle = accountColorsAbout3Pane.prefs.getIntPref("thread-fromstyle");

              switch (fromstyle) {
                case 0 /* Normal */:
                  props += " " + "ac-fs-normal";
                  break;
                case 1 /* Italic */:
                  props += " " + "ac-fs-italic";
                  break;
                case 2 /* Bold */:
                  props += " " + "ac-fs-bold";
                  break;
                case 3 /* Bold Italic */:
                  props += " " + "ac-fs-bolditalic";
                  break;
              }
            }

            /* From font size */

            if (accountColorsAbout3Pane.prefs.getBoolPref("thread-setfromsize")) {
              if (accountColorsAbout3Pane.prefs.getBoolPref("thread-incspacing")) {
                fromsize = accountColorsAbout3Pane.prefs.getIntPref("thread-fromsize");
                props += " " + "ac-fs-" + fromsize + "-is";
              } else {
                fromsize = accountColorsAbout3Pane.prefs.getIntPref("thread-fromsize");
                props += " " + "ac-fs-" + fromsize;
              }
            }

            /* Bold from on unread messages */

            if (accountColorsAbout3Pane.prefs.getBoolPref("thread-boldfrom")) {
              props += " " + "ac-boldfrom";
            }
          } else if (col.id == "correspondentCol") {
            /* add extra properties for recipient/date/size/account/etc (other) color */
            /* required to select tree element styles defined in accountcolors-messengerwindow[-generated].css */

            /* Get outgoing and incoming properties - which are set in nsMsgDBView.cpp only if there is no custom column handler */
            value = accountColorsAbout3Pane.hdr.parseDecodedHeader(msgHdr.mime2DecodedAuthor)[0].email;
            if (accountColorsAbout3Pane.accountManager.allIdentities.some(id => id.email.toLowerCase() == value.toLowerCase())) {
              props += " " + "outgoing";
            } else {
              props += " " + "incoming";
            }

            /* Color recipient/date/size/account/etc fonts */

            if (accountColorsAbout3Pane.prefs.getBoolPref("thread-colorother")) {
              fontcolor = accountColorsUtilities.fontColorPref(accountidkey);
              props += " " + "ac-fc-" + fontcolor.substr(1, 6);
            }
          } /* any other column */ else {
            /* add extra properties for recipient/date/size/account/etc (other) color */
            /* required to select tree element styles defined in accountcolors-messengerwindow[-generated].css */

            /* Color recipient/date/size/account/etc fonts */

            if (accountColorsAbout3Pane.prefs.getBoolPref("thread-colorother")) {
              fontcolor = accountColorsUtilities.fontColorPref(accountidkey);
              props += " " + "ac-fc-" + fontcolor.substr(1, 6);
            }
          }

          return props;
        },

        getCellText: function (row, col) {
          var value, msgHdr, accountkey, account;

          value = gDBView.cellTextForColumn(row, col.id); /* original handler called */

          /* Color based on received account */

          if (accountColorsAbout3Pane.prefs.getBoolPref("thread-hdraccount")) {
            /* color using account in message header */
            if (col.id == "accountCol") {
              msgHdr = gDBView.getMsgHdrAt(row);

              accountkey = accountColorsUtilities.getAccountKey(msgHdr);
              account = accountColorsAbout3Pane.accountManager.getAccount(accountkey);

              if (account != null) value = account.incomingServer.prettyName;
            }
          }

          return value;
        },

        getImageSrc: function (row, col) {
          return ""; /* original handler always returns null string */
        },

        cycleCell: function (row, col) {
          if (["unreadButtonColHeader", "threadCol", "tagsCol", "flaggedCol", "junkStatusCol"].includes(col.id)) { /* original handler only called for these columns */
            var value;

            gDBView.removeColumnHandler(col.id);
            value = gDBView.cycleCell(row, col); /* original handler called */
            gDBView.addColumnHandler(col.id, this);

            return value;
          }
        },

        isEditable: function (row, col) {
          return false; /* original handler always returns false */
        },

        /* Functions for nsIMsgCustomColumnHandler */

        getSortStringForRow: function (hdr) {
          return ""; /* custom handler not called for standard columns */
        },

        getSortLongForRow: function (hdr) {
          return 0; /* custom handler not called for standard columns */
        },

        isString: function () {
          return true;  /* custom handler not called for standard columns */
        },
      }

      /* Only add getRowProperties for subjectCol, as gDBView will try to call all column handlers for this function */

      if (colId != "subjectCol") {
        delete columnHandler.getRowProperties;
      }

      gDBView.addColumnHandler(colId, columnHandler);

      this.columnHandlers.set(colId, columnHandler);
    },
  },

  threadPane: function () {
    accountColorsAbout3Pane_115.threadPane(); // Must ensure that accountColorsAbout3Pane_112 has all fields required by accountColorsAbout3Pane in referenced code
  },

  /* Message Pane in Main Tab */

  messagePaneManager: {
    onLoad: function () {
      document.getElementById("tabmail").addEventListener("load", accountColorsAbout3Pane.messagePane, true);
    },

    onUnload: function () {
      document.getElementById("tabmail").removeEventListener("load", accountColorsAbout3Pane.messagePane, true);
    },

    reload: function() {},
  },

  messagePane: function(event, clear) {
    accountColorsAbout3Pane_115.messagePane(event, clear); // Must ensure that accountColorsAbout3Pane_112 has all fields required by accountColorsAbout3Pane in referenced code
  },
};

var accountColorsAbout3Pane_115 = {
  prefs: Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("extensions.accountcolors."),

  folderLookup: Components.classes["@mozilla.org/mail/folder-lookup;1"].getService(Components.interfaces.nsIFolderLookupService),

  accountManager: Components.classes["@mozilla.org/messenger/account-manager;1"].getService(Components.interfaces.nsIMsgAccountManager),

  folderTree: window.folderTree || document.getElementById("folderTree"),

  threadTree: window.threadTree || document.getElementById("threadTree"),

  /* Listen for changes to account colors settings */

  prefsObserver: {
    register: function () {
      /* Add the observer */
      this.registered = true;
      accountColorsAbout3Pane.prefs.addObserver("", this, false);
    },

    unregister: function () {
      if (!this.registered) return;

      accountColorsAbout3Pane.prefs.removeObserver("", this);
    },

    observe: function (subject, topic, data) {
      if (topic != "nsPref:changed") return;

      /* Update Folder Pane */

      accountColorsAbout3Pane.folderPane();
      accountColorsAbout3Pane.folderPaneManager.reload();

      /* Update Thread Pane */

      accountColorsAbout3Pane.threadPane();
      accountColorsAbout3Pane.threadPaneManager.reload();

      /* Update Message Window (Stub call, actually noop) */

      accountColorsAbout3Pane.messagePane();
      accountColorsAbout3Pane.messagePaneManager.reload();
    },
  },

  onUnload: function() {
    accountColorsAbout3Pane.folderPaneManager.onUnload();
    accountColorsAbout3Pane.threadPaneManager.onUnload();
    accountColorsAbout3Pane.messagePaneManager.onUnload();

    accountColorsAbout3Pane.prefsObserver.unregister();
  },

  onLoad: function () {
    accountColorsAbout3Pane.prefsObserver.register();

    /* Folder Pane */

    customElements.whenDefined("folder-tree-row").then(() => {
      accountColorsAbout3Pane.folderPaneManager.onLoad();
      accountColorsAbout3Pane.folderPane();
      accountColorsAbout3Pane.folderPaneManager.reload();
    });

    /* Thread Pane */

    Promise.all([customElements.whenDefined("thread-row"), customElements.whenDefined("thread-card")]).then(() => {
      accountColorsAbout3Pane.threadPaneManager.onLoad();
      accountColorsAbout3Pane.threadPane();
      accountColorsAbout3Pane.threadPaneManager.reload();
    });

    /* Message Pane (Stub call, handled in about:message and is actually noop) */

    accountColorsAbout3Pane.messagePaneManager.onLoad();
    accountColorsAbout3Pane.messagePane();
    accountColorsAbout3Pane.messagePaneManager.reload();
  },

  folderPaneManager: {
    originalSetFolderPropertiesFromFolder: null,

    onUnload: function() {
      var classFolderTreeRow = customElements.get("folder-tree-row");

      if (accountColorsAbout3Pane.folderPaneManager.originalSetFolderPropertiesFromFolder) {
        classFolderTreeRow.prototype.setFolderPropertiesFromFolder = accountColorsAbout3Pane.folderPaneManager.originalSetFolderPropertiesFromFolder;
        delete accountColorsAbout3Pane.folderPaneManager.originalSetFolderPropertiesFromFolder;
      }
    },

    onLoad: function() {
      var classFolderTreeRow = customElements.get("folder-tree-row");


      /* Detour FolderTreeRow.prototype.setFolderPropertiesFromFolder */

      if (!accountColorsAbout3Pane.folderPaneManager.originalSetFolderPropertiesFromFolder) {
        accountColorsAbout3Pane.folderPaneManager.originalSetFolderPropertiesFromFolder = classFolderTreeRow.setFolderPropertiesFromFolder;
        classFolderTreeRow.prototype.setFolderPropertiesFromFolder = accountColorsAbout3Pane.folderPaneManager.setFolderPropertiesFromFolder;
      }
    },

    reload: function() {
      var classFolderTreeRow = customElements.get("folder-tree-row");
      var row;

      /* Reapply setFolderPropertiesFromFolder to all folder tree rows */

      for (row of accountColorsAbout3Pane.folderTree.querySelectorAll("li")) {
        if (!(row instanceof classFolderTreeRow)) {
          continue;
        }
        row.setFolderPropertiesFromFolder(accountColorsAbout3Pane.folderLookup.getFolderForURL(row.uri));
      }
    },

    /* Detour FolderTreeRow.prototype.setFolderPropertiesFromFolder */

    setFolderPropertiesFromFolder: function(folder) {
      var accountidkey;
      var fontcolor, bkgdcolor, fontstyle, fontsize;

      /* Call original function */

      if (accountColorsAbout3Pane.folderPaneManager.originalSetFolderPropertiesFromFolder) {
        accountColorsAbout3Pane.folderPaneManager.originalSetFolderPropertiesFromFolder.call(this, folder);
      }

      /* Set some element fields on FolderTreeView object for modifying properties */
      if (!this.container) {
        this.container = this.querySelector(".container");
      }

      accountidkey = accountColorsUtilities.resolveAccountIdentityKeyForFolder(folder);

      /* Regard account folders in Unified Folders (Inbox/Drafts/etc.) as accounts */

      var parentElement = this.parentNode && this.parentNode.closest('li[is="folder-tree-row"]');
      var inUnifiedFolder = !!parentElement && parentElement.uri.startsWith("mailbox://nobody@smart%20mailboxes");

      /* Color account/folders font */

      if ((accountColorsAbout3Pane.prefs.getBoolPref("folder-colorfont") && (folder.isServer || inUnifiedFolder)) ||
          (accountColorsAbout3Pane.prefs.getBoolPref("folder-colorfldfont") && !folder.isServer)) {
        fontcolor = accountColorsUtilities.fontColorPref(accountidkey);
        this.nameLabel.style.setProperty("--ac-font-color", fontcolor);
      } else {
        this.nameLabel.style.removeProperty("--ac-font-color");
      }

      /* Render background color as icon color */

      var colorBkgdAsIcon = accountColorsAbout3Pane.prefs.getBoolPref("folder-colorbkgd-account-icon") && (folder.isServer || inUnifiedFolder) ||
                            accountColorsAbout3Pane.prefs.getBoolPref("folder-colorbkgd-folder-icon") && !folder.isServer;

      /* Color account/folders background */

      if ((accountColorsAbout3Pane.prefs.getBoolPref("folder-colorbkgd") && (folder.isServer || inUnifiedFolder)) ||
          (accountColorsAbout3Pane.prefs.getBoolPref("folder-colorfldbkgd") && !folder.isServer)) {
        bkgdcolor = accountColorsUtilities.bkgdColorPref(accountidkey);

        if (!colorBkgdAsIcon) {
          if (!(accountColorsAbout3Pane.prefs.getBoolPref("folder-defaultbkgd") && bkgdcolor == "")) {
            this.container.style.setProperty("--ac-bkgd-color", bkgdcolor);
          }
          this.setIconColor(); // Restore default icon
        } else {
          if (!this.icon.style.getPropertyValue("--icon-color")) {
            this.setIconColor(bkgdcolor);
          }
          this.container.style.removeProperty("--ac-bkgd-color");
        }
      } else {
        this.container.style.removeProperty("--ac-bkgd-color");
        this.setIconColor(); // Restore default icon
      }

      /* Color unread/total/size font */

      if (accountColorsAbout3Pane.prefs.getBoolPref("folder-colorother")) {
        fontcolor = accountColorsUtilities.fontColorPref(accountidkey);
        this.unreadCountLabel.style.setProperty("--ac-font-color", fontcolor);
        this.totalCountLabel.style.setProperty("--ac-font-color", fontcolor);
        this.folderSizeLabel.style.setProperty("--ac-font-color", fontcolor);
      } else {
        this.unreadCountLabel.style.removeProperty("--ac-font-color");
        this.totalCountLabel.style.removeProperty("--ac-font-color");
        this.folderSizeLabel.style.removeProperty("--ac-font-color");
      }

      /* Color unread/total/size background */

      if (accountColorsAbout3Pane.prefs.getBoolPref("folder-colorotherbkgd")) {
        bkgdcolor = accountColorsUtilities.bkgdColorPref(accountidkey);
        this.unreadCountLabel.style.setProperty("--ac-badge-bkgd-color", bkgdcolor);
        this.totalCountLabel.style.setProperty("--ac-badge-bkgd-color", bkgdcolor);
        this.folderSizeLabel.style.setProperty("--ac-badge-bkgd-color", bkgdcolor);
      } else {
        this.unreadCountLabel.style.removeProperty("--ac-badge-bkgd-color");
        this.totalCountLabel.style.removeProperty("--ac-badge-bkgd-color");
        this.folderSizeLabel.style.removeProperty("--ac-badge-bkgd-color");
      }

      /* Account font style */

      if (accountColorsAbout3Pane.prefs.getBoolPref("folder-setfontstyle") && (folder.isServer || inUnifiedFolder)) {
        fontstyle = accountColorsAbout3Pane.prefs.getIntPref("folder-fontstyle");
        this.nameLabel.setAttribute("ac-fsw", ["normal", "italic", "bold", "bolditalic"][fontstyle]);
      } else {
        this.nameLabel.removeAttribute("ac-fsw");
      }

      /* Account font size */

      if (accountColorsAbout3Pane.prefs.getBoolPref("folder-setfontsize") && (folder.isServer || inUnifiedFolder)) {
        fontsize = accountColorsAbout3Pane.prefs.getIntPref("folder-fontsize");
        // ac-fs have margin-top attribute set, we use it instead of font-size style
        if (accountColorsAbout3Pane.prefs.getBoolPref("folder-incspacing")) {
          this.nameLabel.setAttribute("ac-fs", fontsize + "-is");
        } else {
          this.nameLabel.setAttribute("ac-fs", fontsize);
        }
      } else {
        this.nameLabel.removeAttribute("ac-fs");
      }

      /* No bold on Folders with unread messages */

      if (accountColorsAbout3Pane.prefs.getBoolPref("folder-noboldunread") && !folder.isServer) {
        this.nameLabel.setAttribute("ac-noboldunread", "");
      } else {
        this.nameLabel.removeAttribute("ac-noboldunread");
      }
    },
  },

  folderPane() {
    var element, fontsize;

    /* Color background as gradient */

    if (accountColorsAbout3Pane.prefs.getBoolPref("folder-colorbkgd-gradient")) {
      element = accountColorsAbout3Pane.folderTree;
      element.setAttribute("ac-bkgdasgradient", "");
    } else {
      element = accountColorsAbout3Pane.folderTree;
      element.removeAttribute("ac-bkgdasgradient");
    }

    /* Black/White row fonts */

    if (accountColorsAbout3Pane.prefs.getBoolPref("folder-blackrowfont")) {
      element = accountColorsAbout3Pane.folderTree;
      element.setAttribute("ac-blackrowfont", "");
      element.removeAttribute("ac-whiterowfont");
    } else if (accountColorsAbout3Pane.prefs.getBoolPref("folder-whiterowfont")) {
      element = accountColorsAbout3Pane.folderTree;
      element.removeAttribute("ac-blackrowfont");
      element.setAttribute("ac-whiterowfont", "");
    } else {
      element = accountColorsAbout3Pane.folderTree;
      element.removeAttribute("ac-blackrowfont");
      element.removeAttribute("ac-whiterowfont");
    }

    /* Light/Dark pane background */

    if (accountColorsAbout3Pane.prefs.getBoolPref("folder-lightpanebkgd")) {
      element = accountColorsUtilities.thunderbirdVersion.major > 102 ? document.getElementById("folderPane") : accountColorsAbout3Pane.folderTree;
      element.setAttribute("ac-lightpanebkgd", "");
      element.removeAttribute("ac-darkpanebkgd");
    } else if (accountColorsAbout3Pane.prefs.getBoolPref("folder-darkpanebkgd")) {
      element = accountColorsUtilities.thunderbirdVersion.major > 102 ? document.getElementById("folderPane") : accountColorsAbout3Pane.folderTree;
      element.removeAttribute("ac-lightpanebkgd");
      element.setAttribute("ac-darkpanebkgd", "");
    } else {
      element = accountColorsUtilities.thunderbirdVersion.major > 102 ? document.getElementById("folderPane") : accountColorsAbout3Pane.folderTree;
      element.removeAttribute("ac-lightpanebkgd");
      element.removeAttribute("ac-darkpanebkgd");
    }

    /* Bold on accounts/folders with new mail */

    if (accountColorsAbout3Pane.prefs.getBoolPref("folder-boldnewmail")) {
      element = accountColorsAbout3Pane.folderTree;
      element.setAttribute("ac-boldnewmail", "");
    } else {
      element = accountColorsAbout3Pane.folderTree;
      element.removeAttribute("ac-boldnewmail");
    }

    /* Underline on accounts/folders with new mail */

    if (accountColorsAbout3Pane.prefs.getBoolPref("folder-undernewmail")) {
      element = accountColorsAbout3Pane.folderTree;
      element.setAttribute("ac-undernewmail", "");
    } else {
      element = accountColorsAbout3Pane.folderTree;
      element.removeAttribute("ac-undernewmail");
    }

    /* Show tree lines */

    if (accountColorsAbout3Pane.prefs.getBoolPref("folder-showlines")) {
      element = accountColorsAbout3Pane.folderTree;
      element.setAttribute("ac-showlines", "");
    } else {
      element = accountColorsAbout3Pane.folderTree;
      element.removeAttribute("ac-showlines");
    }

    /* Increase row spacing based on account font size */

    if (accountColorsAbout3Pane.prefs.getBoolPref("folder-incspacing")) {
      fontsize = accountColorsAbout3Pane.prefs.getIntPref("folder-fontsize");
      element = accountColorsAbout3Pane.folderTree;
      element.setAttribute("ac-is", fontsize);
    } else {
      element = accountColorsAbout3Pane.folderTree;
      element.removeAttribute("ac-is");
    }

    /* Reinstate default hover and select styles */

    if (accountColorsAbout3Pane.prefs.getBoolPref("folder-hoverselect")) {
      element = accountColorsAbout3Pane.folderTree;
      element.setAttribute("ac-hoverselect", "");
    } else {
      element = accountColorsAbout3Pane.folderTree;
      element.removeAttribute("ac-hoverselect");
    }
  },

  threadPaneManager: {
    originalUpdateThreadRow: null,

    originalUpdateThreadCard: null,

    onUnload: function() {
      var classThreadRow = customElements.get("thread-row");
      var classThreadCard = customElements.get("thread-card");

      if (accountColorsAbout3Pane.threadPaneManager.originalUpdateThreadRow) {
        if (classThreadRow.prototype._fillRow) {
          classThreadRow.prototype._fillRow = accountColorsAbout3Pane.threadPaneManager.originalUpdateThreadRow;
        } else {
          Object.defineProperty(classThreadRow.prototype, "index", { set: accountColorsAbout3Pane.threadPaneManager.originalUpdateThreadRow });
        }
        delete accountColorsAbout3Pane.threadPaneManager.originalUpdateThreadRow;
      }

      if (accountColorsAbout3Pane.threadPaneManager.originalUpdateThreadCard) {
        if (classThreadCard.prototype._fillRow) {
          classThreadCard.prototype._fillRow = accountColorsAbout3Pane.threadPaneManager.originalUpdateThreadCard;
        } else {
          Object.defineProperty(classThreadCard.prototype, "index", { set: accountColorsAbout3Pane.threadPaneManager.originalUpdateThreadCard });
        }
        delete accountColorsAbout3Pane.threadPaneManager.originalUpdateThreadCard;
      }
    },

    onLoad: function() {
      var classThreadRow = customElements.get("thread-row");
      var classThreadCard = customElements.get("thread-card");

      /* Detour ThreadRow.prototype.index setter */

      if (!accountColorsAbout3Pane.threadPaneManager.originalUpdateThreadRow) {
        if (classThreadRow.prototype._fillRow) { // Introduced after releases-comm-central commit f1f5234eb1438002b42bf51c8ec20ecd95e3ec97
          accountColorsAbout3Pane.threadPaneManager.originalUpdateThreadRow = classThreadRow.prototype._fillRow;
          classThreadRow.prototype._fillRow = accountColorsAbout3Pane.threadPaneManager.threadRowFillRow;
        } else if (classThreadRow.prototype.hasOwnProperty("index")) {
          accountColorsAbout3Pane.threadPaneManager.originalUpdateThreadRow = Object.getOwnPropertyDescriptor(classThreadRow.prototype, "index").set;
          Object.defineProperty(classThreadRow.prototype, "index", { set: accountColorsAbout3Pane.threadPaneManager.threadRowIndexSetter });
        }
      }

      /* Detour ThreadCard.prototype.index setter */

      if (!accountColorsAbout3Pane.threadPaneManager.originalUpdateThreadCard) {
        if (classThreadCard.prototype._fillRow) { // Introduced after releases-comm-central commit f1f5234eb1438002b42bf51c8ec20ecd95e3ec97
          accountColorsAbout3Pane.threadPaneManager.originalUpdateThreadCard = classThreadCard.prototype._fillRow;
          classThreadCard.prototype._fillRow = accountColorsAbout3Pane.threadPaneManager.threadCardFillRow;
        } else if (classThreadCard.prototype.hasOwnProperty("index")) {
          accountColorsAbout3Pane.threadPaneManager.originalUpdateThreadCard = Object.getOwnPropertyDescriptor(classThreadCard.prototype, "index").set;
          Object.defineProperty(classThreadCard.prototype, "index", { set: accountColorsAbout3Pane.threadPaneManager.threadCardIndexSetter });
        }
      }
    },

    reload: function() {
      accountColorsAbout3Pane.threadTree.reset();
    },

    /* Detour ThreadRow.prototype._fillRow */

    threadRowFillRow: function() {
      /* Call original function */

      if (accountColorsAbout3Pane.threadPaneManager.originalUpdateThreadRow) {
        accountColorsAbout3Pane.threadPaneManager.originalUpdateThreadRow.call(this);
      }

      /* Call accountcolors addon's updateThreadRow function */

      accountColorsAbout3Pane.threadPaneManager.updateThreadRow.call(this, this._index)
    },

    /* Detour ThreadCard.prototype._fillRow */

    threadCardFillRow: function() {
      /* Call original function */

      if (accountColorsAbout3Pane.threadPaneManager.originalUpdateThreadCard) {
        accountColorsAbout3Pane.threadPaneManager.originalUpdateThreadCard.call(this);
      }

      /* Call accountcolors addon's updateThreadCard function */

      accountColorsAbout3Pane.threadPaneManager.updateThreadCard.call(this, this._index);
    },

    /* Detour ThreadRow.prototype.index setter */

    threadRowIndexSetter: function(row) {
      /* Call original function */

      if (accountColorsAbout3Pane.threadPaneManager.originalUpdateThreadRow) {
        accountColorsAbout3Pane.threadPaneManager.originalUpdateThreadRow.call(this, row);
      }

      /* Call accountcolors addon's updateThreadRow function */

      accountColorsAbout3Pane.threadPaneManager.updateThreadRow.call(this, row);
    },

    /* Detour ThreadCard.prototype.index setter */

    threadCardIndexSetter: function(row) {
      /* Call original function */

      if (accountColorsAbout3Pane.threadPaneManager.originalUpdateThreadCard) {
        accountColorsAbout3Pane.threadPaneManager.originalUpdateThreadCard.call(this, row);
      }

      /* Call accountcolors addon's updateThreadCard function */

      accountColorsAbout3Pane.threadPaneManager.updateThreadCard.call(this, row);
    },

    /* Update thread row with accountcolor's */

    updateThreadRow: function(row) {
      var msgHdr, account, accountidkey, element;
      var fontcolor, bkgdcolor, fontstyle, fontsize;
      var coloringDisabled = false;
      var nonHiddenColumnFound = false;

      msgHdr = gDBView.getMsgHdrAt(row);
      accountidkey = accountColorsUtilities.resolveAccountIdentityKeyForMessage(msgHdr, accountColorsAbout3Pane.prefs.getBoolPref("thread-hdraccount"));

      /* Enable coloring only in Unified folder if specified */

      if (accountColorsAbout3Pane.prefs.getBoolPref("thread-color-unified-only")) {
        coloringDisabled = !!window.gFolder && window.gFolder.server.hostName != "smart mailboxes";
      }

      /* Set row properties */

      /* Color row background */

      if (accountColorsAbout3Pane.prefs.getBoolPref("thread-colorbkgd") && !coloringDisabled) {
        bkgdcolor = accountColorsUtilities.bkgdColorPref(accountidkey);
        this.style.setProperty("--ac-bkgd-color", bkgdcolor);
      } else {
        this.style.removeProperty("--ac-bkgd-color");
      }

      /* Set column properties */

      for (const column of window.threadPane.columns) {
        if (column.hidden) {
          continue;
        }

        /* Set some element fields on ThreadRow object for modifying properties */
        element = this.querySelector("." + column.id.toLowerCase() + "-column");

        if (!nonHiddenColumnFound) {
          element.classList.add("ac-first-non-hidden-column");
          nonHiddenColumnFound = true;
        }

        if (column.id == "subjectCol") {
          /* Color subject font */

          if (accountColorsAbout3Pane.prefs.getBoolPref("thread-colorfont") && !coloringDisabled) {
            fontcolor = accountColorsUtilities.fontColorPref(accountidkey);
            element.style.setProperty("--ac-font-color", fontcolor);
          } else {
            element.style.removeProperty("--ac-font-color");
          }

          /* Subject font style */

          if (accountColorsAbout3Pane.prefs.getBoolPref("thread-setfontstyle")) {
            fontstyle = accountColorsAbout3Pane.prefs.getIntPref("thread-fontstyle");
            element.setAttribute("ac-fsw", ["normal", "italic", "bold", "bolditalic"][fontstyle]);
          } else {
            element.removeAttribute("ac-fsw");
          }

          /* Subject font size */

          if (accountColorsAbout3Pane.prefs.getBoolPref("thread-setfontsize")) {
            fontsize = accountColorsAbout3Pane.prefs.getIntPref("thread-fontsize");
            // ac-fs have margin-top attribute set, we use it instead of font-size style
            if (accountColorsAbout3Pane.prefs.getBoolPref("thread-incspacing")) {
              element.setAttribute("ac-fs", fontsize + "-is");
            } else {
              element.setAttribute("ac-fs", fontsize);
            }
          } else {
            element.removeAttribute("ac-fs");
          }

          /* Bold Subject on unread messages */

          if (accountColorsAbout3Pane.prefs.getBoolPref("thread-boldsubject")) {
            element.setAttribute("ac-boldsubject", "");
          } else {
            element.removeAttribute("ac-boldsubject");
          }

          continue;
        }

        if (column.id == "senderCol") {
          /* Color from font */

          if (accountColorsAbout3Pane.prefs.getBoolPref("thread-colorfrom") && !coloringDisabled) {
            fontcolor = accountColorsUtilities.fontColorPref(accountidkey);
            element.style.setProperty("--ac-font-color", fontcolor);
          } else {
            element.style.removeProperty("--ac-font-color");
          }

          /* From font style */

          if (accountColorsAbout3Pane.prefs.getBoolPref("thread-setfromstyle")) {
            fontstyle = accountColorsAbout3Pane.prefs.getIntPref("thread-fromstyle");
            element.setAttribute("ac-fsw", ["normal", "italic", "bold", "bolditalic"][fontstyle]);
          } else {
            element.removeAttribute("ac-fsw");
          }

          /* From font size */

          if (accountColorsAbout3Pane.prefs.getBoolPref("thread-setfromsize")) {
            fontsize = accountColorsAbout3Pane.prefs.getIntPref("thread-fromsize");
            // ac-fs have margin-top attribute set, we use it instead of font-size style
            if (accountColorsAbout3Pane.prefs.getBoolPref("thread-incspacing")) {
              element.setAttribute("ac-fs", fontsize + "-is");
            } else {
              element.setAttribute("ac-fs", fontsize);
            }
          } else {
            element.removeAttribute("ac-fs");
          }

          /* Bold from on unread messages */

          if (accountColorsAbout3Pane.prefs.getBoolPref("thread-boldfrom")) {
            element.setAttribute("ac-boldfrom", "");
          } else {
            element.removeAttribute("ac-boldfrom");
          }

          continue;
        }

        if (column.id == "correspondentCol") {
          /* Color recipient/date/size/account/etc fonts */

          if (accountColorsAbout3Pane.prefs.getBoolPref("thread-colorother") && !coloringDisabled) {
            fontcolor = accountColorsUtilities.fontColorPref(accountidkey);
            element.style.setProperty("--ac-font-color", fontcolor);
          } else {
            element.style.removeProperty("--ac-font-color");
          }

          continue;
        }

        if (column.id == "accountCol") {
          /* Color recipient/date/size/account/etc fonts */

          if (accountColorsAbout3Pane.prefs.getBoolPref("thread-colorother") && !coloringDisabled) {
            fontcolor = accountColorsUtilities.fontColorPref(accountidkey);
            element.style.setProperty("--ac-font-color", fontcolor);
          } else {
            element.style.removeProperty("--ac-font-color");
          }

          /* Color using account in message header */

          if (accountColorsAbout3Pane.prefs.getBoolPref("thread-hdraccount") && account != null) {
            element.textContent = account.incomingServer.prettyName;
          }

          continue;
        }

        /* any other column */

        /* Color recipient/date/size/account/etc fonts */

        if (accountColorsAbout3Pane.prefs.getBoolPref("thread-colorother") && !coloringDisabled) {
          fontcolor = accountColorsUtilities.fontColorPref(accountidkey);
          element.style.setProperty("--ac-font-color", fontcolor);
        } else {
          element.style.removeProperty("--ac-font-color");
        }
      }
    },

    updateThreadCard: function(row) {
      var msgHdr, accountidkey, element;
      var fontcolor, bkgdcolor, fontstyle, fontsize;
      var coloringDisabled = false;

      msgHdr = gDBView.getMsgHdrAt(row);
      accountidkey = accountColorsUtilities.resolveAccountIdentityKeyForMessage(msgHdr, accountColorsAbout3Pane.prefs.getBoolPref("thread-hdraccount"));

      /* Enable coloring only in Unified folder if specified */

      if (accountColorsAbout3Pane.prefs.getBoolPref("thread-color-unified-only")) {
        coloringDisabled = !!window.gFolder && window.gFolder.server.hostName != "smart mailboxes";
      }

      /* Set card properties */

      /* Color card background */

      if (accountColorsAbout3Pane.prefs.getBoolPref("thread-colorbkgd") && !coloringDisabled) {
        bkgdcolor = accountColorsUtilities.bkgdColorPref(accountidkey);
        this.style.setProperty("--ac-bkgd-color", bkgdcolor);
      } else {
        this.style.removeProperty("--ac-bkgd-color");
      }

      for (const column of window.threadPane.cardColumns) {
        if (column == "subjectCol") {
          element = this.subjectLine;

          /* Color subject font */

          if (accountColorsAbout3Pane.prefs.getBoolPref("thread-colorfont") && !coloringDisabled) {
            fontcolor = accountColorsUtilities.fontColorPref(accountidkey);
            element.style.setProperty("--ac-font-color", fontcolor);
          } else {
            element.style.removeProperty("--ac-font-color");
          }

          /* Subject font style */

          if (accountColorsAbout3Pane.prefs.getBoolPref("thread-setfontstyle")) {
            fontstyle = accountColorsAbout3Pane.prefs.getIntPref("thread-fontstyle");
            element.setAttribute("ac-fsw", ["normal", "italic", "bold", "bolditalic"][fontstyle]);
          } else {
            element.removeAttribute("ac-fsw");
          }

          /* Subject font size */

          if (accountColorsAbout3Pane.prefs.getBoolPref("thread-setfontsize")) {
            fontsize = accountColorsAbout3Pane.prefs.getIntPref("thread-fontsize");
            // ac-fs have margin-top attribute set, we use it instead of font-size style
            if (accountColorsAbout3Pane.prefs.getBoolPref("thread-incspacing")) {
              element.setAttribute("ac-fs", fontsize + "-is");
            } else {
              element.setAttribute("ac-fs", fontsize);
            }
          } else {
            element.removeAttribute("ac-fs");
          }

          /* Bold Subject on unread messages */

          if (accountColorsAbout3Pane.prefs.getBoolPref("thread-boldsubject")) {
            element.setAttribute("ac-boldsubject", "");
          } else {
            element.removeAttribute("ac-boldsubject");
          }

          continue;
        }

        if (column == "senderCol" || column == "dateCol") { // Sender column and Date column are in same line, so apply same font style and size is better
          element = column == "senderCol" ? this.senderLine : this.dateLine;

          /* Color from / date font */

          if (accountColorsAbout3Pane.prefs.getBoolPref("thread-colorfrom") && column == "senderCol" && !coloringDisabled) {
            fontcolor = accountColorsUtilities.fontColorPref(accountidkey);
            element.style.setProperty("--ac-font-color", fontcolor);
          } else if (accountColorsAbout3Pane.prefs.getBoolPref("thread-colorother") && column == "dateCol" && !coloringDisabled) {
            fontcolor = accountColorsUtilities.fontColorPref(accountidkey);
            element.style.setProperty("--ac-font-color", fontcolor);
          } else {
            element.style.removeProperty("--ac-font-color");
          }

          /* From font style */

          if (accountColorsAbout3Pane.prefs.getBoolPref("thread-setfromstyle")) {
            fontstyle = accountColorsAbout3Pane.prefs.getIntPref("thread-fromstyle");
            element.setAttribute("ac-fsw", ["normal", "italic", "bold", "bolditalic"][fontstyle]);
          } else {
            element.removeAttribute("ac-fsw");
          }

          /* From font size */

          if (accountColorsAbout3Pane.prefs.getBoolPref("thread-setfromsize")) {
            fontsize = accountColorsAbout3Pane.prefs.getIntPref("thread-fromsize");
            // ac-fs have margin-top attribute set, we use it instead of font-size style
            if (accountColorsAbout3Pane.prefs.getBoolPref("thread-incspacing")) {
              element.setAttribute("ac-fs", fontsize + "-is");
            } else {
              element.setAttribute("ac-fs", fontsize);
            }
          } else {
            element.removeAttribute("ac-fs");
          }

          /* Bold from on unread messages */

          if (accountColorsAbout3Pane.prefs.getBoolPref("thread-boldfrom")) {
            element.setAttribute("ac-boldfrom", "");
          } else {
            element.removeAttribute("ac-boldfrom");
          }

          continue;
        }
      }
    },

    /* Update thread pane background color */

    updateThreadPaneBkgdColor: function(event) {
      var folder, bkgdcolor;
      folder = window.gFolder || window.gFolderDisplay.displayedFolder || (event && accountColorsAbout3Pane.folderLookup.getFolderForURL(event.detail));
      if (folder) {
        bkgdcolor = accountColorsUtilities.bkgdColorPref(accountColorsUtilities.resolveAccountIdentityKeyForFolder(folder));
        document.getElementById("threadPane").style.setProperty("--ac-bkgd-color", bkgdcolor);
      }
    },
  },

  threadPane: function () {
    var element, fontsize, fromsize;

    /* Color pane background */

    if (accountColorsAbout3Pane.prefs.getBoolPref("thread-colorpanebkgd")) {
      element = accountColorsUtilities.thunderbirdVersion.major > 102 ? document.getElementById("threadPane") : accountColorsAbout3Pane.threadTree;
      element.setAttribute("ac-colorpanebkgd", "");
      accountColorsAbout3Pane.threadPaneManager.updateThreadPaneBkgdColor();
      window.addEventListener("folderURIChanged", accountColorsAbout3Pane.threadPaneManager.updateThreadPaneBkgdColor, false);
    } else {
      element = accountColorsUtilities.thunderbirdVersion.major > 102 ? document.getElementById("threadPane") : accountColorsAbout3Pane.threadTree;
      element.removeAttribute("ac-colorpanebkgd");
      element.style.removeProperty("--ac-bkgd-color");
      window.removeEventListener("folderURIChanged", accountColorsAbout3Pane.threadPaneManager.updateThreadPaneBkgdColor, false);
    }

    /* Black/White row fonts */

    if (accountColorsAbout3Pane.prefs.getBoolPref("thread-blackrowfont")) {
      element = accountColorsUtilities.thunderbirdVersion.major > 102 ? document.getElementById("threadPane") : accountColorsAbout3Pane.threadTree;
      element.setAttribute("ac-blackrowfont", "");
      element.removeAttribute("ac-whiterowfont");
    } else if (accountColorsAbout3Pane.prefs.getBoolPref("thread-whiterowfont")) {
      element = accountColorsUtilities.thunderbirdVersion.major > 102 ? document.getElementById("threadPane") : accountColorsAbout3Pane.threadTree;
      element.removeAttribute("ac-blackrowfont");
      element.setAttribute("ac-whiterowfont", "");
    } else {
      element = accountColorsUtilities.thunderbirdVersion.major > 102 ? document.getElementById("threadPane") : accountColorsAbout3Pane.threadTree;
      element.removeAttribute("ac-blackrowfont");
      element.removeAttribute("ac-whiterowfont");
    }

    /* Light/Dark pane background */

    if (accountColorsAbout3Pane.prefs.getBoolPref("thread-lightpanebkgd")) {
      element = accountColorsUtilities.thunderbirdVersion.major > 102 ? document.getElementById("threadPane") : accountColorsAbout3Pane.threadTree;
      element.setAttribute("ac-lightpanebkgd", "");
      element.removeAttribute("ac-darkpanebkgd");
    } else if (accountColorsAbout3Pane.prefs.getBoolPref("thread-darkpanebkgd")) {
      element = accountColorsUtilities.thunderbirdVersion.major > 102 ? document.getElementById("threadPane") : accountColorsAbout3Pane.threadTree;
      element.removeAttribute("ac-lightpanebkgd");
      element.setAttribute("ac-darkpanebkgd", "");
    } else {
      element = accountColorsUtilities.thunderbirdVersion.major > 102 ? document.getElementById("threadPane") : accountColorsAbout3Pane.threadTree;
      element.removeAttribute("ac-lightpanebkgd");
      element.removeAttribute("ac-darkpanebkgd");
    }

    /* Bold subject/from on unread messages */

    if (accountColorsAbout3Pane.prefs.getBoolPref("thread-boldsubject") || accountColorsAbout3Pane.prefs.getBoolPref("thread-boldfrom")) {
      element = accountColorsAbout3Pane.threadTree;
      element.setAttribute("ac-boldsubjectfrom", "");
    } else {
      element = accountColorsAbout3Pane.threadTree;
      element.removeAttribute("ac-boldsubjectfrom");
    }

    /* Increase row spacing based on subject/from font sizes */

    if (accountColorsAbout3Pane.prefs.getBoolPref("thread-incspacing")) {
      fontsize = accountColorsAbout3Pane.prefs.getIntPref("thread-fontsize");
      fromsize = accountColorsAbout3Pane.prefs.getIntPref("thread-fromsize");
      if (fromsize > fontsize) fontsize = fromsize;
      element = accountColorsAbout3Pane.threadTree;
      element.setAttribute("ac-is", fontsize);
    } else {
      element = accountColorsAbout3Pane.threadTree;
      element.removeAttribute("ac-is");
    }

    /* Reinstate default hover and select styles */

    if (accountColorsAbout3Pane.prefs.getBoolPref("thread-hoverselect")) {
      element = accountColorsAbout3Pane.threadTree;
      element.setAttribute("ac-hoverselect", "");
    } else {
      element = accountColorsAbout3Pane.threadTree;
      element.removeAttribute("ac-hoverselect");
    }

    /* Color background as gradient */

    if (accountColorsAbout3Pane.prefs.getBoolPref("thread-colorbkgd-gradient")) {
      element = accountColorsUtilities.thunderbirdVersion.major > 102 ? document.getElementById("threadPane") : accountColorsAbout3Pane.threadTree;
      element.setAttribute("ac-bkgdasgradient", "");
    } else {
      element = accountColorsUtilities.thunderbirdVersion.major > 102 ? document.getElementById("threadPane") : accountColorsAbout3Pane.threadTree;
      element.removeAttribute("ac-bkgdasgradient");
    }

    /* Color row background as label */

    if (accountColorsAbout3Pane.prefs.getBoolPref("thread-colorbkgd-row-label")) {
      element = accountColorsAbout3Pane.threadTree;
      switch (accountColorsAbout3Pane.prefs.getIntPref("thread-row-label-position")) {
        case 0: /* Subject Column */
          element.setAttribute("ac-bkgdaslabel-row", "subjectCol");
          break;
        case 1: /* First Column */
          element.setAttribute("ac-bkgdaslabel-row", "firstCol");
          break;
      }
      element.style.setProperty("--ac-row-label-width", accountColorsAbout3Pane.prefs.getIntPref("thread-row-label-width") + "px");
    } else {
      element = accountColorsAbout3Pane.threadTree;
      element.removeAttribute("ac-bkgdaslabel-row");
      element.style.removeProperty("--ac-row-label-width");
    }

    /* Color card background as label */

    if (accountColorsAbout3Pane.prefs.getBoolPref("thread-colorbkgd-card-label")) {
      element = accountColorsAbout3Pane.threadTree;
      switch (accountColorsAbout3Pane.prefs.getIntPref("thread-card-label-position")) {
        case 0: /* No Indent */
          element.setAttribute("ac-bkgdaslabel-card", "noindent");
          break;
        case 1: /* Indent */
          element.setAttribute("ac-bkgdaslabel-card", "indent");
          break;
      }
      element.style.setProperty("--ac-card-label-width", accountColorsAbout3Pane.prefs.getIntPref("thread-card-label-width") + "px");
    } else {
      element = accountColorsAbout3Pane.threadTree;
      element.removeAttribute("ac-bkgdaslabel-card");
      element.style.removeProperty("--ac-card-label-width");
    }
  },

  messagePaneManager: {
    onLoad: function () {},

    onUnload: function () {},

    reload: function() {},
  },

  messagePane: function(event, clear) {
    // For TB version 103 and above, the message window is handled by about:message (can be accessed via window.messageBrowser.contentWindow)
    if (accountColorsUtilities.thunderbirdVersion.major <= 102) {
      accountColorsAboutMessage.messageWindow(event, clear);
    }
  },
};

var accountColorsAbout3Pane = accountColorsUtilities.thunderbirdVersion.major <= 102
  ? accountColorsAbout3Pane_102
  : accountColorsAbout3Pane_115;
