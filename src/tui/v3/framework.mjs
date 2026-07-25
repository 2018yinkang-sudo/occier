import termkit from "terminal-kit";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { CONTENT_START, contentMaxLines, makeLineBudget } from "./panel-utils.mjs";
import { createState, getCursorItemId, getScrollOffset, setScrollOffset } from "./state.mjs";
import { theme } from "./theme.mjs";
import { focusMode } from "./modes/focus.mjs";
import { inputMode } from "./modes/input.mjs";
import { searchMode } from "./modes/search.mjs";
import { logMode } from "./modes/log.mjs";
import { selectMode } from "./modes/select.mjs";

const term = termkit.terminal;

const _thisFile = fileURLToPath(import.meta.url);
const pkg = JSON.parse(
  readFileSync(join(dirname(_thisFile), "..", "..", "..", "package.json"), "utf-8"),
);
const VERSION = pkg.version;

const TABS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "network", label: "Network" },
  { id: "vault", label: "Vault" },
  { id: "providers", label: "Providers" },
  { id: "tools", label: "Tools" },
  { id: "projects", label: "Projects" },
];

const MOD_MAP = {
  dashboard: "./dashboard.mjs",
  network: "./network.mjs",
  vault: "./vault.mjs",
  providers: "./provider.mjs",
  tools: "./tools.mjs",
  projects: "./projects.mjs",
};

let _state = createState();
let _cacheGen = 0;
let _switchTimer = null;
let _statusTimer = null;
let _loadedPanels = {};
let _rendering = false;
let _renderDirty = false;
let _loadGen = 0;

const SPINNER_FRAMES = ["⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏"];

const MODES = {
  focus: focusMode,
  input: inputMode,
  search: searchMode,
  log: logMode,
  select: selectMode,
};

// ── Public API ──

export function startDashboard(initialTab = 0) {
  _state = createState();
  _state.currentTab = initialTab;

  term.fullscreen(true);
  term.hideCursor();
  term.grabInput(true);
  term.clear();

  term.on("key", async (key) => {
    if (_state.mode === "input") {
      if (key === "CTRL_C") {
        exitDashboard();
        return;
      }
      MODES.input.onKey(makeCtx(), key);
      return;
    }

    if (key === "CTRL_C") {
      exitDashboard();
      return;
    }

    if (_state.mode !== "focus" && (key === "ESCAPE" || key === "q")) {
      // Let the active mode handle it (search adds 'q', log closes, input cancels)
      const mode = MODES[_state.mode];
      if (mode) mode.onKey(makeCtx(), key);
      return;
    }

    if (key === "ESCAPE" || key === "q") {
      if (_state.actionInFlight) {
        showStatus("Action in progress — wait or press Ctrl+C to force quit", "error");
        return;
      }
      exitDashboard();
      return;
    }

    const mode = MODES[_state.mode];
    if (mode) mode.onKey(makeCtx(), key);
  });

  term.on("resize", () => renderScreen());

  switchTab(_state.currentTab);
  preloadPanelSummaries();
}

// Background-preload all panel modules so switching tabs is instant (no
// dynamic import latency on first visit). Non-blocking: fires after the
// initial render completes.
async function preloadPanelSummaries() {
  for (const modPath of Object.values(MOD_MAP)) {
    try {
      if (!_loadedPanels[modPath]) {
        _loadedPanels[modPath] = await import(modPath);
      }
    } catch { /* ignore — will load on demand */ }
  }
}

export function exitDashboard() {
  term.grabInput(false);
  term.hideCursor(false);
  term.fullscreen(false);
  term.styleReset();
  term.clear();
  term("\n");
  process.exit(0);
}

export function switchTab(index) {
  switchTabAbsolute(index);
}

function switchTabAbsolute(index) {
  if (index < 0 || index >= TABS.length) return;
  _state.currentTab = index;
  if (_switchTimer) {
    clearTimeout(_switchTimer);
    _switchTimer = null;
  }
  _switchTimer = setTimeout(() => {
    _switchTimer = null;
    renderScreen();
  }, 25);
}

