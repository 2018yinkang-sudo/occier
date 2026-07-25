import { getToolStatus } from "../../services/tools.mjs";
import { line, sectionHeader, makeLineBudget } from "./panel-utils.mjs";

let _lastUpdate = 0;
let _cache = null;

export async function renderPanel(term, state = {}) {
  const now = Date.now();
  if (now - _lastUpdate > 10000 || !_cache) {
    _cache = await getToolStatus();
    _lastUpdate = now;
  }

  const { claude, opencode, gh } = _cache;
  const pad = "  ";
  const okLine = makeLineBudget(term, state.scrollOffset ?? 0);

  sectionHeader(term, "Development Tools");
  if (okLine()) return;

  line(term,
    { text: pad, fg: "white" },
    { text: "●", fg: claude.installed ? "brightGreen" : "yellow" },
    { text: "  Claude Code  ".padEnd(18), fg: "brightWhite" },
    { text: claude.installed ? `installed  ${claude.version || ""}` : "not installed", fg: claude.installed ? "green" : "gray" },
  );
  if (okLine()) return;

  line(term,
    { text: pad, fg: "white" },
    { text: "●", fg: opencode.installed ? "brightGreen" : "yellow" },
    { text: "  OpenCode     ".padEnd(18), fg: "brightWhite" },
    { text: opencode.installed ? `installed  ${opencode.version || ""}` : "not installed", fg: opencode.installed ? "green" : "gray" },
  );
  if (okLine()) return;

  line(term, { text: "", fg: "white" });
  if (okLine()) return;

  sectionHeader(term, "GitHub");
  if (okLine()) return;

  line(term,
    { text: pad, fg: "white" },
    { text: "●", fg: gh.installed ? (gh.loggedIn ? "brightGreen" : "yellow") : "yellow" },
    { text: "  GitHub CLI   ".padEnd(18), fg: "brightWhite" },
    { text: gh.installed ? (gh.loggedIn ? "authenticated" : "not logged in") : "not installed", fg: gh.installed ? (gh.loggedIn ? "green" : "gray") : "gray" },
  );
  if (okLine()) return;

  line(term, { text: "", fg: "white" });
  if (okLine()) return;

  line(term,
    { text: `${pad}Commands:`, fg: "brightWhite" },
  );
  if (okLine()) return;
  line(term,
    { text: `${pad}  `, fg: "white" },
    { text: "occier tool install claude", fg: "cyan" },
  );
  if (okLine()) return;
  line(term,
    { text: `${pad}  `, fg: "white" },
    { text: "occier tool install opencode", fg: "cyan" },
  );
  if (okLine()) return;
  line(term,
    { text: `${pad}  `, fg: "white" },
    { text: "occier tool update claude", fg: "cyan" },
  );
  term.styleReset();
}

export function getScrollInfo() {
  // Tools panel content is a fixed 12 logical lines.
  return { supportsScroll: true, totalLines: 12 };
}
