import { getToolStatus } from "../../services/tools.mjs";
import { getProviderStatus } from "../../services/provider.mjs";
import { getNetworkStatus } from "../../services/network.mjs";
import { listCredentials } from "../../services/vault.mjs";
import { line, selectedLine, sectionHeader } from "../v3/panel-utils.mjs";

let _lastUpdate = 0;
let _cache = { tools: null, providers: null, network: null, vault: null };

export async function renderPanel(term, state, budget) {
  const now = Date.now();
  if (now - _lastUpdate > 10000 || !_cache.tools || state.forceRefresh) {
    _cache.tools = await getToolStatus();
    _cache.providers = await getProviderStatus();
    _cache.network = await getNetworkStatus();
    _cache.vault = await listCredentials();
    _lastUpdate = now;
  }

  const { tools, providers, network, vault } = _cache;
  const pad = "  ";
  const selectedId = state.cursorItemId ?? null;
  const draw = (id, ...parts) => {
    if (id && selectedId === id) {
      selectedLine(term, { text: "▸ " }, ...parts);
    } else {
      line(term, { text: "› ", fg: "brightWhite" }, ...parts);
    }
  };

  sectionHeader(term, "System Status");
  if (budget.okLine()) return;

  budget.tag("tool-claude", "Claude Code");
  draw("tool-claude",
    { text: pad, fg: "white" },
    { text: "●", fg: tools.claude.installed ? "brightGreen" : "yellow" },
    { text: "  Claude Code  ", fg: "white" },
    { text: tools.claude.installed ? `installed  ${tools.claude.version || ""}` : "not installed", fg: tools.claude.installed ? "green" : "gray" },
  );
  if (budget.okLine()) return;

  budget.tag("tool-opencode", "OpenCode");
  draw("tool-opencode",
    { text: pad, fg: "white" },
    { text: "●", fg: tools.opencode.installed ? "brightGreen" : "yellow" },
    { text: "  OpenCode     ", fg: "white" },
    { text: tools.opencode.installed ? `installed  ${tools.opencode.version || ""}` : "not installed", fg: tools.opencode.installed ? "green" : "gray" },
  );
  if (budget.okLine()) return;

  budget.tag("tool-gh", "GitHub CLI");
  draw("tool-gh",
    { text: pad, fg: "white" },
    { text: "●", fg: tools.gh.installed ? (tools.gh.loggedIn ? "brightGreen" : "yellow") : "yellow" },
    { text: "  GitHub CLI   ", fg: "white" },
    { text: `installed  ${tools.gh.loggedIn ? "authenticated" : "not logged in"}`, fg: tools.gh.loggedIn ? "green" : "gray" },
  );
  if (budget.okLine()) return;

  const hasProxy = !!(network && network.proxy && network.proxy.http_proxy);
  budget.tag("network", "Network");
  draw("network",
    { text: pad, fg: "white" },
    { text: "●", fg: hasProxy ? "brightGreen" : "yellow" },
    { text: "  Network      ", fg: "white" },
    { text: hasProxy ? "proxy set" : "direct", fg: hasProxy ? "green" : "gray" },
  );
  if (budget.okLine()) return;

  line(term, { text: "", fg: "white" });
  if (budget.okLine()) return;

  sectionHeader(term, "Providers");
  if (budget.okLine()) return;

  const configured = providers.filter((p) => p.configured);
  if (configured.length === 0) {
    line(term,
      { text: `${pad}No providers configured`, fg: "gray" },
    );
    if (budget.okLine()) return;
    line(term,
      { text: `${pad}Run `, fg: "gray" },
      { text: "occier provider connect", fg: "cyan" },
      { text: " to add one", fg: "gray" },
    );
    if (budget.okLine()) return;
  } else {
    for (const p of configured) {
      budget.tag(`provider-${p.id}`, p.label);
      draw(`provider-${p.id}`,
        { text: pad, fg: "white" },
        { text: "●", fg: "brightGreen" },
        { text: `  ${p.label.padEnd(14)}`, fg: "brightWhite" },
        { text: p.protocol.padEnd(10), fg: "gray" },
        { text: p.fingerprint || "", fg: "gray" },
      );
      if (budget.okLine()) break;
    }
  }

  const w = Number.isFinite(term.width) ? term.width : 80;
  line(term,
    { text: `${pad}${"─".repeat(Math.max(1, w - 4))}`, fg: "gray" },
  );
  if (budget.okLine()) return;
  line(term,
    { text: `${pad}`, fg: "white" },
    { text: `${vault.count} credentials  |  ${configured.length} providers  |  ${network?.mirrors?.filter((m) => m.enabled).length || 0} mirrors`, fg: "brightWhite" },
  );
  term.styleReset();
}

export async function handleAction(_term, itemId) {
  if (!_cache.tools) return null;

  if (itemId === "tool-claude") {
    const { installTool, updateTool } = await import("../../services/tools.mjs");
    try {
      if (_cache.tools.claude.installed) {
        await updateTool("claude");
        _lastUpdate = 0;
        return "Claude Code updated";
      }
      await installTool("claude");
      _lastUpdate = 0;
      return "Claude Code installed";
    } catch (err) {
      return `Error: ${err.message}`;
    }
  }

  if (itemId === "tool-opencode") {
    const { installTool } = await import("../../services/tools.mjs");
    try {
      await installTool("opencode");
      _lastUpdate = 0;
      return "OpenCode installed";
    } catch (err) {
      return `Error: ${err.message}`;
    }
  }

  if (itemId === "tool-gh") {
    return "GitHub CLI: use 'occier tool install gh' in shell";
  }

  if (itemId === "network") {
    return "Network: switch to the Network tab for details";
  }

  if (itemId.startsWith("provider-")) {
    const pid = itemId.slice("provider-".length);
    const { testProviderConnectivity } = await import("../../services/provider.mjs");
    try {
      const result = await testProviderConnectivity(pid);
      if (result.ok && result.data?.reachable) return `${_cache.providers.find((p) => p.id === pid)?.label || pid} is reachable`;
      return `${_cache.providers.find((p) => p.id === pid)?.label || pid} unreachable`;
    } catch (err) {
      return `Error: ${err.message}`;
    }
  }

  return null;
}