export function getCurrentTab() {
  return TABS[_state.currentTab].id;
}

// ── Context passed to mode handlers ──

function makeCtx() {
  return {
    state: _state,
    term,
    currentTabId,
    setMode,
    tabCount: TABS.length,
    switchTab: (delta) => {
      const next = (_state.currentTab + delta + TABS.length) % TABS.length;
      switchTabAbsolute(next);
    },
    jumpToTab: (index) => switchTabAbsolute(index),
    scrollContent,
    scrollPage: (deltaPages) => scrollContent(deltaPages * contentMaxLines(term)),
    scrollTo: (offset) => scrollContentTo(offset),
    moveCursor,
    ensureCursorVisible,
    getSelectableItems,
    invokeAction,
    submitInput,
    cancelInput,
    confirmSelect,
    cancelSelect,
    showStatus,
    refreshTab,
    renderScreen,
  };
}

// ── Mode transitions ──

function setMode(nextMode) {
  const prev = MODES[_state.mode];
  if (prev && typeof prev.onExit === "function") prev.onExit(makeCtx());
  _state.mode = nextMode;
  const next = MODES[nextMode];
  if (next && typeof next.onEnter === "function") next.onEnter(makeCtx());
}

// ── Rendering ──
// Serialized render: only one render runs at a time. Requests during an
// in-flight render are coalesced into a single follow-up render. This
// eliminates the duplicate-content / ghost-frame bug caused by interleaved
// async renders (term.clear() from render N+1 between panel draws of N).

function startLoadingAnimation() {
  let frame = 0;
  return setInterval(() => {
    const w = Number.isFinite(term.width) ? term.width : 80;
    term.moveTo(1, CONTENT_START);
    term.styleReset();
    term.bgBlack();
    term.gray(`  ${SPINNER_FRAMES[frame]} Loading…`);
    term.black(" ".repeat(Math.max(0, w - 14)));
    term.styleReset();
    term.hideCursor();
    frame = (frame + 1) % SPINNER_FRAMES.length;
  }, 100);
}

function stopLoadingAnimation(timer) {
  clearInterval(timer);
}

function isPanelCached(tabId) {
  const modPath = MOD_MAP[tabId];
  if (!modPath) return true;
  const mod = _loadedPanels[modPath];
  if (!mod || typeof mod.isCached !== "function") return true;
  return mod.isCached();
}

function renderScreen() {
  if (_rendering) {
    _renderDirty = true;
    return Promise.resolve();
  }
  return _runRender();
}

async function _runRender() {
  _rendering = true;
  do {
    _renderDirty = false;
    await _doRender();
  } while (_renderDirty);
  _rendering = false;
}

async function _doRender() {
  const tabId = currentTabId();
  const scrollOffset = getScrollOffset(_state, tabId);
  const cached = isPanelCached(tabId);
  const cursorWasUnset = _state.cursor[tabId] === undefined;

  // Skeleton: draw instantly. When the panel data is not cached the content
  // area shows a spinner animation until await loadPanel resolves.
  term.clear();
  drawHeader();
  drawTabBar();
  drawFooter();
  drawStatusLine();

  if (!cached) {
    const animTimer = startLoadingAnimation();
    const gen = ++_loadGen;
    term.moveTo(1, CONTENT_START);
    await loadPanel(tabId, scrollOffset);
    stopLoadingAnimation(animTimer);
    if (gen !== _loadGen) return; // tab was switched during load
  } else {
    term.moveTo(1, CONTENT_START);
    await loadPanel(tabId, scrollOffset);
  }

  const cursorJustInitialized = cursorWasUnset && _state.cursor[tabId] !== undefined;

  // Modals override normal chrome.
  if (_state.mode === "input" && _state.input?.spec) {
    drawInputModal();
  } else if (_state.mode === "select" && _state.select) {
    drawSelectModal();
  } else {
    term.hideCursor();
    if (_state.mode === "log") {
      drawLogOverlay();
    }
    if (_state.mode === "search") {
      drawSearchBar();
    } else {
      drawStatusLine();
    }
    drawFooter();
    try { term.eraseDisplayAfter(); } catch { /* non-TTY: skip */ }
  }

  // Refresh tab bar after load for the freshest badge.
  drawTabBar();

  if (cursorJustInitialized) {
    _renderDirty = true;
  }
}

