import termkit from "terminal-kit";

const term = termkit.terminal;

const TABS = ["Dashboard", "Network", "Vault", "Providers", "Tools", "Projects"];

let _currentTab = 0;

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
  return TABS[_currentTab];
}

function renderScreen() {
  term.clear();
  drawHeader();
  drawTabBar();
  drawFooter();
  loadPanel();
}

function drawHeader() {
  term.bgBrightCyan();
  term.white(" ");
  term.bold(" occier v2 ");
  term.white("— AI Dev Environment Manager");
  term.styleReset();
  term("\n");
}

function drawTabBar() {
  term.bgGray();
  for (let i = 0; i < TABS.length; i++) {
    if (i === _currentTab) {
      term.bgBrightWhite();
      term.black(` ${TABS[i]} `);
      term.bgGray();
    } else {
      term.white(` ${TABS[i]} `);
    }
    if (i < TABS.length - 1) term.white(" │");
  }
  term.styleReset();
  term("\n\n");
}

function drawFooter() {
  const y = term.height - 1;
  term.moveTo(1, y);
  term.bgGray();
  term.white(" ←→/Tab:Switch  ");
  term.gray("F5:Refresh  ");
  term.gray("q/Esc:Quit  ");
  term.styleReset();
}

function loadPanel() {
  const tab = TABS[_currentTab];
  const moduleMap = {
    Dashboard: "./dashboard.mjs",
    Network: "./network.mjs",
    Vault: "./vault.mjs",
    Providers: "./provider.mjs",
    Tools: "./tools.mjs",
  };

  const modPath = moduleMap[tab];
  if (!modPath) {
    term("  Panel not implemented yet\n");
    return;
  }

  const refresh = () => switchTab(_currentTab);

  import(modPath).then((mod) => {
    if (mod && typeof mod.renderPanel === "function") {
      return mod.renderPanel(term, refresh);
    } else {
      term.red("  Panel module missing renderPanel export\n");
    }
  }).catch((err) => {
    term.red(`  Error loading panel: ${err.message}\n`);
  });
}
