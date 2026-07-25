import { getToolStatus } from "../../services/tools.mjs";

let _lastUpdate = 0;
let _cache = null;

export async function renderPanel(term, refreshFn) {
  const now = Date.now();
  if (now - _lastUpdate > 10000 || !_cache) {
    _cache = await getToolStatus();
    _lastUpdate = now;
  }

  const { claude, opencode, gh } = _cache;
  const w = Math.min(64, term.width - 4);
  const pad = "  ";

  drawSectionHeader(term, pad, w, "Development Tools");

  drawTool(term, pad, "Claude Code", claude.installed, claude.version);
  drawTool(term, pad, "OpenCode", opencode.installed, opencode.version);

  term("\n");

  drawSectionHeader(term, pad, w, "GitHub");
  drawTool(term, pad, "GitHub CLI", gh.installed, gh.loggedIn ? "authenticated" : "not logged in");

  term("\n");

  term.gray(`${pad}Commands:\n`);
  term(`${pad}  `);
  term.cyan("occier tool install claude");
  term("\n");
  term(`${pad}  `);
  term.cyan("occier tool install opencode");
  term("\n");
  term(`${pad}  `);
  term.cyan("occier tool update claude");
  term("\n");

  if (refreshFn) refreshFn();
}

function drawTool(term, pad, name, installed, detail) {
  term(`${pad}`);
  if (installed) term.brightGreen("●");
  else term.yellow("○");
  term(" ");
  term.bold(name.padEnd(16));
  if (installed) {
    term.brightGreen("installed");
    if (detail) {
      term("  ");
      term.gray(detail);
    }
  } else {
    term.gray("not installed");
  }
  term("\n");
}

function drawSectionHeader(term, pad, w, title) {
  term(`${pad}`);
  term.brightCyan("─ ");
  term.bold(title);
  term.gray(` ${"─".repeat(Math.max(0, w - title.length - 4))}\n`);
}