function drawSearchBar() {
  const w = Number.isFinite(term.width) ? term.width : 80;
  const h = Number.isFinite(term.height) ? term.height : 24;
  const query = _state.search?.query || "";
  term.moveTo(1, h - 1);
  term.styleReset();
  term[theme.chrome.statusLine.bg]();
  term.brightWhite(`  /${query}`);
  const pad = Math.max(0, w - 3 - query.length);
  if (pad > 0) term.black(" ".repeat(pad));
  term.styleReset();
}

function drawLogOverlay() {
  const w = Number.isFinite(term.width) ? term.width : 80;
  const h = Number.isFinite(term.height) ? term.height : 24;
  const overlayHeight = Math.min(16, h - 5);
  const startRow = Math.max(3, h - 2 - overlayHeight);

  // Clear overlay area
  for (let r = startRow; r < startRow + overlayHeight; r++) {
    term.moveTo(1, r);
    term.styleReset();
    term.bgBlack();
    term(" ".repeat(w));
  }

  // Title bar
  term.moveTo(1, startRow);
  term.styleReset();
  term.bgBrightWhite();
  term.black("  Status Log ".padEnd(w));
  term.styleReset();

  // Messages
  const messages = _state.statusHistory.slice(-(overlayHeight - 2));
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const spec = theme.status[msg.kind] || theme.status.info;
    const time = new Date(msg.ts).toLocaleTimeString();
    const line = `  ${spec.icon} ${time}  ${msg.message}`;
    term.moveTo(1, startRow + 1 + i);
    term.styleReset();
    term.bgBlack();
    term[spec.fg](line.slice(0, w));
    term.black(" ".repeat(Math.max(0, w - line.length)));
  }

  // Help line
  term.moveTo(1, startRow + overlayHeight - 1);
  term.styleReset();
  term.bgGray();
  term.brightCyan("  Esc / q / l / Enter to close  ".padEnd(w));
  term.styleReset();
}

function drawHeader() {
  const w = Number.isFinite(term.width) ? term.width : 80;
  const tab = TABS[_state.currentTab];
  term.moveTo(1, 1);
  term.styleReset();
  term[theme.chrome.header.bg]();
  term[theme.chrome.header.fg]();
  term.bold();
  const spinner = _state.actionInFlight ? " ⟳" : "";
  const text = `  occier  v${VERSION} —  ${tab.label}${spinner} `;
  term.white(text);
  const pad = Math.max(0, w - text.length);
  if (pad > 0) term.white(" ".repeat(pad));
  term.styleReset();
}

function drawTabBar() {
  const w = Number.isFinite(term.width) ? term.width : 80;
  term.moveTo(1, 2);
  term.styleReset();
  term[theme.chrome.tabBar.bg]();

  const gap = w < 60 ? " " : "  ";
  let consumed = 0;
  for (let i = 0; i < TABS.length; i++) {
    const tab = TABS[i];
    const isActive = i === _state.currentTab;
    if (isActive) {
      term[theme.chrome.tabBar.activeBg]();
      term[theme.chrome.tabBar.activeFg]();
    } else {
      term[theme.chrome.tabBar.bg]();
      term[theme.chrome.tabBar.fg]();
    }
    // Build label with optional badge
    const mod = _loadedPanels[MOD_MAP[tab.id]];
    let label = tab.label;
    let suffix = "";
    if (mod && typeof mod.getTabSummary === "function") {
      try {
        const summary = mod.getTabSummary();
        if (summary && summary.count > 0) {
          suffix = `(${summary.count})`;
        }
        if (summary && summary.error) {
          suffix = suffix ? `${suffix}!` : "(!)";
        }
      } catch { /* ignore errors from getTabSummary */ }
    }
    const cell = `${gap}${label}${suffix}${gap}`;
    term(cell);
    consumed += cell.length;
  }

  // Fill remaining width so the whole tab-bar row has a consistent background.
  const pad = Math.max(0, w - consumed);
  if (pad > 0) {
    term[theme.chrome.tabBar.bg]();
    term[theme.chrome.tabBar.fg](" ".repeat(pad));
  }
  term.styleReset();
}

