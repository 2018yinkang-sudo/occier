import termkit from "terminal-kit";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { CONTENT_START, contentMaxLines } from "./panel-utils.mjs";

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

let _currentTab = 0;
let _renderGen = 0;
let _switchTimer = null;
let _loadedPanels = {};

const MODES = {
  NAVIGATE: "navigate",
  SELECT: "select",
  INPUT: "input",
};
let _mode = MODES.NAVIGATE;
let _scrollOffsets = {}; // tabId -> scroll offset
let _selectedItemIds = {}; // tabId -> selected item id
let _statusMessage = null;
let _statusTimer = null;
let _inputSpec = null;
let _inputBuffer = "";
let _inputCursor = 0;

function setMode(mode) {
  _mode = mode;
  renderScreen();
}

function showStatus(message, duration = 2000) {
  _statusMessage = message;
  if (_statusTimer) {
    clearTimeout(_statusTimer);
    _statusTimer = null;
  }
  _statusTimer = setTimeout(() => {
    _statusTimer = null;
    _statusMessage = null;
    renderScreen();
  }, duration);
  renderScreen();
}

function currentTabId() {
  return TABS[_currentTab].id;
}

// ── Public API ──

export function startDashboard(initialTab = 0) {
  _currentTab = initialTab;

  // Enter fullscreen first, then clear the alternate buffer. Clearing before
  // fullscreen can leave artifacts from the normal screen on the first paint.
  term.fullscreen(true);
  term.hideCursor();
  term.grabInput(true);
  term.clear();

  term.on("key", async (key) => {
    if (_mode === MODES.INPUT) {
      if (key === "CTRL_C") {
        exitDashboard();
        return;
      }
      handleInputKey(key);
      return;
    }

    if (key === "CTRL_C" || key === "ESCAPE" || key === "q") {
      if (_mode !== MODES.NAVIGATE) {
        setMode(MODES.NAVIGATE);
        return;
      }
      exitDashboard();
      return;
    }

    if (_mode === MODES.NAVIGATE) {
      handleNavigateKey(key);
    } else if (_mode === MODES.SELECT) {
      await handleSelectKey(key);
    }
  });

  term.on("resize", () => renderScreen());

  switchTab(_currentTab);
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
  _currentTab = index;
  // Debounce: rapid key presses (e.g. holding arrow keys) should collapse into
  // a single render so the screen does not tear or flash intermediate states.
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
  return TABS[_currentTab].id;
}

// ── Internal rendering ──

async function renderScreen() {
  const gen = ++_renderGen;

  // term.clear() on the alternate screen (fullscreen) is a buffer swap and
  // does not flicker — it simply replaces the visible content in one go.
  term.clear();

  drawHeader();
  drawTabBar();

  // Position the cursor at the start of the content area so async panels
  // cannot write to arbitrary locations on the screen.
  term.moveTo(1, CONTENT_START);

  const tabId = currentTabId();
  const scrollOffset = _scrollOffsets[tabId] || 0;
  const cursorItemId = _selectedItemIds[tabId] ?? null;
  await drawContent({ scrollOffset, cursorItemId, mode: _mode }, gen);

  // If the user has switched tabs since we started, do not paint a stale footer.
  if (gen !== _renderGen) return;

  if (_mode === MODES.INPUT && _inputSpec) {
    drawInputModal();
  } else {
    term.hideCursor();
    drawFooter();
    // Remove any leftover content below the footer from a previous larger panel.
    try { term.eraseDisplayAfter(); } catch { /* non-TTY: erase not available, skip */ }
  }
}

function drawInputModal() {
  const { title, prompt, password } = _inputSpec;
  const w = Number.isFinite(term.width) ? term.width : 80;
  const h = Number.isFinite(term.height) ? term.height : 24;
  const row = Math.floor(h / 2);
  const display = password ? "*".repeat(_inputBuffer.length) : _inputBuffer;

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

  // Position the visible cursor inside the input field.
  const col = Math.min(prompt.length + _inputCursor, w - 1) + 1;
  term.moveTo(col, row + 1);
  term.hideCursor(false);
}

