import { getToolStatus, installTool, updateTool } from "../../services/tools.mjs";
import { line, selectedLine, sectionHeader } from "../v3/panel-utils.mjs";

let _lastUpdate = 0;
let _lastCacheGen = 0;
let _cache = null;

export function isCached() {
  return _cache !== null && (Date.now() - _lastUpdate) <= 10000;
}

export async function renderPanel(term, state, budget) {
  const now = Date.now();
  if (now - _lastUpdate > 10000 || !_cache || state.forceRefresh || state.cacheGen !== _lastCacheGen) {
    _cache = await getToolStatus();
    _lastUpdate = now;
    _lastCacheGen = state.cacheGen;
  }

  const { claude, opencode, gh } = _cache;
  const pad = "  ";
  const selectedId = state.cursorItemId ?? null;
  const draw = (id, ...parts) => {
    if (id && selectedId === id) {
      selectedLine(term, { text: "▸ " }, ...parts);
    } else {
      line(term, { text: "› ", fg: "brightWhite" }, ...parts);
    }
  };

  const emitLine = (...parts) => {
    const st = budget.nextLine();
    if (st === "beyond") return true;
    if (st === "draw") line(term, ...parts);
    return false;
  };
  const emitHeader = (title) => {
    const st = budget.nextLine();
    if (st === "beyond") return true;
    if (st === "draw") sectionHeader(term, title);
    return false;
  };
  const emitItem = (id, label, ...parts) => {
    const st = budget.nextLine();
    if (st === "draw") { budget.tag(id, label); draw(id, ...parts); }
    else if (st === "beyond") { budget.tag(id, label); }
    return false;
  };

  if (emitHeader("Development Tools")) return;

  if (budget.shouldShow("Claude Code")) {
    if (emitItem("claude", "Claude Code",
      { text: pad, fg: "white" },
      { text: "●", fg: claude.installed ? "brightGreen" : "yellow" },
      { text: "  Claude Code  ".padEnd(18), fg: "brightWhite" },
      { text: claude.installed ? `installed  ${claude.version || ""}` : "not installed", fg: claude.installed ? "green" : "gray" },
    )) return;
  }

  if (budget.shouldShow("OpenCode")) {
    if (emitItem("opencode", "OpenCode",
      { text: pad, fg: "white" },
      { text: "●", fg: opencode.installed ? "brightGreen" : "yellow" },
      { text: "  OpenCode     ".padEnd(18), fg: "brightWhite" },
      { text: opencode.installed ? `installed  ${opencode.version || ""}` : "not installed", fg: opencode.installed ? "green" : "gray" },
    )) return;
  }

  if (emitLine({ text: "", fg: "white" })) return;

  if (emitHeader("GitHub")) return;

  if (budget.shouldShow("GitHub CLI")) {
    if (emitItem("gh", "GitHub CLI",
      { text: pad, fg: "white" },
      { text: "●", fg: gh.installed ? (gh.loggedIn ? "brightGreen" : "yellow") : "yellow" },
      { text: "  GitHub CLI   ".padEnd(18), fg: "brightWhite" },
      { text: gh.installed ? (gh.loggedIn ? "authenticated" : "not logged in") : "not installed", fg: gh.installed ? (gh.loggedIn ? "green" : "gray") : "gray" },
    )) return;
  }

  if (emitLine({ text: "", fg: "white" })) return;

  if (emitLine({ text: `${pad}Commands:`, fg: "brightWhite" })) return;
  if (emitLine(
    { text: `${pad}  `, fg: "white" },
    { text: "occier tool install claude", fg: "cyan" },
  )) return;
  if (emitLine(
    { text: `${pad}  `, fg: "white" },
    { text: "occier tool install opencode", fg: "cyan" },
  )) return;
  emitLine(
    { text: `${pad}  `, fg: "white" },
    { text: "occier tool update claude", fg: "cyan" },
  );
  term.styleReset();
}

export function getTabSummary() {
  if (!_cache) return null;
  return { count: [_cache.claude, _cache.opencode, _cache.gh].filter((t) => t.installed).length };
}

export async function handleAction(_term, itemId) {
  if (!_cache) return null;
  try {
    if (itemId === "claude") {
      const { claude } = _cache;
      if (claude.installed) {
        await updateTool("claude");
        _lastUpdate = 0;
        return "Claude Code updated";
      }
      await installTool("claude");
      _lastUpdate = 0;
      return "Claude Code installed";
    }
    if (itemId === "opencode") {
      await installTool("opencode");
      _lastUpdate = 0;
      return "OpenCode installed";
    }
    if (itemId === "gh") {
      return "GitHub CLI: use 'occier tool install gh' in shell";
    }
    return null;
  } catch (err) {
    return `Error: ${err.message}`;
  }
}
