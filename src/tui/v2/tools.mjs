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

  term.bold("\n  ── Development Tools ──\n\n");

  drawToolRow(term, "Claude Code", claude.installed, claude.version);
  drawToolRow(term, "OpenCode", opencode.installed, opencode.version);

  term("\n");
  term.bold("  ── GitHub ──\n\n");
  if (gh && gh.installed) {
    drawToolRow(term, "GitHub CLI", true, gh.loggedIn ? "authenticated" : "not logged in");
  } else {
    drawToolRow(term, "GitHub CLI", false, null);
  }

  term("\n");
  term("  ");
  term.cyan("occier tool install claude");
  term("\n  ");
  term.cyan("occier tool install opencode");
  term("\n  ");
  term.cyan("occier tool update claude");
  term("\n");

  term("\n");
  term.gray("  Press Tab/Arrows to switch  |  F5 to refresh\n");

  if (refreshFn) refreshFn();
}

function drawToolRow(t, name, installed, detail) {
  t("  ");
  if (installed) t.green("●");
  else t.yellow("○");
  t(" ");
  t(name.padEnd(16));
  if (installed) {
    t.green("installed");
    if (detail) {
      t("  ");
      t.gray(detail);
    }
  } else {
    t.gray("not installed");
  }
  t("\n");
}
