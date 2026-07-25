# TUI v3 Refactor Plan

## 1. Status & Goal

The current `src/tui/v2/` dashboard is technically functional but ergonomically poor:
users must learn a non-standard "navigate → select → input" mode machine,
selectable rows are visually indistinguishable from static text, async actions
provide no feedback, and error/success messages look identical.

This document defines **TUI v3**: a refocused terminal UI with a single visible
cursor, immediate feedback, consistent visual grammar, and room for search,
history, and in-place actions.

**Scope:** refactor the framework (`framework.mjs`, `panel-utils.mjs`) and the
six panels. Preserve the CLI entry point (`occier` with no args launches the
dashboard). Every phase below is independently shippable and testable.

---

## 2. Pain-Point Audit (Summary)

| Severity | Problem | Root Cause |
|----------|---------|------------|
| **P0** | Async actions (install, connectivity test) have no loading indicator; UI appears frozen. | `invokeAction` awaits `handleAction` without setting a busy state. |
| **P0** | Key events are not serialized during async actions, causing race conditions. | The `term.on("key")` handler is async but there is no action lock. |
| **P1** | Selectable and non-selectable rows look identical in "navigate" mode. | `selectedLine()` only applies when an item is selected; no always-on affordance. |
| **P1** | `UP`/`DOWN` scrolls the panel instead of moving a cursor, violating TUI convention. | Two-mode design separates scrolling from selection. |
| **P1** | Users must press `ENTER` to "enter select mode" before they can act on an item. | Implicit mode machine with no visible cursor in the default state. |
| **P1** | Error and success messages use the same color and 2-second duration. | `showStatus` is monochromatic and has one timeout for all messages. |
| **P1** | Tab bar shows no counts, error badges, or refresh state. | Footer/tab bar are purely decorative labels. |
| **P2** | Empty states (Vault, Projects) tell users to leave the TUI and run shell commands. | Panels expose no actions for their own empty states. |
| **P2** | The input modal is just two unbordered lines; long values are clipped. | Modal draws title+prompt+input inline without a bounding box or horizontal scroll. |
| **P2** | Selectable-item line numbers are hand-computed in parallel with rendering. | `getSelectableItems`/`getScrollInfo` duplicate the layout math of `renderPanel`. |

### Architectural blockers

- **A1 — global mutable state:** `_mode`, `_scrollOffsets`, `_selectedItemIds`,
  `_input*`, `_status*` are module-level variables. Snapshotting, diffing, and
  testing are hard.
- **A2 — implicit mode ladder:** `handleNavigateKey` / `handleSelectKey` /
  `handleInputKey` are separate functions with no `onEnter/onExit/onKey` hooks.
- **A3 — duplicated layout math:** every panel hand-computes `line` numbers for
  `getSelectableItems`. Adding or removing a hint row silently desynchronizes
  scrolling and cursor positioning.
- **A4 — no async serialization:** an action can run while another key event
  mutates shared state.
- **A8 — no design tokens:** colors are hard-coded inline; visual grammar is
  inconsistent across panels.

---

## 3. Design Principles

1. **One visible cursor.** The default mode always shows where the focus is.
   Arrows move the cursor; the view scrolls to keep the cursor visible.
2. **Immediate feedback.** Every user action gives a response within one frame:
   cursor movement, loading spinner, or status message.
3. **Color means meaning.** Green = success, red = error, yellow = warning,
   cyan = information/Chrome. Not decoration.
4. **Actions in place.** Empty states offer an in-TUI action rather than a shell
   command.
5. **Single source of truth.** A row's identity, position, and scroll budget
   come from the same render pass.

---

## 4. Target Architecture

### 4.1 State Object (replaces globals)

```js
// src/tui/v3/state.mjs
export function createState() {
  return {
    currentTab: 0,
    mode: "focus",            // "focus" | "input" | "search" | "log"
    scrollOffsets: {},        // tabId -> integer
    cursor: {},               // tabId -> itemId
    status: null,             // { message, kind, ts, duration }
    statusHistory: [],        // array of status objects
    input: null,              // { spec, buffer, cursor, error }
    actionInFlight: false,
    search: null,             // { tabId, query, filteredIds }
  };
}

export function getCursorItemId(state, tabId, items) {
  const id = state.cursor[tabId];
  if (id && items.some((i) => i.id === id)) return id;
  return items[0]?.id ?? null;
}
```

Why: tests can create a state, mutate it, and assert on the result without
importing the framework module.