function drawFooter() {
  const w = Number.isFinite(term.width) ? term.width : 80;
  const h = Number.isFinite(term.height) ? term.height : 24;
  term.moveTo(1, h);
  term.styleReset();
  term[theme.chrome.footer.bg]();

  const full = "  ↑↓ Move · Enter Action · ←→ Tab · PgUp/PgDn · Home/End · F5 Refresh · q Quit  ";
  let text = full;
  if (w < full.length) {
    text = "  ↑↓ Move · Enter Action · ←→ Tab · F5 Refresh · q Quit  ";
  }
  if (w < text.length) {
    text = "  ↑↓ Move · Enter Action · q Quit  ";
  }

  term[theme.chrome.footer.fg](text);
  const pad = Math.max(0, w - text.length);
  if (pad > 0) term.white(" ".repeat(pad));
  term.styleReset();
}

function drawStatusLine() {
  const w = Number.isFinite(term.width) ? term.width : 80;
  const h = Number.isFinite(term.height) ? term.height : 24;
  term.moveTo(1, h - 1);
  term.styleReset();
  term[theme.chrome.statusLine.bg]();

  const st = _state.status;
  if (st) {
    const spec = theme.status[st.kind] || theme.status.info;
    const prefix = `${spec.icon} `;
    const maxMsg = w - prefix.length - 2;
    const msg = st.message.length > maxMsg ? st.message.slice(0, maxMsg) : st.message;
    term[spec.fg](`  ${prefix}${msg}`);
    const used = prefix.length + msg.length + 2;
    const pad = Math.max(0, w - used);
    if (pad > 0) term.black(" ".repeat(pad));
  } else {
    term.black(" ".repeat(w));
  }
  term.styleReset();
}

function drawInputModal() {
  const spec = _state.input.spec;
  const { title, prompt, password } = spec;
  const w = Number.isFinite(term.width) ? term.width : 80;
  const h = Number.isFinite(term.height) ? term.height : 24;
  const boxWidth = Math.min(62, w - 4);
  const boxHeight = 5; // top border + title + input + hint + bottom border
  const row = Math.floor((h - boxHeight) / 2);
  const col = Math.floor((w - boxWidth) / 2) + 1;
  const inner = boxWidth - 2;
  const display = password ? "•".repeat(_state.input.buffer.length) : _state.input.buffer;

  // ── Top border with title ──
  const titleText = ` ${title} `;
  const rightDash = Math.max(0, boxWidth - 2 - titleText.length);
  term.moveTo(col, row);
  term.styleReset();
  term[theme.modal.border.fg](
    theme.modal.border.tl +
    titleText +
    theme.modal.border.h.repeat(rightDash) +
    theme.modal.border.tr,
  );

  // ── Input field with horizontal scroll ──
  const fieldWidth = inner - prompt.length - 2;
  let scrollStart = 0;
  if (display.length > fieldWidth) {
    scrollStart = Math.max(0, _state.input.cursor - Math.floor(fieldWidth / 2));
    if (scrollStart + fieldWidth > display.length) scrollStart = display.length - fieldWidth;
    if (scrollStart < 0) scrollStart = 0;
  }
  const visibleDisplay = display.slice(scrollStart, scrollStart + fieldWidth);
  const displayPad = fieldWidth - visibleDisplay.length;
  const cursorCol = col + 1 + prompt.length + (_state.input.cursor - scrollStart);

  term.moveTo(col, row + 1);
  term[theme.modal.border.fg](theme.modal.border.v);
  term[theme.modal.body.bg]();
  term[theme.modal.body.fg](prompt + visibleDisplay);
  if (displayPad > 0) term.black(" ".repeat(displayPad));
  term[theme.modal.border.fg](theme.modal.border.v);

  // ── Hint / error line ──
  term.moveTo(col, row + 2);
  term[theme.modal.border.fg](theme.modal.border.v);
  term[theme.modal.body.bg]();
  if (_state.input.error) {
    const errPrefix = ` ${_state.input.error}`;
    term.red(errPrefix.slice(0, inner));
    term.black(" ".repeat(Math.max(0, inner - errPrefix.length)));
  } else {
    term[theme.modal.hint.fg](" Enter submit · Esc cancel ".padEnd(inner));
  }
  term[theme.modal.border.fg](theme.modal.border.v);

  // ── Bottom border ──
  term.moveTo(col, row + 3);
  term[theme.modal.border.fg](
    theme.modal.border.bl +
    theme.modal.border.h.repeat(boxWidth - 2) +
    theme.modal.border.br,
  );

  // Position cursor inside the input field
  term.moveTo(cursorCol, row + 1);
  term.hideCursor(false);
}

