/************************************************************************/
/*                                                                      */
/*      Account Colors  -  Thunderbird Extension  -  Utilities          */
/*                                                                      */
/*      Javascript for Utilities for all overlays                       */
/*                                                                      */
/*      Copyright (C) 2008-2015  by  DW-dev                             */
/*      Copyright (C) 2022-2022  by  MrMelon54                          */
/*                                                                      */
/*      Last Edit  -  15 Jul 2022                                       */
/*                                                                      */
/************************************************************************/

"use strict";

var Services = globalThis.Services ||
  ChromeUtils.import("resource://gre/modules/Services.jsm").Services;

/* Get thunderbird version object */

function getThunderbirdVersion() {
  const parts = Services.appinfo.version.split(".");
  return {
    major: parseInt(parts[0]),
    minor: parseInt(parts[1]),
  }
}

var accountColorsUtilities = {
  thunderbirdVersion: getThunderbirdVersion(),

  prefs: Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("extensions.accountcolors."),

  accountManager: Components.classes["@mozilla.org/messenger/account-manager;1"].getService(Components.interfaces.nsIMsgAccountManager),

  headerParser: Components.classes["@mozilla.org/messenger/headerparser;1"].getService(Components.interfaces.nsIMsgHeaderParser).wrappedJSObject ||
                Components.classes["@mozilla.org/messenger/headerparser;1"].getService(Components.interfaces.nsIMsgHeaderParser),

  debugCount: 0,

  /* Get account key for message */

  getAccountKey: function (msgHdr) {
    var accountkey;

    accountkey = "";

    if (true) {
      /* any received message (including message sent to self) */
      if (msgHdr.accountKey != "") {
        /* POP3 received message in POP3 or Local In */

        accountkey = msgHdr.accountKey;
      } else {
        if (msgHdr.folder.server.type == "imap") {
          /* message in IMAP folder */
          /* IMAP received message in IMAP inbox */
          /* POP3 received message in IMAP inbox */

          accountkey = accountColorsUtilities.findAccountKeyForRecipient(msgHdr, "imap");

          if (accountkey == "") accountkey = accountColorsUtilities.findAccountKeyForRecipient(msgHdr, "pop3");
        } /* message in POP3 or Local folder */ else {
          /* IMAP received message in POP3 or Local inbox */

          accountkey = accountColorsUtilities.findAccountKeyForRecipient(msgHdr, "imap");
        }
      }
    }

    return accountkey;
  },

  /* Resolve account / identity key for message, for thunderbird 102+ */

  resolveAccountIdentityKeyForMessage: function (msgHdr, searchAllAccounts) {
    var msgFolder, msgServer, msgAccount;
    var account, identity, address, email;
    var identities, matches, header, ccList;
    var identityMap = new Map();

    msgFolder = msgHdr.folder;
    msgServer = msgFolder.server;
    if (msgHdr.accountKey != "") {
      msgAccount = accountColorsUtilities.accountManager.getAccount(msgHdr.accountKey)
    } else {
      msgAccount = accountColorsUtilities.findAccountForServer(msgServer);
    }

    /* If searchAllAccounts = false, the result account / identity will only come from message's folder account */

    for (account of searchAllAccounts ? accountColorsUtilities.accountManager.accounts : [msgAccount]) {
      for (identity of account.identities || []) {
        email = accountColorsUtilities.canonicalizeEmail(identity.email);
        identities = identityMap.get(email);
        if (!identities) {
          identities = []
          identityMap.set(email, identities);
        }
        if (account.incomingServer.type == msgServer.type) {
          identities.unshift(identity); // Prefer identity that has same server type as message
        } else {
          identities.push(identity);
        }
      }
    }

    /* Search Recipient list first */

    for (address of accountColorsUtilities.headerParser.parseDecodedHeader(msgHdr.mime2DecodedRecipients)) {
      identities = identityMap.get(accountColorsUtilities.canonicalizeEmail(address.email));
      if (identities && identities.length > 0) {
        return identities[0].key; // Use first identity (as it is preferred)
      }
    }

    /* Search `Received` header's `for <email>` fields next, as Recipient's address may be special group address (e.g. GitHub notifications) */

    header = msgHdr.getStringProperty("received");
    if (header) {
      matches = header.match(/for\s+<([^>]+)>/);
      identities = matches && identityMap.get(accountColorsUtilities.canonicalizeEmail(matches[1]));
      if (identities && identities.length > 0) {
        return identities[0].key;
      }
    }

    /* Search for CC and BCC list next */

    ccList = msgHdr.ccList && msgHdr.bccList ? `${msgHdr.ccList}, ${msgHdr.bccList}` : msgHdr.ccList || msgHdr.bccList;
    if (ccList) {
      for (address of accountColorsUtilities.headerParser.parseDecodedHeader(ccList)) {
        identities = identityMap.get(accountColorsUtilities.canonicalizeEmail(address.email));
        if (identities && identities.length > 0) {
          return identities[0].key;
        }
      }
    }

    /* Search for Author (Message could be a sent message) */

    for (address of accountColorsUtilities.headerParser.parseDecodedHeader(msgHdr.mime2DecodedAuthor)) {
      identities = identityMap.get(accountColorsUtilities.canonicalizeEmail(address.email));
      if (identities && identities.length > 0) {
        return identities[0].key;
      }
    }

    /* Default fallback */

    if (msgAccount.defaultIdentity) {
      return msgAccount.defaultIdentity.key;
    }

    return msgAccount.key;
  },

  /* Resolve account / identity key for folder, for thunderbird 102+ */

  resolveAccountIdentityKeyForFolder: function (folder) {
    var server = folder.server;
    var account = accountColorsUtilities.findAccountForServer(server);
    var identities = account.identities || [];
    var identity, currentFolder;

    /* If folder name or any of its parent folder's name matches identity's email, use this identity */

    for (identity of identities) {
      currentFolder = folder;
      while (!!currentFolder.parent) { // Do not check root folder, as it's always default identity's email
        if (currentFolder.abbreviatedName.toLowerCase() == identity.email.toLowerCase()) {
          return identity.key;
        }
        currentFolder = currentFolder.parent;
      }
    }

    /* If folder name or any of its parent folder's name matches identity's name, use this identity */

    for (identity of identities) {
      currentFolder = folder;
      while (!!currentFolder.parent) {
        if (currentFolder.abbreviatedName.toLowerCase() == identity.fullName.toLowerCase()) {
          return identity.key;
        }
        currentFolder = currentFolder.parent;
      }
    }

    /* Fallback to use default identity or account key */

    if (!!account.defaultIdentity) {
      return account.defaultIdentity.key;
    }

    return account.key;
  },

  /* Canonicalize email address */

  canonicalizeEmail: function (email) {

    /* Lowercase & Remove whitespace */

    email = email.trim().toLowerCase();

    /* Remove plus addressing + */

    email = email.replace(/\+[^)]*@/, "@");

    /* If using gmail, remove dots in identifier part */

    if (email.endsWith("@gmail.com")) {
      email = email.replace(/\.(?=.*@)/g, "");
    }

    return email;
  },

  /* Find account key for message recipient */

  findAccountKeyForRecipient: function (msgHdr, type) {
    var accountkey, identityindex, recipients, acc, account, id, identity, index;
    var accounts = new Array();
    var identities = new Array();

    accountkey = "";
    identityindex = 1000000;

    recipients = "," + accountColorsUtilities.headerParser.extractHeaderAddressMailboxes(msgHdr.recipients) + ",";
    recipients += accountColorsUtilities.headerParser.extractHeaderAddressMailboxes(msgHdr.ccList) + ",";
    recipients = recipients.toLowerCase().replace(/\s/g, "");

    accounts = accountColorsUtilities.accountManager.accounts;

    for (acc = 0; acc < accountColorsUtilities.getLength(accounts); acc++) {
      account = accountColorsUtilities.getAccount(accounts, acc);

      if (account.incomingServer.type == type) {
        identities = account.identities;

        for (id = 0; id < accountColorsUtilities.getLength(identities); id++) {
          identity = accountColorsUtilities.getIdentity(identities, id);

          index = recipients.indexOf("," + identity.email + ",");

          if (index >= 0) {
            if (account.incomingServer == msgHdr.folder.server) return account.key;

            if (index < identityindex) {
              accountkey = account.key;
              identityindex = index;
            }
          }
        }
      }
    }

    return accountkey;
  },

  /* Find account for server */

  findAccountForServer(server) {
    // See https://developer.thunderbird.net/add-ons/updating/tb128#mailservices.accounts.findaccountforserver
    if (accountColorsUtilities.thunderbirdVersion.major >= 121) {
      return accountColorsUtilities.accountManager.findAccountForServer(server);
    } else {
      return accountColorsUtilities.accountManager.FindAccountForServer(server);
    }
  },

  /* Get font color for account/identity */

  fontColorPref: function (accountidkey) {
    var fontcolor;

    try {
      fontcolor = accountColorsUtilities.prefs.getCharPref(accountidkey + "-fontcolor");
    } catch (e) {
      fontcolor = "";
    }

    return fontcolor;
  },

  /* Get background color for account/identity */

  bkgdColorPref: function (accountidkey) {
    var bkgdcolor;

    try {
      bkgdcolor = accountColorsUtilities.prefs.getCharPref(accountidkey + "-bkgdcolor");
    } catch (e) {
      bkgdcolor = "";
    }

    return bkgdcolor;
  },

  /* Get number of accounts/identities */

  getLength: function (items) {
    /* Thunderbird 20.0 - nsISupportsArray deprecated - length replaced Count()  */

    if (typeof items.length != "undefined") return items.length;
    else return items.Count();
  },

  /* Get account by index */

  getAccount: function (accounts, index) {
    /* Thunderbird 20.0 - nsISupportsArray deprecated - queryElementAt() replaced QueryElementAt()  */

    if (Array.isArray(accounts)) return accounts[index];
    if (typeof accounts.length != "undefined") return accounts.queryElementAt(index, Components.interfaces.nsIMsgAccount);
    else return accounts.QueryElementAt(index, Components.interfaces.nsIMsgAccount);
  },

  /* Get identity by index */

  getIdentity: function (identities, index) {
    /* Thunderbird 20.0 - nsISupportsArray deprecated - queryElementAt() replaced QueryElementAt()  */

    if (Array.isArray(identities)) return identities[index];
    if (typeof identities.length != "undefined") return identities.queryElementAt(index, Components.interfaces.nsIMsgIdentity);
    else return identities.QueryElementAt(index, Components.interfaces.nsIMsgIdentity);
  },

  /* Display debug message */

  debugMessage: function (module, information) {
    var info;

    accountColorsUtilities.debugCount++;
    info = document.getElementById("accountcolors-debug-info");
    info.label = accountColorsUtilities.debugCount + " - " + module + " - " + information;
  },
};