### 4.2 Line Budget v2 (single source of truth)

The budget records selectable positions as a side effect of rendering.

```js
// src/tui/v3/panel-utils.mjs
export function makeLineBudget(term, scrollOffset = 0) {
  const max = contentMaxLines(term);
  let logical = 0;
  let drawn = 0;
  const items = [];

  return {
    okLine() {
      logical++;
      if (logical <= scrollOffset) return false;
      drawn++;
      return drawn > max;
    },
    tag(id, label) {
      items.push({ id, label, logicalLine: logical + 1, drawnLine: drawn + 1 });
    },
    get items() { return items; },
    get totalLines() { return logical; },
    get drawnLines() { return drawn; },
  };
}
```

Panel usage example:

```js
// src/tui/v3/provider.mjs
export async function renderPanel(term, state, budget) {
  const cache = await getCachedStatus();
  const configured = cache.filter((p) => p.configured);
  // ...
  for (const p of configured) {
    if (budget.okLine()) return;
    budget.tag(p.id, p.label);          // ← records position
    drawRow(term, p);
  }
}
```

The framework no longer calls `panel.getSelectableItems()` or
`panel.getScrollInfo()`. It reads `budget.items` and `budget.totalLines` after
the render completes:

```js
// framework.mjs
const budget = makeLineBudget(term, scrollOffset);
await mod.renderPanel(term, state, budget);
const items = budget.items;
const totalLines = budget.totalLines;
```

This eliminates A3 entirely.

### 4.3 Mode Objects

Replace the implicit if-else ladder with explicit mode objects.

```js
// src/tui/v3/modes/focus.mjs
export const focusMode = {
  onEnter(ctx) { ctx.renderScreen(); },

  onKey(ctx, key) {
    if (key === "UP" || key === "DOWN") {
      ctx.moveCursor(key === "UP" ? -1 : 1);
    } else if (key === "LEFT" || key === "SHIFT_TAB") {
      ctx.switchTab(-1);
    } else if (key === "RIGHT" || key === "TAB") {
      ctx.switchTab(1);
    } else if (key === "ENTER") {
      ctx.invokeAction();
    } else if (key === "PAGE_UP") {
      ctx.scrollPage(-1);
    } else if (key === "PAGE_DOWN") {
      ctx.scrollPage(1);
    } else if (key === "HOME") {
      ctx.scrollTo(0);
    } else if (key === "END") {
      ctx.scrollTo(Infinity);
    } else if (/^[1-6]$/.test(key)) {
      ctx.jumpToTab(Number(key) - 1);
    } else if (key === "/") {
      ctx.setMode("search");
    } else if (key === "l") {
      ctx.setMode("log");
    } else if (key === "F5") {
      ctx.refreshTab();
    }
  },

  onExit(ctx) { /* nothing */ },
};
```

```js
// src/tui/v3/modes/input.mjs
export const inputMode = {
  onEnter(ctx) { ctx.state.input = { buffer: "", cursor: 0, error: null }; },

  onKey(ctx, key) {
    const { input } = ctx.state;
    if (key === "ENTER") {
      ctx.submitInput();
    } else if (key === "ESCAPE") {
      ctx.cancelInput();
    } else if (key === "BACKSPACE") {
      if (input.cursor > 0) {
        input.buffer = input.buffer.slice(0, input.cursor - 1) + input.buffer.slice(input.cursor);
        input.cursor--;
      }
    } else if (key === "DELETE") {
      input.buffer = input.buffer.slice(0, input.cursor) + input.buffer.slice(input.cursor + 1);
    } else if (key === "LEFT") {
      input.cursor = Math.max(0, input.cursor - 1);
    } else if (key === "RIGHT") {
      input.cursor = Math.min(input.buffer.length, input.cursor + 1);
    } else if (key === "HOME" || key === "CTRL_A") {
      input.cursor = 0;
    } else if (key === "END" || key === "CTRL_E") {
      input.cursor = input.buffer.length;
    } else if (key.length === 1 && key >= " " && key <= "~") {
      input.buffer = input.buffer.slice(0, input.cursor) + key + input.buffer.slice(input.cursor);
      input.cursor++;
    }
    ctx.renderScreen();
  },
};
```

The framework dispatcher becomes:

```js
const MODES = {
  focus: focusMode,
  input: inputMode,
  search: searchMode,
  log: logMode,
};

function setMode(ctx, nextMode) {
  MODES[ctx.state.mode]?.onExit?.(ctx);
  ctx.state.mode = nextMode;
  MODES[nextMode]?.onEnter?.(ctx);
}
```

