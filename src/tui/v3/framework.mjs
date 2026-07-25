import termkit from "terminal-kit";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { CONTENT_START, contentMaxLines, makeLineBudget } from "./panel-utils.mjs";
import { createState, getCursorItemId, getScrollOffset, setScrollOffset } from "./state.mjs";
import { theme } from "./theme.mjs";
import { navigateMode } from "./modes/navigate.mjs";
import { selectMode } from "./modes/select.mjs";
import { inputMode } from "./modes/input.mjs";

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
let _renderGen = 0;
let _switchTimer = null;
let _statusTimer = null;
let _loadedPanels = {};

const MODES = {
  navigate: navigateMode,
  select: selectMode,
  input: inputMode,
};

// ── Public API ──

export function startDashboard(initialTab = 0) {
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

    if (key === "CTRL_C" || key === "ESCAPE" || key === "q") {
      if (_state.mode !== "navigate") {
        setMode("navigate");
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
    switchTab,
    scrollContent,
    scrollPage: (deltaPages) => scrollContent(deltaPages * contentMaxLines(term)),
    scrollTo: (offset) => scrollContentTo(offset),
    ensureCursorVisible,
    getSelectableItems,
    invokeAction,
    submitInput,
    cancelInput,
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

async function renderScreen() {
  const gen = ++_renderGen;

  term.clear();
  drawHeader();
  drawTabBar();

  term.moveTo(1, CONTENT_START);

  const tabId = currentTabId();
  const scrollOffset = getScrollOffset(_state, tabId);

  await loadPanel(tabId, scrollOffset, gen);

  if (gen !== _renderGen) return;

  if (_state.mode === "input" && _state.input?.spec) {
    drawInputModal();
  } else {
    term.hideCursor();
    drawFooter();
    try { term.eraseDisplayAfter(); } catch { /* non-TTY: skip */ }
  }
}

function drawHeader() {
  const w = Number.isFinite(term.width) ? term.width : 80;
  const tab = TABS[_state.currentTab];
  term.moveTo(1, 1);
  term.styleReset();
  term[theme.chrome.header.bg]();
  term[theme.chrome.header.fg]();
  term.bold();
  const text = `  occier  v${VERSION} —  ${tab.label} `;
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
    term(`${gap}${tab.label}${gap}`);
  }

  // Fill remaining width so the whole tab-bar row has a consistent background.
  const gapLen = gap.length * 2;
  const consumed = TABS.reduce((acc, t) => acc + gapLen + t.label.length, 0);
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

  let text;
  if (_state.status) {
    text = `  ${_state.status.message}  `;
  } else if (_state.mode === "select") {
    text = "  ↑↓ / Move  Enter:Action  Esc:Back  ";
  } else if (_state.actionInFlight) {
    text = "  Loading…  ";
  } else {
    text = "  ←→ / Tab  ↑↓ / Scroll  Enter:Select  F5:Refresh  q/Esc:Quit  ";
  }

  term[theme.chrome.footer.fg](text);
  const pad = Math.max(0, w - text.length);
  if (pad > 0) term.white(" ".repeat(pad));
  term.styleReset();
}

function drawInputModal() {
  const spec = _state.input.spec;
  const { title, prompt, password } = spec;
  const w = Number.isFinite(term.width) ? term.width : 80;
  const h = Number.isFinite(term.height) ? term.height : 24;
  const row = Math.floor(h / 2);
  const display = password ? "*".repeat(_state.input.buffer.length) : _state.input.buffer;

  term.moveTo(1, row);
  term.styleReset();
  term.bgGray();
  term.brightWhite(title);
  term("\n");
  term.bgGray();
  term.white(prompt);
  term.styleReset();
  term.bgBlack();
  term.white(display);
  const pad = Math.max(0, w - prompt.length - display.length);
  if (pad > 0) term.black(" ".repeat(pad));
  term.styleReset();

  const col = Math.min(prompt.length + _state.input.cursor, w - 1) + 1;
  term.moveTo(col, row + 1);
  term.hideCursor(false);
}

// ── Panel loading ──

async function loadPanel(tabId, scrollOffset, gen) {
  const modPath = MOD_MAP[tabId];
  if (!modPath) return;

  if (!_loadedPanels[modPath]) {
    try {
      _loadedPanels[modPath] = await import(modPath);
    } catch (err) {
      if (gen !== _renderGen) return;
      term.moveTo(1, CONTENT_START);
      term.red(`Failed to load panel "${tabId}": ${err.message}\n`);
      return;
    }
  }

  const mod = _loadedPanels[modPath];
  if (!mod || typeof mod.renderPanel !== "function") return;

  const cursorItemId = _state.mode === "select" ? getCursorItemId(_state, tabId, getSelectableItems()) : null;
  const budget = makeLineBudget(term, scrollOffset);

  try {
    await mod.renderPanel(term, { scrollOffset, cursorItemId, mode: _state.mode }, budget);
  } catch (err) {
    if (gen !== _renderGen) return;
    term.moveTo(1, CONTENT_START);
    term.red(`Panel "${tabId}" render error: ${err.message}\n`);
  }

  if (gen !== _renderGen) return;

  // Store the last budget so mode handlers can read item positions without
  // re-rendering.
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

    // If the user left select mode during the action, discard the result.
    if (_state.mode !== "select") return;

    if (result && typeof result === "object" && result.input) {
      _state.input = { spec: result.input, buffer: "", cursor: 0, error: null, continue: result.continue };
      setMode("input");
      return;
    }

    if (result) showStatus(result);
    setMode("navigate");
  } catch (err) {
    if (_state.mode === "select") {
      showStatus(`Error: ${err.message}`);
      setMode("navigate");
    }
  } finally {
    _state.actionInFlight = false;
    renderScreen();
  }
}

async function submitInput() {
  const continueFn = _state.input.continue;
  const value = _state.input.buffer;
  _state.input = null;
  _state.mode = "navigate";

  let message = null;
  if (typeof continueFn === "function") {
    try {
      message = await continueFn(value);
    } catch (err) {
      message = `Error: ${err.message}`;
    }
  }

  if (message) {
    showStatus(message);
  } else {
    renderScreen();
  }
}

function cancelInput() {
  _state.input = null;
  setMode("navigate");
}

// ── Status ──

function showStatus(message, kind = "info") {
  _state.status = { message, kind, ts: Date.now() };
  _state.statusHistory.push(_state.status);
  if (_state.statusHistory.length > 50) _state.statusHistory.shift();

  if (_statusTimer) {
    clearTimeout(_statusTimer);
    _statusTimer = null;
  }
  const duration = theme.status[kind]?.duration ?? 2000;
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

function refreshTab() {
  // Force a re-render of the current tab. Panels with TTL caches can refresh
  // themselves by checking the passed state/mode; for Phase 1 we simply
  // re-render.
  renderScreen();
}