function drawSelectModal() {
  const sel = _state.select;
  if (!sel) return;
  const { prompt, choices } = sel;
  const cursor = sel.cursor || 0;
  const w = Number.isFinite(term.width) ? term.width : 80;
  const h = Number.isFinite(term.height) ? term.height : 24;
  const boxWidth = Math.min(58, w - 4);
  const maxOptions = Math.max(1, Math.min(choices.length, h - 8));
  const boxHeight = 4 + maxOptions; // top border + prompt + options + hint + bottom border
  const row = Math.floor((h - boxHeight) / 2);
  const col = Math.floor((w - boxWidth) / 2) + 1;
  const inner = boxWidth - 2;

  // Top border with title
  const titleText = prompt ? ` ${prompt} ` : " Select ";
  const rightDash = Math.max(0, boxWidth - 2 - titleText.length);
  term.moveTo(col, row);
  term.styleReset();
  term[theme.modal.border.fg](
    theme.modal.border.tl + titleText + theme.modal.border.h.repeat(rightDash) + theme.modal.border.tr,
  );

  // Options
  const startIdx = Math.max(0, cursor - Math.floor(maxOptions / 2));
  const endIdx = Math.min(choices.length, startIdx + maxOptions);
  for (let i = startIdx; i < endIdx; i++) {
    const isFocused = i === cursor;
    const label = choices[i].label;
    const displayLabel = isFocused ? `▸ ${label}` : `  ${label}`;
    term.moveTo(col, row + 1 + (i - startIdx));
    term[theme.modal.border.fg](theme.modal.border.v);
    term[theme.modal.body.bg]();
    if (isFocused) {
      term[theme.item.focused.bg]();
      term[theme.item.focused.fg](displayLabel);
    } else {
      term[theme.modal.body.fg](displayLabel);
    }
    const pad = Math.max(0, inner - displayLabel.length);
    if (pad > 0) term.black(" ".repeat(pad));
    term[theme.modal.border.fg](theme.modal.border.v);
  }

  // Hint line
  const hintRow = row + 1 + maxOptions;
  term.moveTo(col, hintRow);
  term[theme.modal.border.fg](theme.modal.border.v);
  term[theme.modal.body.bg]();
  term[theme.modal.hint.fg](" Enter select · Esc cancel ".padEnd(inner));
  term[theme.modal.border.fg](theme.modal.border.v);

  // Bottom border
  term.moveTo(col, hintRow + 1);
  term[theme.modal.border.fg](
    theme.modal.border.bl + theme.modal.border.h.repeat(boxWidth - 2) + theme.modal.border.br,
  );

  term.hideCursor(false);
}

// ── Panel loading ──