### 4.4 Async Action Lock

```js
// src/tui/v3/framework.mjs
async function invokeAction(ctx) {
  if (ctx.state.actionInFlight) return;   // ignore additional triggers

  const itemId = getCursorItemId(ctx.state, currentTabId(), ctx.items);
  if (!itemId) return;

  ctx.state.actionInFlight = true;
  ctx.renderScreen();                      // show spinner immediately

  try {
    const result = await mod.handleAction(term, itemId);
    if (result && typeof result === "object" && result.input) {
      ctx.state.inputSpec = result;
      setMode(ctx, "input");
      return;
    }
    if (result) showStatus(ctx, result, result.startsWith("Error:") ? "error" : "success");
  } catch (err) {
    showStatus(ctx, `Error: ${err.message}`, "error");
  } finally {
    ctx.state.actionInFlight = false;
    ctx.renderScreen();
  }
}
```

This fixes P0 (no feedback) and P0 (race condition) at once.

### 4.5 Design Tokens

```js
// src/tui/v3/theme.mjs
export const theme = {
  chrome: {
    header:     { bg: "bgBlack", fg: "brightWhite" },
    tabBar:     { bg: "bgGray",  fg: "brightCyan", activeBg: "bgBrightWhite", activeFg: "black" },
    footer:     { bg: "bgGray",  fg: "brightCyan" },
    statusLine: { bg: "bgBlack", fg: "white" },
  },
  content: {
    sectionHeader: { fg: "brightCyan", marker: "─ " },
    hint:          { fg: "gray" },
    command:       { fg: "cyan" },
  },
  item: {
    bullet:        "●",
    selectable:    { fg: "brightWhite", marker: "› " },
    focused:       { bg: "bgBrightWhite", fg: "black", marker: "▸ " },
  },
  status: {
    info:    { fg: "brightCyan",  icon: "ℹ", duration: 2500 },
    success: { fg: "brightGreen", icon: "✓", duration: 2500 },
    error:   { fg: "brightRed",   icon: "✗", duration: 5000 },
  },
  state: {
    ok:    { bulletFg: "brightGreen" },
    warn:  { bulletFg: "yellow" },
    error: { bulletFg: "brightRed" },
  },
  modal: {
    border: { fg: "brightCyan", h: "─", v: "│", tl: "┌", tr: "┐", bl: "└", br: "┘" },
    title:  { bg: "bgBrightCyan", fg: "black" },
    body:   { bg: "bgBlack", fg: "white" },
  },
};
```

Panels consume tokens instead of hard-coding colors. This fixes A8.

---

## 5. New Interaction Model

### 5.1 Focus Mode (default)

A visible cursor is always present when the current panel has selectable items.

```
 Dashboard   Network   Vault(3)   Providers   Tools   Projects
────────────────────────────────────────────────────────────────
  ▸ Claude Code       installed  v1.2.3
    OpenCode           not installed
    GitHub CLI         authenticated
    Network            proxy set
────────────────────────────────────────────────────────────────
  3 credentials  |  1 provider  |  2 mirrors
────────────────────────────────────────────────────────────────
  ↑↓ Move · Enter Action · / Search · 1-6 Tab · q Quit
```

Key mapping:

| Key | Action |
|-----|--------|
| `↑` / `↓` | Move cursor; auto-scroll to keep it visible |
| `←` / `→` / `Shift+Tab` / `Tab` | Switch tab |
| `Enter` | Execute action on focused item |
| `PgUp` / `PgDn` | Scroll one page |
| `Home` / `End` | Jump to top/bottom of list |
| `1`–`6` | Jump to tab |
| `/` | Enter search mode |
| `l` | Show status log overlay |
| `F5` | Refresh current tab |
| `q` / `Esc` / `Ctrl+C` | Quit (with confirmation if action in flight) |

### 5.2 Always-visible affordance

Every selectable row renders with a leading `›`. The focused row renders with
`▸` and an inverted background. Non-selectable rows have no marker.

```js
function drawItemRow(term, theme, item, isFocused, parts) {
  const style = isFocused ? theme.item.focused : theme.item.selectable;
  term.styleReset();
  if (style.bg) term[style.bg]();
  term[style.fg]();
  term(style.marker);
  // ... render parts
  term("\n");
}
```

### 5.3 Cursor scroll behavior

