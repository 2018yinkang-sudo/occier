import termkit from "terminal-kit";

const term = termkit.terminal;

const TABS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "network", label: "Network" },
  { id: "vault", label: "Vault" },
  { id: "providers", label: "Providers" },
  { id: "tools", label: "Tools" },
  { id: "projects", label: "Projects" },
];

const COLORS = {
  bg: "bgBlack",
  fg: "white",
  accent: "brightCyan",
  success: "brightGreen",
  warning: "brightYellow",
  error: "brightRed",
  info: "brightBlue",
  muted: "gray",
  border: "gray",
  headerBg: "bgBrightCyan",
  selectedBg: "bgBrightWhite",
  selectedFg: "black",
};

let _currentTab = 0;
let _renderGen = 0;

export function startDashboard(initialTab = 0) {
  _currentTab = initialTab;

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

function renderScreen() {
  term.clear();
  drawHeader();
  drawTabBar();
  drawContent();
  drawFooter();
}

function drawHeader() {
  const tab = TABS[_currentTab];
  term[COLORS.headerBg]();
  term.white("  ");
  term.bold(" occier ");
  term.white(" v2.0.0 ");
  term.white("—  ");
  term.bold(tab.label);
  term.white(" ".repeat(Math.max(0, term.width - 35)));
  term.styleReset();
  term("\n");
}

function drawTabBar() {
  term.bgGray();
  term.white(" ");
  for (let i = 0; i < TABS.length; i++) {
    if (i === _currentTab) {
      term[COLORS.selectedBg]();
      term[COLORS.selectedFg](` ${TABS[i].label} `);
      term.bgGray();
      term.white(" ");
    } else {
      term.gray(` ${TABS[i].label} `);
    }
  }
  term.styleReset();
  term("\n\n");
}

function drawFooter() {
  const y = term.height - 1;
  term.moveTo(1, y);
  term.bgGray();
  term.white(" ←→ / Tab:Switch  ");
  term.gray("F5:Refresh  ");
  term.gray("q/Esc:Quit  ");
  term.styleReset();
}

function drawContent() {
  const tab = TABS[_currentTab];
  const modMap = {
    dashboard: "./dashboard.mjs",
    network: "./network.mjs",
    vault: "./vault.mjs",
    providers: "./provider.mjs",
    tools: "./tools.mjs",
    projects: "./projects.mjs",
  };
  const modPath = modMap[tab.id];
  if (modPath) {
    loadPanel(modPath);
  }
}

async function loadPanel(modPath) {
  // Generation guard: if the user switches tabs while a panel is still
  // fetching data, the stale panel must not draw onto the new screen.
  const gen = ++_renderGen;
  try {
    const mod = await import(modPath);
    if (gen !== _renderGen) return;
    if (mod && typeof mod.renderPanel === "function") {
      await mod.renderPanel(term);
      return;
    }
    term.red("  Panel module missing renderPanel export\n");
  } catch (err) {
    if (gen !== _renderGen) return;
    term.red(`  Error loading panel: ${err.message}\n`);
  }
}
