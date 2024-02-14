/************************************************************************/
/*                                                                      */
/*      Account Colors  -  Thunderbird Extension  -  Preferences        */
/*                                                                      */
/*      Javascript for Preferences defaults                             */
/*                                                                      */
/*      Copyright (C) 2008-2019  by  DW-dev                             */
/*      Copyright (C) 2022-2022  by  MrMelon54                          */
/*                                                                      */
/*      Last Edit  -  15 Jul 2022                                       */
/*                                                                      */
/************************************************************************/

/* defaults for accountidkey-fontcolor are handled in accountcolors-utilities.js */
/* defaults for accountidkey-bkgdcolor are handled in accountcolors-utilities.js */

/* Color Picker */

pref("extensions.accountcolors.picker-autobkgd", false);
pref("extensions.accountcolors.picker-applyall", false);

/* Folder Pane */

pref("extensions.accountcolors.folder-setfontstyle", false);
pref("extensions.accountcolors.folder-fontstyle", 2);
pref("extensions.accountcolors.folder-setfontsize", false);
pref("extensions.accountcolors.folder-fontsize", 12);
pref("extensions.accountcolors.folder-colorfont", true);
pref("extensions.accountcolors.folder-colorbkgd", true);
pref("extensions.accountcolors.folder-colorfldfont", true);
pref("extensions.accountcolors.folder-colorfldbkgd", false);
pref("extensions.accountcolors.folder-colorother", false);
pref("extensions.accountcolors.folder-colorotherbkgd", false);
pref("extensions.accountcolors.folder-blackrowfont", false);
pref("extensions.accountcolors.folder-lightpanebkgd", false);
pref("extensions.accountcolors.folder-whiterowfont", false);
pref("extensions.accountcolors.folder-darkpanebkgd", false);
pref("extensions.accountcolors.folder-defaultbkgd", false);
pref("extensions.accountcolors.folder-boldnewmail", false);
pref("extensions.accountcolors.folder-undernewmail", false);
pref("extensions.accountcolors.folder-noboldunread", false);
pref("extensions.accountcolors.folder-showlines", false);
pref("extensions.accountcolors.folder-darkerbar", false);
pref("extensions.accountcolors.folder-incspacing", false);
pref("extensions.accountcolors.folder-hoverselect", true);
pref("extensions.accountcolors.folder-colorbkgd-gradient", false);
pref("extensions.accountcolors.folder-colorbkgd-account-icon", true);
pref("extensions.accountcolors.folder-colorbkgd-folder-icon", false);

/* Thread Pane */

pref("extensions.accountcolors.thread-setfontstyle", false);
pref("extensions.accountcolors.thread-fontstyle", 0);
pref("extensions.accountcolors.thread-setfontsize", false);
pref("extensions.accountcolors.thread-fontsize", 12);
pref("extensions.accountcolors.thread-setfromstyle", false);
pref("extensions.accountcolors.thread-fromstyle", 0);
pref("extensions.accountcolors.thread-setfromsize", false);
pref("extensions.accountcolors.thread-fromsize", 12);
pref("extensions.accountcolors.thread-colorfont", false);
pref("extensions.accountcolors.thread-colorbkgd", false);
pref("extensions.accountcolors.thread-colorfrom", false);
pref("extensions.accountcolors.thread-colorother", false);
pref("extensions.accountcolors.thread-colorpanebkgd", false);
pref("extensions.accountcolors.thread-blackrowfont", false);
pref("extensions.accountcolors.thread-lightpanebkgd", false);
pref("extensions.accountcolors.thread-whiterowfont", false);
pref("extensions.accountcolors.thread-darkpanebkgd", false);
pref("extensions.accountcolors.thread-hdraccount", false);
pref("extensions.accountcolors.thread-boldsubject", false);
pref("extensions.accountcolors.thread-boldfrom", false);
pref("extensions.accountcolors.thread-showstripes", false);
pref("extensions.accountcolors.thread-darkerbar", false);
pref("extensions.accountcolors.thread-incspacing", false);
pref("extensions.accountcolors.thread-hoverselect", true);
pref("extensions.accountcolors.thread-colorbkgd-gradient", false);
pref("extensions.accountcolors.thread-colorbkgd-row-label", false);
pref("extensions.accountcolors.thread-row-label-position", 0);
pref("extensions.accountcolors.thread-row-label-width", 2);
pref("extensions.accountcolors.thread-colorbkgd-card-label", false);
pref("extensions.accountcolors.thread-card-label-position", 0);
pref("extensions.accountcolors.thread-card-label-width", 4);
pref("extensions.accountcolors.thread-color-unified-only", false);

