# MessageStyles API

A generic Thunderbird experiment API for applying declarative styling rules to
messages and folders across the Thunderbird UI. Rules consist of **predicate
conditions** that match against message, folder, or compose properties, and
**style properties** to apply when those conditions are satisfied.

MessageStyles is designed to be reusable — it knows nothing about "accounts" or
"colors" specifically. Any add-on can define rules that style by arbitrary
criteria: account, sender, subject, folder type, message age, junk score, tags,
or any combination thereof.

## Architecture

```
background.js
  └─ messenger.messageStyles.addRule(rule)
        │
        ▼
api/MessageStyles/implementation.js          (experiment, parent process)
  ├─ Registers resource://messagestyles/ URL
  ├─ Manages rule storage
  ├─ Listens for window open/close via ExtensionSupport
  └─ Calls onLoad/onUnload/onRulesChanged on ESM modules:
        │
        ├─ modules/MessageStylesCore.sys.mjs        (predicate engine)
        ├─ modules/MessageStylesAbout3Pane.sys.mjs   (folder + thread pane)
        ├─ modules/MessageStylesAboutMessage.sys.mjs (message header)
        └─ modules/MessageStylesCompose.sys.mjs      (compose window)
```

Modules are loaded via `ChromeUtils.importESModule("resource://messagestyles/...")`
and are true ESM singletons. Per-window state is tracked in a `WeakMap` keyed by
the window object.

## API Functions

All functions are async and live under `messenger.messageStyles`.

### `startup()`

Initialize the API. Registers resource URLs and window listeners. Must be
called once before any other function. Accessing this function triggers the
experiment's `onStartup()` lifecycle hook.

```js
await messenger.messageStyles.startup();
```

### `addRule(rule)`

Register a `StylingRule`. If a rule with the same `id` already exists (from the
same extension), it is replaced. Rules take effect immediately in all open
windows.

```js
await messenger.messageStyles.addRule({
  id: "my-rule",
  priority: 10,
  contexts: ["threadPane", "folderPane"],
  conditions: { property: "account", op: "equals", value: "account1" },
  style: { fontColor: "#ff0000" },
});
```

### `removeRule(ruleId)`

Remove a previously registered rule by its `id`. Only removes rules belonging
to the calling extension.

```js
await messenger.messageStyles.removeRule("my-rule");
```

### `getRules()`

Returns an array of all `StylingRule` objects registered by the calling
extension.

```js
let rules = await messenger.messageStyles.getRules();
```

### `clearRules()`

Remove all rules belonging to the calling extension. Rules from other extensions
are not affected.

```js
await messenger.messageStyles.clearRules();
```

### `setRules(rules)`