When the cursor moves, the framework computes the item's logical line from
`budget.items` and adjusts `scrollOffset` so the item is visible with at least
one line of context below it (unless it is the last item).

```js
function ensureCursorVisible(ctx) {
  const item = ctx.items.find((i) => i.id === ctx.cursorItemId);
  if (!item) return;

  const viewport = contentMaxLines(term);
  const line = item.logicalLine - 1; // 0-based
  const offset = ctx.state.scrollOffsets[currentTabId()] ?? 0;

  if (line < offset) {
    ctx.state.scrollOffsets[currentTabId()] = line;
  } else if (line >= offset + viewport) {
    ctx.state.scrollOffsets[currentTabId()] = line - viewport + 1;
  }
}
```

---

## 6. Component Refactor Details

### 6.1 Status System v2

Split the footer into two lines:

```
Line H-1:  ℹ  Status message goes here            (dedicated status line)
Line H:    ↑↓ Move · Enter Action · q Quit        (permanent key hints)
```

```js
function drawStatusLine(ctx) {
  const { status } = ctx.state;
  const spec = status ? theme.status[status.kind] : null;
  const text = status ? `${spec.icon} ${status.message}` : "";

  term.moveTo(1, term.height - 1);
  term.styleReset();
  term.bgBlack();
  if (spec) term[spec.fg](text.padEnd(term.width));
  else term.black(" ".repeat(term.width));
}
```

Status kinds have different timeouts and colors. Errors persist 5 seconds.
All status messages are appended to `state.statusHistory`.

### 6.2 Bordered Modal

```
┌─ Connect OpenAI ─────────────────────────────┐
│  API key: sk-•••••••••••••••••••••           │
│                                              │
│  ✓ Enter submit    ✗ Esc cancel              │
└──────────────────────────────────────────────┘
```

Implementation sketch:

```js
function drawInputModal(ctx) {
  const { title, prompt, password } = ctx.state.inputSpec;
  const display = password ? "•".repeat(ctx.state.input.buffer.length) : ctx.state.input.buffer;
  const width = Math.min(60, term.width - 4);
  const boxHeight = 5;
  const row = Math.floor((term.height - boxHeight) / 2);

  // top border
  term.moveTo(2, row);
  term(theme.modal.border.tl + theme.modal.border.h.repeat(width - 2) + theme.modal.border.tr);

  // title line
  term.moveTo(3, row + 1);
  term.brightBlack(" " + title.padEnd(width - 4) + " ");

  // input line
  term.moveTo(3, row + 2);
  term.black(" ".repeat(width - 2));
  term.moveTo(3, row + 2);
  term.white(prompt + display);

  // error / hint line
  term.moveTo(3, row + 3);
  term.black(" ".repeat(width - 2));
  term.moveTo(3, row + 3);
  if (ctx.state.input.error) term.red(ctx.state.input.error);
  else term.gray("Enter submit · Esc cancel");

  // bottom border
  term.moveTo(2, row + 4);
  term(theme.modal.border.bl + theme.modal.border.h.repeat(width - 2) + theme.modal.border.br);
}
```

Long input values horizontally scroll inside the field.

### 6.3 Tab Bar with Badges

```js
function drawTabBar(ctx) {
  const badges = computeTabBadges(ctx); // { vault: 3, providers: { count: 2, error: true } }
  // ... render labels with optional "(3)" or "!"
}
```

Badges come from a lightweight summary object refreshed with each render:

```js
// panel contract addition
export async function getTabSummary() {
  const cache = await getCachedStatus();
  return {
    count: cache.count,
    error: cache.some((p) => p.configured && !p.reachable),
  };
}
```

---

## 7. Feature Expansion

### 7.1 In-TUI Empty-State Actions

Empty panels expose a primary action that opens the input modal directly.

| Panel | Empty State | Action |
|-------|-------------|--------|
| Vault | "No credentials stored" | Enter → prompt for key name + value |
| Providers | "No providers configured" | Enter on available provider → connect modal |
| Projects | Static hints | Add "Create sample project" action |

### 7.2 Search / Filter Mode

Pressing `/` enters search mode. The user types a query; only items whose
labels match remain visible. `Enter` selects the first match, `Esc` clears.

```js
const searchMode = {
  onEnter(ctx) { ctx.state.search = { query: "", filteredIds: null }; },
  onKey(ctx, key) {
    if (key === "ESCAPE") ctx.setMode("focus");
    else if (key === "ENTER") ctx.selectFirstMatch();
    else if (key === "BACKSPACE") ctx.state.search.query = ctx.state.search.query.slice(0, -1);
    else if (key.length === 1) ctx.state.search.query += key;
    ctx.updateSearch();
    ctx.renderScreen();
  },
};
```

