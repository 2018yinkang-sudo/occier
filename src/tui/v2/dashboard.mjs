import { getToolStatus } from "../../services/tools.mjs";
import { getProviderStatus } from "../../services/provider.mjs";
import { getNetworkStatus } from "../../services/network.mjs";
import { listCredentials } from "../../services/vault.mjs";
import { line, sectionHeader, contentMaxLines } from "./panel-utils.mjs";

let _lastUpdate = 0;
let _cache = { tools: null, providers: null, network: null, vault: null };

export async function renderPanel(term) {
  const now = Date.now();
  if (now - _lastUpdate > 10000 || !_cache.tools) {
    _cache.tools = await getToolStatus();
    _cache.providers = await getProviderStatus();
    _cache.network = await getNetworkStatus();
    _cache.vault = await listCredentials();
    _lastUpdate = now;
  }

  const { tools, providers, network, vault } = _cache;
  const pad = "  ";
  let lines = 0;
  const max = contentMaxLines(term);

  function okLine() { lines++; if (lines >= max) return true; return false; }

  sectionHeader(term, "System Status");
  if (okLine()) return;

  line(term,
    { text: pad, fg: "white" },
    { text: "●", fg: tools.claude.installed ? "brightGreen" : "yellow" },
    { text: "  Claude Code  ", fg: "white" },
    { text: tools.claude.installed ? `installed  ${tools.claude.version || ""}` : "not installed", fg: tools.claude.installed ? "green" : "gray" },
  );
  if (okLine()) return;

  line(term,
    { text: pad, fg: "white" },
    { text: "●", fg: tools.opencode.installed ? "brightGreen" : "yellow" },
    { text: "  OpenCode     ", fg: "white" },
    { text: tools.opencode.installed ? `installed  ${tools.opencode.version || ""}` : "not installed", fg: tools.opencode.installed ? "green" : "gray" },
  );
  if (okLine()) return;

  line(term,
    { text: pad, fg: "white" },
    { text: "●", fg: tools.gh.installed ? (tools.gh.loggedIn ? "brightGreen" : "yellow") : "yellow" },
    { text: "  GitHub CLI   ", fg: "white" },
    { text: `installed  ${tools.gh.loggedIn ? "authenticated" : "not logged in"}`, fg: tools.gh.loggedIn ? "green" : "gray" },
  );
  if (okLine()) return;

  const hasProxy = !!(network && network.proxy && network.proxy.http_proxy);
  line(term,
    { text: pad, fg: "white" },
    { text: "●", fg: hasProxy ? "brightGreen" : "yellow" },
    { text: "  Network      ", fg: "white" },
    { text: hasProxy ? "proxy set" : "direct", fg: hasProxy ? "green" : "gray" },
  );
  if (okLine()) return;

  line(term, { text: "", fg: "white" });
  if (okLine()) return;

  // ── Providers ──
  sectionHeader(term, "Providers");
  if (okLine()) return;

  const configured = providers.filter((p) => p.configured);
  if (configured.length === 0) {
    line(term,
      { text: `${pad}No providers configured`, fg: "gray" },
    );
    if (okLine()) return;
    line(term,
      { text: `${pad}Run `, fg: "gray" },
      { text: "occier provider connect", fg: "cyan" },
      { text: " to add one", fg: "gray" },
    );
    if (okLine()) return;
  } else {
    for (const p of configured) {
      line(term,
        { text: pad, fg: "white" },
        { text: "●", fg: "brightGreen" },
        { text: `  ${p.label.padEnd(14)}`, fg: "brightWhite" },
        { text: p.protocol.padEnd(10), fg: "gray" },
        { text: p.fingerprint || "", fg: "gray" },
      );
      if (okLine()) break;
    }
  }

  // ── Summary ──
  const summary = `${vault.count} credentials  |  ${configured.length} providers  |  ${network?.mirrors?.filter((m) => m.enabled).length || 0} mirrors`;
  const w = Number.isFinite(term.width) ? term.width : 80;
  line(term,
    { text: `${pad}${"─".repeat(Math.max(1, w - 4))}`, fg: "gray" },
  );
  line(term,
    { text: `${pad}`, fg: "white" },
    { text: summary, fg: "brightWhite" },
  );
  term.styleReset();
}