function handleInputKey(key) {
  if (key === "ENTER") {
    submitInput();
    return;
  }
  if (key === "ESCAPE") {
    cancelInput();
    return;
  }
  if (key === "BACKSPACE") {
    if (_inputCursor > 0) {
      _inputBuffer = _inputBuffer.slice(0, _inputCursor - 1) + _inputBuffer.slice(_inputCursor);
      _inputCursor--;
    }
    renderScreen();
    return;
  }
  if (key === "DELETE") {
    if (_inputCursor < _inputBuffer.length) {
      _inputBuffer = _inputBuffer.slice(0, _inputCursor) + _inputBuffer.slice(_inputCursor + 1);
    }
    renderScreen();
    return;
  }
  if (key === "LEFT") {
    _inputCursor = Math.max(0, _inputCursor - 1);
    renderScreen();
    return;
  }
  if (key === "RIGHT") {
    _inputCursor = Math.min(_inputBuffer.length, _inputCursor + 1);
    renderScreen();
    return;
  }
  if (key.length === 1 && key >= " " && key <= "~") {
    _inputBuffer = _inputBuffer.slice(0, _inputCursor) + key + _inputBuffer.slice(_inputCursor);
    _inputCursor++;
    renderScreen();
  }
}

async function submitInput() {
  const spec = _inputSpec;
  const value = _inputBuffer;
  _inputSpec = null;
  _inputBuffer = "";
  _inputCursor = 0;
  _mode = MODES.NAVIGATE;

  let message = null;
  if (spec && spec.continue) {
    try {
      message = await spec.continue(value);
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
  _inputSpec = null;
  _inputBuffer = "";
  _inputCursor = 0;
  setMode(MODES.NAVIGATE);
}

function drawContent(state = {}, gen) {
  const modPath = MOD_MAP[TABS[_currentTab].id];
  if (!modPath) return Promise.resolve();
  return loadPanel(modPath, state, gen);
}

function handleNavigateKey(key) {
  if (key === "LEFT" || key === "SHIFT_TAB") {
    switchTab((_currentTab - 1 + TABS.length) % TABS.length);
  } else if (key === "RIGHT" || key === "TAB") {
    switchTab((_currentTab + 1 + TABS.length) % TABS.length);
  } else if (key === "F5") {
    switchTab(_currentTab);
  } else if (key === "UP") {
    scrollContent(-1);
  } else if (key === "DOWN") {
    scrollContent(1);
  } else if (key === "ENTER") {
    const items = getSelectableItems();
    if (items.length > 0) {
      const tabId = currentTabId();
      if (_selectedItemIds[tabId] === undefined) {
        _selectedItemIds[tabId] = items[0].id;
      }
      setMode(MODES.SELECT);
    }
  }
}

async function handleSelectKey(key) {
  const items = getSelectableItems();
  if (items.length === 0) {
    setMode(MODES.NAVIGATE);
    return;
  }

  const tabId = currentTabId();
  let idx = items.findIndex((i) => i.id === _selectedItemIds[tabId]);
  if (idx < 0) idx = 0;

  if (key === "UP") {
    idx = Math.max(0, idx - 1);
  } else if (key === "DOWN") {
    idx = Math.min(items.length - 1, idx + 1);
  } else if (key === "ENTER") {
    const item = items[idx];
    const result = await invokeAction(item.id);
    // If the user left select mode during the action (e.g. ESC), discard result.
    if (_mode !== MODES.SELECT) return;
    if (result && typeof result === "object" && result.input) {
      _inputSpec = { ...result.input, continue: result.continue };
      _inputBuffer = "";
      setMode(MODES.INPUT);
      return;
    }
    if (result) showStatus(result);
    setMode(MODES.NAVIGATE);
    return;
  } else if (key === "ESCAPE") {
    setMode(MODES.NAVIGATE);
    return;
  } else {
    return;
  }

  _selectedItemIds[tabId] = items[idx].id;
  scrollToVisibleLine(items[idx].line);
  renderScreen();
}

async function invokeAction(itemId) {
  const modPath = MOD_MAP[TABS[_currentTab].id];
  const mod = _loadedPanels[modPath];
  if (!mod || typeof mod.handleAction !== "function") return null;
  try {
    return await mod.handleAction(term, itemId);
  } catch (err) {
    return `Error: ${err.message}`;
  }
}

function scrollToVisibleLine(line) {
  const viewportLines = contentMaxLines(term);
  const tabId = currentTabId();
  const current = _scrollOffsets[tabId] || 0;
  // line is 1-based; current is the number of logical lines already scrolled past.
  if (line <= current + 1) {
    _scrollOffsets[tabId] = Math.max(0, line - 1);
  } else if (line > current + viewportLines) {
    _scrollOffsets[tabId] = Math.max(0, line - viewportLines);
  }
}

function getSelectableItems() {
  const modPath = MOD_MAP[TABS[_currentTab].id];
  const mod = _loadedPanels[modPath];
  if (!mod || typeof mod.getSelectableItems !== "function") return [];
  try {
    return mod.getSelectableItems();
  } catch {
    return [];
  }
}

function scrollContent(delta) {
  const info = getPanelScrollInfo();
  if (!info || !info.supportsScroll) return;

  const viewportLines = contentMaxLines(term);
  if (info.totalLines <= viewportLines) return;

  const tabId = currentTabId();
  const current = _scrollOffsets[tabId] || 0;
  const maxOffset = Math.max(0, info.totalLines - viewportLines);
  const next = Math.max(0, Math.min(maxOffset, current + delta));
  if (next !== current) {
    _scrollOffsets[tabId] = next;
    renderScreen();
  }
}

function getPanelScrollInfo() {
  const modPath = MOD_MAP[TABS[_currentTab].id];
  const mod = _loadedPanels[modPath];
  if (!mod || typeof mod.getScrollInfo !== "function") return null;
  try {
    return mod.getScrollInfo();
  } catch {
    return null;
  }
}

async function loadPanel(modPath, state = {}, gen) {
  try {
    let mod = _loadedPanels[modPath];
    if (!mod) {
      mod = await import(modPath);
      _loadedPanels[modPath] = mod;
    }
    if (gen !== _renderGen) return;
    if (mod && typeof mod.renderPanel === "function") {
      await mod.renderPanel(term, state);
      return;
    }
    term.styleReset();
    term.bgBlack();
    term.red("  Panel module missing renderPanel export\n");
  } catch (err) {
    if (gen !== _renderGen) return;
    term.styleReset();
    term.bgBlack();
    term.red(`  Error loading panel: ${err.message}\n`);
  }
  term.styleReset();
}

function drawHeader() {
  const w = Number.isFinite(term.width) ? term.width : 80;
  const tab = TABS[_currentTab];
  term.styleReset();
  term.bgBrightCyan();
  term.bold();
  term.white("  occier  ");
  term.white(`v${VERSION} —  `);
  term.bold();
  term.white(tab.label);
  const text = `  occier  v${VERSION} —  ${tab.label}`;
  const pad = Math.max(0, w - text.length);
  if (pad > 0) term.white(" ".repeat(pad));
  term.styleReset();
}

function drawTabBar() {
  const w = Number.isFinite(term.width) ? term.width : 80;
  term.styleReset();
  term.bgGray();

  // On narrow terminals (<73 cols) reduce inter-tab gap to save space.
  const natural = TABS.reduce((acc, t) => acc + 2 + t.label.length + 2 + 1, 0);
  const gap = w < natural ? " " : "  ";

  for (let i = 0; i < TABS.length; i++) {
    term.white(gap);
    if (i === _currentTab) {
      term.bgBrightWhite();
      term.black(` ${TABS[i].label} `);
      term.bgGray();
    } else {
      term.brightWhite(` ${TABS[i].label} `);
    }
    term.white(" ");
  }

  // Fill rest of the row with bgGray
  const consumed = TABS.reduce((acc, t) => acc + (w < natural ? 1 : 2) + 2 + t.label.length + 2 + 1, 0);
  const pad = Math.max(0, w - consumed);
  if (pad > 0) term.white(" ".repeat(pad));
}

function drawFooter() {
  const w = Number.isFinite(term.width) ? term.width : 80;
  const h = Number.isFinite(term.height) ? term.height : 24;
  term.moveTo(1, h);
  term.styleReset();
  term.bgGray();

  let text;
  if (_statusMessage) {
    text = `  ${_statusMessage}  `;
  } else if (_mode === MODES.SELECT) {
    text = "  ↑↓ / Move  Enter:Action  Esc:Back  ";
  } else {
    text = "  ←→ / Tab  ↑↓ / Scroll  Enter:Select  F5:Refresh  q/Esc:Quit  ";
  }

  term.brightCyan(text);
  const pad = Math.max(0, w - text.length);
  if (pad > 0) term.white(" ".repeat(pad));
  term.styleReset();
}

// (end of framework)