/* Message Pane/Tab/Window */

pref("extensions.accountcolors.message-setfontstyle", false);
pref("extensions.accountcolors.message-fontstyle", 2);
pref("extensions.accountcolors.message-setfontsize", false);
pref("extensions.accountcolors.message-fontsize", 12);
pref("extensions.accountcolors.message-setfromstyle", false);
pref("extensions.accountcolors.message-fromstyle", 0);
pref("extensions.accountcolors.message-setfromsize", false);
pref("extensions.accountcolors.message-fromsize", 12);
pref("extensions.accountcolors.message-colorfont", false);
pref("extensions.accountcolors.message-colorbkgd", false);
pref("extensions.accountcolors.message-colorfrom", false);
pref("extensions.accountcolors.message-blackhdrlabels", false);
pref("extensions.accountcolors.message-whitehdrlabels", false);
pref("extensions.accountcolors.message-hdraccount", false);
pref("extensions.accountcolors.message-defaultbkgd", false);
pref("extensions.accountcolors.message-colorbkgd-gradient", false);
pref("extensions.accountcolors.message-colorbkgd-header-label", false);
pref("extensions.accountcolors.message-header-label-width", 4);

/* Compose Window */

pref("extensions.accountcolors.compose-setfontstyle", false);
pref("extensions.accountcolors.compose-fontstyle", 0);
pref("extensions.accountcolors.compose-setfontsize", false);
pref("extensions.accountcolors.compose-fontsize", 12);
pref("extensions.accountcolors.compose-setidfontstyle", false);
pref("extensions.accountcolors.compose-idfontstyle", 0);
pref("extensions.accountcolors.compose-setidfontsize", false);
pref("extensions.accountcolors.compose-idfontsize", 12);
pref("extensions.accountcolors.compose-colorfont", false);
pref("extensions.accountcolors.compose-colorbkgd", false);
pref("extensions.accountcolors.compose-colorfromfont", false);
pref("extensions.accountcolors.compose-colorfrombkgd", false);
pref("extensions.accountcolors.compose-colortofont", false);
pref("extensions.accountcolors.compose-colortobkgd", false);
pref("extensions.accountcolors.compose-coloratmfont", false);
pref("extensions.accountcolors.compose-coloratmbkgd", false);
pref("extensions.accountcolors.compose-colorhdrfont", false);
pref("extensions.accountcolors.compose-colorhdrbkgd", false);
pref("extensions.accountcolors.compose-blackhdrlabels", false);
pref("extensions.accountcolors.compose-whitehdrlabels", false);
pref("extensions.accountcolors.compose-blackfieldfont", false);
pref("extensions.accountcolors.compose-lightfieldbkgd", false);
pref("extensions.accountcolors.compose-whitefieldfont", false);
pref("extensions.accountcolors.compose-darkfieldbkgd", false);
pref("extensions.accountcolors.compose-defaultbkgd", false);
pref("extensions.accountcolors.compose-hoverfrom", true);
pref("extensions.accountcolors.compose-colorbkgd-gradient", false);
pref("extensions.accountcolors.compose-colorbkgd-idmenu-label", false);
pref("extensions.accountcolors.compose-idmenu-label-width", 4);

/* Fetch received header for better identity resolution */

pref("mailnews.customDBHeaders", "received");
