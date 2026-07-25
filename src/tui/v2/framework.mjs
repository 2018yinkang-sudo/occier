import termkit from "terminal-kit";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

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

// ── Public API ──

export function startDashboard(initialTab = 0) {
  _currentTab = initialTab;

  // Force dark background so white/bright text is readable regardless of
  // terminal theme. This is a one-time erase — subsequent renders overwrite
  // rows without clearing.
  term.bgBlack();
  try { term.eraseDisplay(); } catch { /* non-TTY: erase not available, skip */ }
  term.fullscreen(true);
  term.hideCursor();
  term.grabInput(true);

  term.on("key", (key) => {
    if (key === "CTRL_C" || key === "ESCAPE" || key === "q") {
      exitDashboard();
      return;
    }
    if (key === "LEFT" || key === "SHIFT_TAB") {
      switchTab((_currentTab - 1 + TABS.length) % TABS.length);
    } else if (key === "RIGHT" || key === "TAB") {
      switchTab((_currentTab + 1) % TABS.length);
    } else if (key === "f5") {
      switchTab(_currentTab);
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
  renderScreen();
}

export function getCurrentTab() {
  return TABS[_currentTab].id;
}

// ── Internal rendering (flicker-free: no term.clear, line-by-line overwrite) ──

function renderScreen() {
  _renderGen++;

  const w = typeof term.width === "number" && isFinite(term.width) ? term.width : 80;
  const h = typeof term.height === "number" && isFinite(term.height) ? term.height : 24;

  // Header — row 1, full-width bgBrightCyan
  term.moveTo(1, 1);
  drawHeader(w);

  // Tab bar — row 2, full-width bgGray
  term.moveTo(1, 2);
  drawTabBar(w);

  // Spacer row — row 3, bgBlack fills the default background for content
  term.moveTo(1, 3);
  term.bgBlack();
  term.white(" ".repeat(w));

  // Clear old content (rows 4+) NOW so stale panel text does not linger
  // while the new panel is loading asynchronously (ghosting fix).
  term.moveTo(1, 4);
  try { term.eraseDisplayAfter(); } catch { /* non-TTY: erase not available, skip */ }

  // Content — rows 4+, async
  drawContent();

  // Footer — last row
  drawFooter(w, h);
}

function drawHeader(w) {
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

function drawTabBar(w) {
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

function drawFooter(w, h) {
  term.moveTo(1, h);
  term.styleReset();
  term.bgGray();
  term.brightCyan("  ←→ / Tab:Switch  ");
  term.brightWhite("F5:Refresh  ");
  term.brightWhite("q/Esc:Quit  ");
  const text = "  ←→ / Tab:Switch  F5:Refresh  q/Esc:Quit  ";
  const pad = Math.max(0, w - text.length);
  if (pad > 0) term.white(" ".repeat(pad));
  term.styleReset();
}

function drawContent() {
  const modPath = MOD_MAP[TABS[_currentTab].id];
  if (modPath) loadPanel(modPath);
}

async function loadPanel(modPath) {
  const gen = ++_renderGen;
  try {
    const mod = await import(modPath);
    if (gen !== _renderGen) return;
    if (mod && typeof mod.renderPanel === "function") {
      await mod.renderPanel(term);
      // Clear any leftover lines from a previous larger panel.
      if (gen === _renderGen) {
        try { term.eraseDisplayAfter(); } catch { /* non-TTY: erase not available, skip */ }
      }
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
}
