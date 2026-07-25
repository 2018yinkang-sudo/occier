import { getToolStatus, installTool, updateTool } from "../../services/tools.mjs";
import { line, selectedLine, sectionHeader } from "../v3/panel-utils.mjs";

let _lastUpdate = 0;
let _lastCacheGen = 0;
let _cache = null;

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

  sectionHeader(term, "Development Tools");
  if (budget.okLine()) return;

  budget.tag("claude", "Claude Code");
  draw("claude",
    { text: pad, fg: "white" },
    { text: "●", fg: claude.installed ? "brightGreen" : "yellow" },
    { text: "  Claude Code  ".padEnd(18), fg: "brightWhite" },
    { text: claude.installed ? `installed  ${claude.version || ""}` : "not installed", fg: claude.installed ? "green" : "gray" },
  );
  if (budget.okLine()) return;

  budget.tag("opencode", "OpenCode");
  draw("opencode",
    { text: pad, fg: "white" },
    { text: "●", fg: opencode.installed ? "brightGreen" : "yellow" },
    { text: "  OpenCode     ".padEnd(18), fg: "brightWhite" },
    { text: opencode.installed ? `installed  ${opencode.version || ""}` : "not installed", fg: opencode.installed ? "green" : "gray" },
  );
  if (budget.okLine()) return;

  line(term, { text: "", fg: "white" });
  if (budget.okLine()) return;

  sectionHeader(term, "GitHub");
  if (budget.okLine()) return;

  budget.tag("gh", "GitHub CLI");
  draw("gh",
    { text: pad, fg: "white" },
    { text: "●", fg: gh.installed ? (gh.loggedIn ? "brightGreen" : "yellow") : "yellow" },
    { text: "  GitHub CLI   ".padEnd(18), fg: "brightWhite" },
    { text: gh.installed ? (gh.loggedIn ? "authenticated" : "not logged in") : "not installed", fg: gh.installed ? (gh.loggedIn ? "green" : "gray") : "gray" },
  );
  if (budget.okLine()) return;

  line(term, { text: "", fg: "white" });
  if (budget.okLine()) return;

  line(term,
    { text: `${pad}Commands:`, fg: "brightWhite" },
  );
  if (budget.okLine()) return;
  line(term,
    { text: `${pad}  `, fg: "white" },
    { text: "occier tool install claude", fg: "cyan" },
  );
  if (budget.okLine()) return;
  line(term,
    { text: `${pad}  `, fg: "white" },
    { text: "occier tool install opencode", fg: "cyan" },
  );
  if (budget.okLine()) return;
  line(term,
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