### 7.3 Status History Log

Pressing `l` opens a half-screen overlay listing the last 20 status messages
with timestamps. `Esc` or `q` closes it.

### 7.4 Refresh Indicator

When `F5` is pressed or a panel cache is stale, a small spinner appears in the
header or tab bar until the render completes.

---

## 8. Panel Contract v2

Every panel implements:

```ts
interface Panel {
  // Required: render content. Mutates terminal and budget.
  renderPanel(term: Terminal, state: State, budget: LineBudget): Promise<void>;

  // Optional: return a lightweight summary for tab badges.
  getTabSummary?(): Promise<TabSummary>;

  // Optional: perform the focused item's action.
  // Returns: string status, { input, continue(value) } for modal, or null.
  handleAction?(term: Terminal, itemId: string): Promise<ActionResult>;
}
```

No `getSelectableItems` or `getScrollInfo` — those are derived from `budget`.

---

## 9. Migration Strategy

### Phase 1 — Foundation (no visible UX change)

1. Create `src/tui/v3/` directory.
2. Implement `state.mjs`, `theme.mjs`, `panel-utils.mjs` (line budget v2).
3. Port `framework.mjs` with state object + async lock + mode objects.
4. Port one panel (`projects.mjs`) as a trivial proof of contract.
5. Wire CLI to `src/tui/v3/framework.mjs` behind a flag or replace v2.

**Exit criteria:** `npm run ci` passes; non-TTY smoke test passes.

### Phase 2 — Focus-Cursor Model

1. Remove navigate/select split. Implement `focusMode` as the default.
2. Port all panels to render selectable markers and use `budget.tag()`.
3. Implement auto-scroll on cursor move.
4. Update footer to permanent hints + dedicated status line.

**Exit criteria:** manual smoke test of cursor movement and actions on every tab.

### Phase 3 — Polish

1. Bordered input modal with horizontal scroll.
2. Color-coded status messages with history.
3. Tab badges.
4. Empty-state actions.

**Exit criteria:** error/success states visually distinct; empty Vault can add a
credential from the TUI.

### Phase 4 — Expansion

1. Search mode.
2. Digit-key tab jumps.
3. Refresh spinner.
4. Confirmation on quit when action is in flight.

**Exit criteria:** `/` filters items; `l` shows history; `q` confirms during async.

---

## 10. Risks & Trade-offs

| Risk | Mitigation |
|------|------------|
| Focus-cursor model conflicts with small viewports where content fits. | If `totalLines <= viewport`, cursor still moves but scroll stays at 0. |
| terminal-kit key names for `PAGE_UP`/`HOME`/digits may vary by terminal. | Test on common terminals (iTerm2, Windows Terminal, GNOME Terminal, VS Code). Add config fallbacks. |
| Removing `getSelectableItems`/`getScrollInfo` breaks any external consumers. | These are internal v2 APIs; no public contract is documented. Verify with `grep -r`. |
| Async lock prevents concurrent actions but not cancellation. | Document limitation; later add `AbortController` if needed. |
| Heavy refactor may introduce regressions in panel rendering. | Keep v2 files until v3 is fully validated; use feature flag if necessary. |

---

## 11. Acceptance Criteria

- [ ] `npm run ci` passes after each phase.
- [ ] Non-TTY launch exits 0 with no crash.
- [ ] A first-time user can identify which rows are actionable within 3 seconds.
- [ ] Pressing `↑`/`↓` always moves a visible cursor; never silently scrolls only.
- [ ] Long-running actions show a loading indicator and block concurrent triggers.
- [ ] Errors are red, successes are green, and errors persist at least 5 seconds.
- [ ] Modal input supports left/right/home/end and does not clip long values.
- [ ] Tab bar shows counts and error badges for Vault and Providers.
- [ ] Empty Vault panel allows adding a credential without leaving the TUI.
- [ ] Search mode filters the current panel's items in real time.

---

## 12. Immediate Next Steps

1. Create `src/tui/v3/` and land Phase 1 files.
2. Update `src/cli.mjs` to import `src/tui/v3/framework.mjs`.
3. Run `npm run ci` and non-TTY smoke test.
4. Open a PR for Phase 1 review before proceeding to Phase 2.