async function loadPanel(tabId, scrollOffset) {
  const modPath = MOD_MAP[tabId];
  if (!modPath) return;

  if (!_loadedPanels[modPath]) {
    try {
      _loadedPanels[modPath] = await import(modPath);
    } catch (err) {
      term.moveTo(1, CONTENT_START);
      term.red(`Failed to load panel "${tabId}": ${err.message}\n`);
      return;
    }
  }

  const mod = _loadedPanels[modPath];
  if (!mod || typeof mod.renderPanel !== "function") return;

  const cursorItemId = _state.cursor[tabId] ?? null;
  const budget = makeLineBudget(term, scrollOffset);
  budget.setSearchQuery(_state.search?.query || null);

  try {
    await mod.renderPanel(term, { scrollOffset, cursorItemId, mode: _state.mode, forceRefresh: _state.forceRefresh, cacheGen: _cacheGen, searchQuery: _state.search?.query || null }, budget);
  } catch (err) {
    term.moveTo(1, CONTENT_START);
    term.red(`Panel "${tabId}" render error: ${err.message}\n`);
  }

  // Initialize cursor to the first selectable item if not yet set for this tab,
  // or reset if the current cursor points to a deleted item.
  if (budget.items.length > 0) {
    const currentCursor = _state.cursor[tabId];
    if (currentCursor === undefined || !budget.items.some((i) => i.id === currentCursor)) {
      _state.cursor[tabId] = budget.items[0].id;
    }
  }

  _lastBudget = budget;
}

let _lastBudget = null;

function getSelectableItems() {
  if (!_lastBudget) return [];
  return _lastBudget.items;
}

// ── Scrolling ──

function scrollContent(delta) {
  const info = getPanelScrollInfo();
  if (!info || !info.supportsScroll) return;

  const viewportLines = contentMaxLines(term);
  if (info.totalLines <= viewportLines) return;

  const tabId = currentTabId();
  const current = getScrollOffset(_state, tabId);
  const maxOffset = Math.max(0, info.totalLines - viewportLines);
  const next = Math.max(0, Math.min(maxOffset, current + delta));
  if (next !== current) {
    setScrollOffset(_state, tabId, next);
    renderScreen();
  }
}

function scrollContentTo(offset) {
  const info = getPanelScrollInfo();
  if (!info || !info.supportsScroll) return;
  const viewportLines = contentMaxLines(term);
  const maxOffset = Math.max(0, info.totalLines - viewportLines);
  const next = Math.max(0, Math.min(maxOffset, Math.floor(offset)));
  const tabId = currentTabId();
  if (next !== getScrollOffset(_state, tabId)) {
    setScrollOffset(_state, tabId, next);
    renderScreen();
  }
}

function getPanelScrollInfo() {
  if (!_lastBudget) return null;
  const totalLines = _lastBudget.totalLines;
  return { supportsScroll: totalLines > 0, totalLines };
}

// ── Cursor movement ──

function moveCursor(delta) {
  const items = getSelectableItems();
  if (items.length === 0) return;

  const tabId = currentTabId();
  const currentId = getCursorItemId(_state, tabId, items);
  let idx = items.findIndex((i) => i.id === currentId);
  if (idx < 0) idx = 0;

  idx = Math.max(0, Math.min(items.length - 1, idx + delta));
  _state.cursor[tabId] = items[idx].id;
  ensureCursorVisible();
  renderScreen();
}

function ensureCursorVisible() {
  const items = getSelectableItems();
  const itemId = getCursorItemId(_state, currentTabId(), items);
  const item = items.find((i) => i.id === itemId);
  if (!item) return;

  const viewportLines = contentMaxLines(term);
  const line = item.logicalLine - 1; // 0-based
  const offset = getScrollOffset(_state, currentTabId());

  if (line < offset) {
    setScrollOffset(_state, currentTabId(), line);
  } else if (line >= offset + viewportLines) {
    setScrollOffset(_state, currentTabId(), line - viewportLines + 1);
  }
}

// ── Actions ──