Atomically replace the calling extension's rules. Removes only this extension's
existing rules, registers the provided array of `StylingRule` objects, and
broadcasts the combined set (including other extensions' rules) to all windows in
a single update. This avoids visual flicker and is safe for multi-extension use.

```js
await messenger.messageStyles.setRules([
  {
    id: "account1-folder",
    priority: 10,
    contexts: ["folderPane"],
    conditions: { property: "account", op: "equals", value: "account1" },
    style: { fontColor: "#cc0000" },
  },
  {
    id: "account1-thread",
    priority: 10,
    contexts: ["threadPane"],
    conditions: { property: "account", op: "equals", value: "account1" },
    style: { fontColor: "#cc0000", backgroundColor: "#ffe0e0" },
  },
]);
```

## StylingRule

A rule binds predicate conditions to visual styles within specified UI contexts.

| Field        | Type               | Required | Description |
|--------------|--------------------|----------|-------------|
| `id`         | `string`           | yes      | Unique identifier for the rule. |
| `priority`   | `integer`          | no       | Merge order when multiple rules match. Higher wins per-property. Default `0`. |
| `contexts`   | `string[]`         | yes      | UI contexts: `"threadPane"`, `"folderPane"`, `"messageHeader"`, `"composeWindow"`. |
| `conditions` | `StyleCondition`   | yes      | Predicate tree to test. `null` or `{}` matches everything. |
| `style`      | `StyleProperties`  | yes      | Styles to apply when conditions match. |

## Contexts

| Context          | Where it applies | Properties available |
|------------------|------------------|----------------------|
| `threadPane`     | Message list rows (table and card views) | All message properties |
| `folderPane`     | Folder tree rows | Folder properties |
| `messageHeader`  | Message display header (subject, from, background) | All message properties |
| `composeWindow`  | Compose window (identity selector, header area) | Compose properties |

## Properties

### Message properties (`threadPane`, `messageHeader`)

| Property         | Type      | Description |
|------------------|-----------|-------------|
| `account`        | `string`  | Account key (e.g. `"account1"`). |
| `identity`       | `string`  | Resolved identity key (e.g. `"id1"`). Lazily computed. |
| `folderName`     | `string`  | Display name of the containing folder. |
| `folderPath`     | `string`  | Full folder URI. |
| `folderType`     | `string`  | One of: `inbox`, `sent`, `drafts`, `trash`, `junk`, `templates`, `archive`, `queue`, or `""`. |
| `serverType`     | `string`  | Server type: `imap`, `pop3`, `nntp`, `rss`, `none`, etc. |
| `serverHostName` | `string`  | Server hostname (e.g. `"imap.example.com"`). |
| `from`           | `string`  | Decoded sender (e.g. `"Alice <alice@example.com>"`). |
| `to`             | `string`  | Decoded recipients. |
| `cc`             | `string`  | CC list. |
| `bcc`            | `string`  | BCC list. |
| `subject`        | `string`  | Decoded subject line. |
| `date`           | `number`  | Message date as milliseconds since epoch. |
| `age`            | `number`  | Message age in days (integer). |
| `size`           | `number`  | Message size in bytes. |
| `isRead`         | `boolean` | Whether the message has been read. |
| `isFlagged`      | `boolean` | Whether the message is starred/flagged. |
| `isReplied`      | `boolean` | Whether a reply has been sent. |
| `isForwarded`    | `boolean` | Whether the message has been forwarded. |
| `hasAttachments` | `boolean` | Whether the message has attachments. |
| `keywords`       | `string`  | Space-delimited tag keywords. |
| `priority`       | `number`  | Priority level (0 = none, 1 = lowest, … 5 = highest). |
| `junkScore`      | `number`  | Junk score (0 = not junk, 100 = junk). |

### Folder properties (`folderPane`)

| Property         | Type     | Description |
|------------------|----------|-------------|
| `account`        | `string` | Account key. |
| `identity`       | `string` | Resolved identity key for the folder. Lazily computed. |
| `folderName`     | `string` | Display name. |
| `folderPath`     | `string` | Full folder URI. |
| `folderType`     | `string` | Same enum as message properties. |
| `serverType`     | `string` | Server type. |
| `serverHostName` | `string` | Server hostname. |

### Compose properties (`composeWindow`)

| Property   | Type     | Description |
|------------|----------|-------------|
| `account`  | `string` | Account key of the selected sending identity. |
| `identity` | `string` | Identity key of the selected sending identity. |

## StyleProperties

| Field              | Type      | Description |
|--------------------|-----------|-------------|
| `fontColor`        | `string`  | CSS color for text (e.g. `"#ff0000"`, `"rgb(255,0,0)"`). |
| `backgroundColor`  | `string`  | CSS color for row/header background. |
| `fontWeight`       | `string`  | `"normal"` or `"bold"`. |
| `fontStyle`        | `string`  | `"normal"` or `"italic"`. |
| `fontSize`         | `integer` | Font size in pixels (8–24). |
| `backgroundStyle`  | `string`  | `"solid"` (default) or `"gradient"` (left-to-transparent fade). |
| `labelColor`       | `string`  | CSS color for label stripes. Defaults to `fontColor` if not specified. |
| `rowLabelWidth`    | `integer` | Thread table view: render background as a narrow label stripe of this width in pixels (1–12). |
| `rowLabelPosition` | `string`  | `"subject"` (default) or `"first"` — where the table row label stripe appears. |
| `cardLabelWidth`   | `integer` | Thread card view: render background as a narrow label stripe of this width in pixels (1–12). |
| `headerLabelWidth` | `integer` | Message header: render background as a narrow label stripe of this width in pixels (1–12). |
| `idmenuLabelWidth` | `integer` | Compose window: render header background as a narrow label stripe of this width in pixels (1–12). |
| `columns`          | `object`  | Per-field/column overrides. See below. |

### Per-field/column overrides

The `columns` object maps field or column identifiers to `ColumnStyleProperties`
objects (`fontColor`, `fontWeight`, `fontStyle`, `fontSize`). Top-level style
properties serve as defaults; per-field overrides take precedence.

Which keys are recognized depends on the context:

#### Thread pane (`threadPane`)

- Column IDs: `subjectCol`, `senderCol`, `correspondentCol`, `dateCol`, `sizeCol`, `accountCol`
- Aliases: `subject`, `from`, `date`, `size`, `other`

#### Message header (`messageHeader`)

- `subjectCol` or `subject` — subject line
- `senderCol` or `from` — sender/from field

Top-level `fontColor` is inherited by both fields. Top-level `fontWeight`,
`fontStyle`, and `fontSize` apply to the subject only. The from field gets its
font properties exclusively from its column override.

#### Compose window (`composeWindow`)

- `subjectCol` or `subject` — subject input field
- `from` or `identity` — identity/from selector

Top-level `fontColor` is inherited as a fallback for both fields. Font weight,
style, and size are read from per-field overrides only.

#### Folder pane (`folderPane`)

No column overrides — top-level properties apply to the folder row directly.

```js
style: {
  fontColor: "#333",
  columns: {
    senderCol:  { fontColor: "#0066cc", fontWeight: "bold" },
    subjectCol: { fontStyle: "italic" },
  },
}
```

## Background Labels

Instead of filling the entire background with color, labels render a narrow
colored stripe on the left edge. Label color defaults to `labelColor`, falling
back to `fontColor`, then `backgroundColor`. Labels and gradients are mutually
exclusive — when a label width is set, it takes precedence over `backgroundStyle`.

### Thread pane (table view): `rowLabelWidth` + `rowLabelPosition`

Renders a vertical stripe on the subject column (`"subject"`, the default) or
the first visible column in the row (`"first"`).

```js
style: {
  backgroundColor: "#e0e0ff",
  labelColor: "#3333cc",
  rowLabelWidth: 3,
  rowLabelPosition: "subject",
}
```

### Thread pane (card view): `cardLabelWidth`

Renders a vertical stripe on the left edge of the card, with card content
offset to make room.

```js
style: {
  backgroundColor: "#e0e0ff",
  labelColor: "#3333cc",
  cardLabelWidth: 4,
}
```

### Message header: `headerLabelWidth`

Renders a vertical stripe on the left edge of the message header area.

```js
style: {
  backgroundColor: "#ffe0e0",
  labelColor: "#cc0000",
  headerLabelWidth: 4,
}
```

### Compose window: `idmenuLabelWidth`

Renders a vertical stripe on the left edge of the compose header toolbar.
When active, the identity selector's background is cleared so only the label
stripe is visible.

```js
style: {
  backgroundColor: "#e0ffe0",
  labelColor: "#006600",
  idmenuLabelWidth: 4,
}
```

## Conditions (Predicate Logic)

Conditions form a tree of logical expressions. There are two kinds of nodes:

1. **Leaf conditions** — test a single property against a value.
2. **Combinators** — compose multiple conditions with boolean logic.

### Leaf conditions

```js
{ property: "<name>", op: "<operator>", value: <test_value> }
```

### Operators

| Operator      | Description | Example |
|---------------|-------------|---------|
| `equals` or `eq`     | Strict equality | `{ property: "account", op: "equals", value: "account1" }` |
| `notEquals` or `ne`  | Strict inequality | `{ property: "folderType", op: "notEquals", value: "trash" }` |
| `contains`    | Substring match (case-insensitive) or array membership | `{ property: "from", op: "contains", value: "example.com" }` |
| `notContains` | Negated `contains` | `{ property: "subject", op: "notContains", value: "SPAM" }` |
| `matches`     | Regular expression (case-insensitive) | `{ property: "from", op: "matches", value: "^(alice|bob)@" }` |
| `startsWith`  | String prefix (case-insensitive) | `{ property: "folderPath", op: "startsWith", value: "imap://" }` |
| `endsWith`    | String suffix (case-insensitive) | `{ property: "subject", op: "endsWith", value: "[urgent]" }` |
| `gt`          | Greater than (numeric) | `{ property: "size", op: "gt", value: 1048576 }` |
| `lt`          | Less than (numeric) | `{ property: "age", op: "lt", value: 7 }` |
| `gte`         | Greater than or equal | `{ property: "priority", op: "gte", value: 4 }` |
| `lte`         | Less than or equal | `{ property: "junkScore", op: "lte", value: 50 }` |
| `in`          | Value is in a given array | `{ property: "folderType", op: "in", value: ["inbox", "sent"] }` |
| `exists`      | Property is non-empty | `{ property: "cc", op: "exists" }` |
| `notExists`   | Property is empty/missing | `{ property: "bcc", op: "notExists" }` |

### Combinators

#### AND — `all`

All child conditions must be true.

```js
{
  all: [
    { property: "folderType", op: "equals", value: "inbox" },
    { property: "isRead", op: "equals", value: false },
  ]
}
```

#### OR — `any`

At least one child condition must be true.

```js
{
  any: [
    { property: "folderType", op: "equals", value: "inbox" },
    { property: "folderType", op: "equals", value: "sent" },
  ]
}
```

#### NOT — `not`

Inverts a single condition.

```js
{
  not: { property: "folderType", op: "equals", value: "trash" }
}
```

#### Always-match

An empty or null condition matches everything:

```js
conditions: {}      // matches all
conditions: null    // matches all
```

## Examples

### Simple: Color an account red

```js
await messenger.messageStyles.addRule({
  id: "account1-red",
  priority: 10,
  contexts: ["threadPane", "folderPane", "messageHeader"],
  conditions: { property: "account", op: "equals", value: "account1" },
  style: {
    fontColor: "#cc0000",
    backgroundColor: "#ffe0e0",
  },
});
```

### Highlight unread messages in inbox

```js
await messenger.messageStyles.addRule({
  id: "unread-inbox",
  priority: 20,
  contexts: ["threadPane"],
  conditions: {
    all: [
      { property: "folderType", op: "equals", value: "inbox" },
      { property: "isRead", op: "equals", value: false },
    ],
  },
  style: { fontWeight: "bold", fontColor: "#000000" },
});
```

### Style messages from specific domains (OR)

```js
await messenger.messageStyles.addRule({
  id: "vip-senders",
  priority: 30,
  contexts: ["threadPane", "messageHeader"],
  conditions: {
    any: [
      { property: "from", op: "contains", value: "@company.com" },
      { property: "from", op: "contains", value: "@partner.org" },
      { property: "from", op: "matches", value: "^CEO\\b" },
    ],
  },
  style: { fontColor: "#006600", fontWeight: "bold" },
});
```

### Complex AND/OR: Unread messages in inbox or sent, not from a specific domain

```js
await messenger.messageStyles.addRule({
  id: "complex-filter",
  priority: 25,
  contexts: ["threadPane"],
  conditions: {
    all: [
      { property: "isRead", op: "equals", value: false },
      {
        any: [
          { property: "folderType", op: "equals", value: "inbox" },
          { property: "folderType", op: "equals", value: "sent" },
        ],
      },
      {
        not: { property: "from", op: "contains", value: "@noreply.example.com" },
      },
    ],
  },
  style: {
    fontColor: "#003399",
    backgroundColor: "#eef4ff",
    backgroundStyle: "gradient",
  },
});
```

### Nested predicates: High-priority or flagged, but not junk

```js
await messenger.messageStyles.addRule({
  id: "important-not-junk",
  priority: 40,
  contexts: ["threadPane", "messageHeader"],
  conditions: {
    all: [
      {
        any: [
          { property: "priority", op: "gte", value: 4 },
          { property: "isFlagged", op: "equals", value: true },
        ],
      },
      { property: "junkScore", op: "lt", value: 50 },
      {
        not: { property: "folderType", op: "equals", value: "trash" },
      },
    ],
  },
  style: {
    fontColor: "#cc6600",
    fontWeight: "bold",
    fontStyle: "italic",
  },
});
```

### Large old messages with attachments

```js
await messenger.messageStyles.addRule({
  id: "large-old-attachments",
  priority: 15,
  contexts: ["threadPane"],
  conditions: {
    all: [
      { property: "size", op: "gt", value: 5242880 },       // > 5 MB
      { property: "age", op: "gt", value: 365 },            // older than 1 year
      { property: "hasAttachments", op: "equals", value: true },
    ],
  },
  style: {
    fontColor: "#999999",
    fontStyle: "italic",
  },
});
```

### Per-column styling in the thread pane

Style the sender column differently from the rest of the row:

```js
await messenger.messageStyles.addRule({
  id: "column-overrides",
  priority: 20,
  contexts: ["threadPane"],
  conditions: { property: "identity", op: "equals", value: "id2" },
  style: {
    fontColor: "#333333",
    backgroundColor: "#f0f8ff",
    columns: {
      correspondentCol: { fontColor: "#0066cc", fontWeight: "bold" },
      subjectCol:       { fontStyle: "italic" },
      dateCol:          { fontColor: "#888888" },
    },
  },
});
```

### Style specific folder types in the folder pane

```js
await messenger.messageStyles.addRule({
  id: "special-folders",
  priority: 10,
  contexts: ["folderPane"],
  conditions: {
    any: [
      { property: "folderType", op: "equals", value: "drafts" },
      { property: "folderType", op: "equals", value: "templates" },
    ],
  },
  style: { fontColor: "#996633", fontStyle: "italic" },
});
```

Equivalently using the `in` operator:

```js
conditions: { property: "folderType", op: "in", value: ["drafts", "templates"] }
```

### Compose window: style by identity

```js
await messenger.messageStyles.addRule({
  id: "work-identity-compose",
  priority: 10,
  contexts: ["composeWindow"],
  conditions: { property: "identity", op: "equals", value: "id1" },
  style: {
    fontColor: "#003366",
    backgroundColor: "#e8f0fe",
    columns: {
      subject:  { fontWeight: "bold", fontSize: 14 },
      identity: { fontColor: "#006600" },
    },
  },
});
```

### Using regex: Match subjects with ticket numbers

```js
await messenger.messageStyles.addRule({
  id: "ticket-subjects",
  priority: 35,
  contexts: ["threadPane", "messageHeader"],
  conditions: {
    property: "subject",
    op: "matches",
    value: "\\b(TICKET|BUG|ISSUE)-\\d+\\b",
  },
  style: { fontColor: "#660099" },
});
```

### Multiple rules with priority merging

When multiple rules match the same element, their styles are merged. For each
style property, the value from the highest-priority matching rule wins.

```js
// Base rule: light background for all inbox messages
await messenger.messageStyles.addRule({
  id: "inbox-base",
  priority: 10,
  contexts: ["threadPane"],
  conditions: { property: "folderType", op: "equals", value: "inbox" },
  style: { backgroundColor: "#f0f0f0" },
});

// Higher-priority overlay: bold red text for flagged inbox messages
await messenger.messageStyles.addRule({
  id: "inbox-flagged",
  priority: 20,
  contexts: ["threadPane"],
  conditions: {
    all: [
      { property: "folderType", op: "equals", value: "inbox" },
      { property: "isFlagged", op: "equals", value: true },
    ],
  },
  style: { fontColor: "#cc0000", fontWeight: "bold" },
});

// A flagged inbox message gets:
//   backgroundColor: "#f0f0f0"  (from inbox-base, priority 10)
//   fontColor: "#cc0000"        (from inbox-flagged, priority 20)
//   fontWeight: "bold"          (from inbox-flagged, priority 20)
```

## Rule lifecycle

- Rules are stored in memory by the experiment API. They do not persist across
  Thunderbird restarts — the background script is responsible for regenerating
  them on startup (typically from stored preferences).
- Rules are **scoped per extension**. Each extension manages its own independent
  set of rules — `clearRules()`, `setRules()`, `getRules()`, and `removeRule()`
  only affect rules belonging to the calling extension. Multiple extensions can
  safely use the API concurrently without interfering with each other.
- Rule IDs must be unique within an extension. Two different extensions may use
  the same rule ID without conflict.
- Calling `addRule()` with an existing `id` replaces the previous rule.
- All mutations (`addRule`, `removeRule`, `clearRules`, `setRules`) take effect
  immediately in every open window.
- Prefer `setRules()` when replacing the full rule set (e.g. on startup or after
  a preference change) to avoid intermediate empty/partial states.
