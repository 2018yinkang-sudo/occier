import { getToolStatus } from "../../services/tools.mjs";
import { getProviderStatus } from "../../services/provider.mjs";
import { getNetworkStatus } from "../../services/network.mjs";
import { listCredentials } from "../../services/vault.mjs";
import { line, selectedLine, sectionHeader } from "../v3/panel-utils.mjs";

let _lastUpdate = 0;
let _lastCacheGen = 0;
let _cache = { tools: null, providers: null, network: null, vault: null };

export async function renderPanel(term, state, budget) {
  const now = Date.now();
  if (now - _lastUpdate > 10000 || !_cache.tools || state.forceRefresh || state.cacheGen !== _lastCacheGen) {
    const [tools, providers, network, vault] = await Promise.all([
      getToolStatus(),
      getProviderStatus(),
      getNetworkStatus(),
      listCredentials(),
    ]);
    _cache = { tools, providers, network, vault };
    _lastUpdate = now;
    _lastCacheGen = state.cacheGen;
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

  // Helper: emit a non-selectable line with scroll-aware budget.
  const emitLine = (...parts) => {
    const st = budget.nextLine();
    if (st === "beyond") return true;
    if (st === "draw") line(term, ...parts);
    return false;
  };
  // Helper: emit a section header.
  const emitHeader = (title) => {
    const st = budget.nextLine();
    if (st === "beyond") return true;
    if (st === "draw") sectionHeader(term, title);
    return false;
  };
  // Helper: emit a selectable item. Tags the item even when "beyond" so
  // the cursor can reach items below the fold. Returns true only when
  // the panel should stop emitting non-selectable lines (beyond).
  const emitItem = (id, label, ...parts) => {
    const st = budget.nextLine();
    if (st === "draw") { budget.tag(id, label); draw(id, ...parts); }
    else if (st === "beyond") { budget.tag(id, label); }
    return false;
  };

  if (emitHeader("System Status")) return;

  if (budget.shouldShow("Claude Code")) {
    if (emitItem("tool-claude", "Claude Code",
      { text: pad, fg: "white" },
      { text: "●", fg: tools.claude.installed ? "brightGreen" : "yellow" },
      { text: "  Claude Code  ", fg: "white" },
      { text: tools.claude.installed ? `installed  ${tools.claude.version || ""}` : "not installed", fg: tools.claude.installed ? "green" : "gray" },
    )) return;
  }

  if (budget.shouldShow("OpenCode")) {
    if (emitItem("tool-opencode", "OpenCode",
      { text: pad, fg: "white" },
      { text: "●", fg: tools.opencode.installed ? "brightGreen" : "yellow" },
      { text: "  OpenCode     ", fg: "white" },
      { text: tools.opencode.installed ? `installed  ${tools.opencode.version || ""}` : "not installed", fg: tools.opencode.installed ? "green" : "gray" },
    )) return;
  }

  if (budget.shouldShow("GitHub CLI")) {
    if (emitItem("tool-gh", "GitHub CLI",
      { text: pad, fg: "white" },
      { text: "●", fg: tools.gh.installed ? (tools.gh.loggedIn ? "brightGreen" : "yellow") : "yellow" },
      { text: "  GitHub CLI   ", fg: "white" },
      { text: `installed  ${tools.gh.loggedIn ? "authenticated" : "not logged in"}`, fg: tools.gh.loggedIn ? "green" : "gray" },
    )) return;
  }

  const hasProxy = !!(network && network.proxy && network.proxy.http_proxy);
  if (budget.shouldShow("Network")) {
    if (emitItem("network", "Network",
      { text: pad, fg: "white" },
      { text: "●", fg: hasProxy ? "brightGreen" : "yellow" },
      { text: "  Network      ", fg: "white" },
      { text: hasProxy ? "proxy set" : "direct", fg: hasProxy ? "green" : "gray" },
    )) return;
  }

  if (emitLine({ text: "", fg: "white" })) return;

  if (emitHeader("Providers")) return;

  const configured = providers.filter((p) => p.configured);
  if (configured.length === 0) {
    if (emitLine({ text: `${pad}No providers configured`, fg: "gray" })) return;
    if (emitLine(
      { text: `${pad}Run `, fg: "gray" },
      { text: "occier provider connect", fg: "cyan" },
      { text: " to add one", fg: "gray" },
    )) return;
  } else {
    for (const p of configured) {
      if (!budget.shouldShow(p.label)) continue;
      if (emitItem(`provider-${p.id}`, p.label,
        { text: pad, fg: "white" },
        { text: "●", fg: "brightGreen" },
        { text: `  ${p.label.padEnd(14)}`, fg: "brightWhite" },
        { text: p.protocol.padEnd(10), fg: "gray" },
        { text: p.fingerprint || "", fg: "gray" },
      )) break;
    }
  }

  const w = Number.isFinite(term.width) ? term.width : 80;
  if (emitLine({ text: `${pad}${"─".repeat(Math.max(1, w - 4))}`, fg: "gray" })) return;
  emitLine(
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