async function invokeAction(itemId) {
  if (_state.actionInFlight) return;

  const tabId = currentTabId();
  const modPath = MOD_MAP[tabId];
  const mod = _loadedPanels[modPath];
  if (!mod || typeof mod.handleAction !== "function") return;

  _state.actionInFlight = true;
  renderScreen();

  try {
    const result = await mod.handleAction(term, itemId);

    // If the user switched tabs during the action, discard the result.
    if (currentTabId() !== tabId) return;

    if (result && typeof result === "object" && result.input) {
      _state.input = { spec: result.input, buffer: "", cursor: 0, error: null, continue: result.continue };
      setMode("input");
      return;
    }
    if (result && typeof result === "object" && result.select) {
      _state.select = { ...result.select, cursor: result.select.defaultCursor || 0, continue: result.continue };
      setMode("select");
      return;
    }

    if (result) {
      const kind = typeof result === "string" && result.startsWith("Error:") ? "error" : "success";
      showStatus(result, kind);
      // Note: do NOT bump _cacheGen here. Plain string results from
      // handleAction may be informational (e.g. "switch to Network tab").
      // Panels that mutate state set their own _lastUpdate = 0 for
      // self-invalidation. Cross-panel cacheGen bump only happens after
      // multi-step input/select flows (submitInput / confirmSelect).
    }
  } catch (err) {
    showStatus(`Error: ${err.message}`, "error");
  } finally {
    _state.actionInFlight = false;
    renderScreen();
  }
}

async function submitInput() {
  const continueFn = _state.input.continue;
  const value = _state.input.buffer;
  _state.input = null;
  setMode("focus");

  if (typeof continueFn !== "function") {
    renderScreen();
    return;
  }
  try {
    const result = await continueFn(value);
    if (result && typeof result === "object" && result.input) {
      // Chain to a new input modal (multi-step flow)
      _state.input = { spec: result.input, buffer: "", cursor: 0, error: null, continue: result.continue };
      setMode("input");
      return;
    }
    if (result && typeof result === "object" && result.select) {
      _state.select = { ...result.select, cursor: result.select.defaultCursor || 0, continue: result.continue };
      setMode("select");
      return;
    }
    if (result) {
      const kind = typeof result === "string" && result.startsWith("Error:") ? "error" : "success";
      showStatus(result, kind);
      if (kind === "success") _cacheGen++;
    }
  } catch (err) {
    showStatus(`Error: ${err.message}`, "error");
  }
}

function cancelInput() {
  _state.input = null;
  setMode("focus");
}

async function confirmSelect(value) {
  const continueFn = _state.select?.continue;
  _state.select = null;
  setMode("focus");
  if (typeof continueFn !== "function") return;
  try {
    const result = await continueFn(value);
    if (result && typeof result === "object" && result.input) {
      _state.input = { spec: result.input, buffer: "", cursor: 0, error: null, continue: result.continue };
      setMode("input");
      return;
    }
    if (result && typeof result === "object" && result.select) {
      _state.select = { ...result.select, cursor: result.select.defaultCursor || 0, continue: result.continue };
      setMode("select");
      return;
    }
    if (result) {
      const kind = typeof result === "string" && result.startsWith("Error:") ? "error" : "success";
      showStatus(result, kind);
      if (kind === "success") _cacheGen++;
    }
  } catch (err) {
    showStatus(`Error: ${err.message}`, "error");
  }
}

function cancelSelect() {
  const continueFn = _state.select?.continue;
  _state.select = null;
  setMode("focus");
  if (typeof continueFn === "function") {
    Promise.resolve(continueFn(null))
      .then((result) => {
        if (typeof result === "string") showStatus(result, "info");
      })
      .catch(() => {});
  } else {
    showStatus("Cancelled", "info");
  }
}

// ── Status ──

function showStatus(message, kind = null) {
  if (!kind) {
    kind = typeof message === "string" && message.startsWith("Error:") ? "error" : "success";
  }
  _state.status = { message, kind, ts: Date.now() };
  _state.statusHistory.push(_state.status);
  if (_state.statusHistory.length > 50) _state.statusHistory.shift();

  if (_statusTimer) {
    clearTimeout(_statusTimer);
    _statusTimer = null;
  }
  const duration = (theme.status[kind] || theme.status.info).duration;
  _statusTimer = setTimeout(() => {
    _statusTimer = null;
    _state.status = null;
    renderScreen();
  }, duration);
  renderScreen();
}

// ── Helpers ──

function currentTabId() {
  return TABS[_state.currentTab].id;
}

async function refreshTab() {
  _state.forceRefresh = true;
  try {
    await renderScreen();
  } finally {
    _state.forceRefresh = false;
  }
}
