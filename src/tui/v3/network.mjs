import { getNetworkStatus, testConnectivity, scanForProxy, testProxy, configureProxy, removeProxy } from "../../services/network.mjs";
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
    const status = await getNetworkStatus();
    let connResults = null;
    try { connResults = await testConnectivity(); } catch { /* connectivity test optional */ }
    _cache = { ...status, connectivityResults: connResults?.results || null };
    _lastUpdate = now;
    _lastCacheGen = state.cacheGen;
  }

  const { platform, proxy, mirrors } = _cache;
  const hasProxy = !!(proxy && proxy.http_proxy);
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

  // ── Proxy ──
  if (emitHeader("Proxy")) return;

  if (hasProxy) {
    if (emitLine(
      { text: `${pad}●  `, fg: "green" },
      { text: proxy.http_proxy || "", fg: "brightWhite" },
    )) return;
  } else {
    if (emitLine(
      { text: `${pad}○  No proxy configured`, fg: "gray" },
    )) return;
  }

  if (emitLine({ text: "", fg: "white" })) return;

  if (emitItem("test-proxy", "Test proxy",
    { text: `${pad}`, fg: "white" },
    { text: "Test proxy", fg: "cyan" },
    { text: " — verify connectivity through proxy", fg: "gray" },
  )) return;

  if (!hasProxy) {
    if (emitItem("scan-proxy", "Scan for proxy",
      { text: `${pad}`, fg: "white" },
      { text: "Scan for proxy", fg: "cyan" },
      { text: " — auto-detect on common ports", fg: "gray" },
    )) return;
  }

  if (emitItem("configure-proxy", "Configure proxy",
    { text: `${pad}`, fg: "white" },
    { text: "Configure proxy", fg: "cyan" },
    { text: " — set up manually", fg: "gray" },
  )) return;

  if (hasProxy) {
    if (emitItem("remove-proxy", "Remove proxy",
      { text: `${pad}`, fg: "white" },
      { text: "Remove proxy", fg: "yellow" },
      { text: " — turn off and clean up", fg: "gray" },
    )) return;
  }

  if (emitLine({ text: "", fg: "white" })) return;

  // ── Mirrors ──
  if (emitHeader("Mirrors")) return;

  const scopes = ["npm", "pip", "apt", "node"];
  for (const scope of scopes) {
    const scopeMirrors = (mirrors || []).filter((m) => m.id.startsWith(scope));
    const active = scopeMirrors.find((m) => m.enabled);
    const name = active ? active.id.replace(scope + "-", "") : "none";
    if (emitItem(`mirror-${scope}`, `Mirror ${scope}`,
      { text: `${pad}`, fg: "white" },
      { text: scope.padEnd(5), fg: "brightWhite" },
      { text: "●", fg: active ? "brightGreen" : "gray" },
      { text: ` ${name.padEnd(15)}`, fg: active ? "brightWhite" : "gray" },
      { text: `(${scopeMirrors.length} mirrors)`, fg: "gray" },
    )) break;
  }

  if (emitLine({ text: "", fg: "white" })) return;

  if (emitItem("mirror-auto", "Auto-switch mirrors",
    { text: `${pad}`, fg: "white" },
    { text: "Auto-switch fastest", fg: "cyan" },
    { text: " — test all and apply best", fg: "gray" },
  )) return;

  if (emitLine({ text: "", fg: "white" })) return;

  // ── Connectivity ──
  if (emitHeader("Connectivity")) return;

  const conn = _cache.connectivityResults;
  if (conn && conn.length > 0) {
    for (const r of conn) {
      const icon = r.status === "ok" ? "●" : "✗";
      const iconFg = r.status === "ok" ? "brightGreen" : "brightRed";
      const lat = r.status === "ok" ? ` ${r.http.ms}ms` : "";
      if (emitLine(
        { text: `${pad}${icon} `, fg: iconFg },
        { text: r.name.padEnd(18), fg: "brightWhite" },
        { text: lat, fg: "gray" },
      )) break;
    }
  } else {
    if (emitLine({ text: `${pad}No connectivity data — press F5 to refresh`, fg: "gray" })) return;
  }

  if (emitLine({ text: "", fg: "white" })) return;

  // ── Platform ──
  if (emitLine(
    { text: `${pad}OS: ${platform.os}${platform.isWSL ? ` WSL${platform.wslVersion} (${platform.wslMode || "nat"})` : ""}`,
      fg: "gray" },
  )) return;

  term.styleReset();
}

export function getTabSummary() {
  if (!_cache) return null;
  const proxyCount = _cache.proxy?.http_proxy ? 1 : 0;
  const mirrorCount = (_cache.mirrors || []).filter((m) => m.enabled).length;
  return { count: proxyCount + mirrorCount };
}

export async function handleAction(_term, itemId) {
  if (!_cache) return null;

  if (itemId === "test-proxy") {
    try {
      const p = _cache.proxy;
      if (!p?.http_proxy) return "No proxy configured";
      const url = new URL(p.http_proxy);
      const result = await testProxy(url.hostname, url.port || 80);
      _lastUpdate = 0;
      return result.ok
        ? `Proxy works (${result.latency}ms)`
        : `Proxy not working: ${result.detail || "failed"}`;
    } catch (err) {
      return `Error: ${err.message}`;
    }
  }

  if (itemId === "scan-proxy") {
    try {
      const found = await scanForProxy();
      _lastUpdate = 0;
      if (!found) return "No proxy detected on common ports";
      return `Found proxy at ${found.host}:${found.port} — use 'Configure proxy' to apply`;
    } catch (err) {
      return `Error: ${err.message}`;
    }
  }

  if (itemId === "configure-proxy") {
    return {
      input: { title: "Configure Proxy", prompt: "Proxy URL (e.g. http://127.0.0.1:10808): " },
      async continue(url) {
        if (!url?.trim()) return "Cancelled";
        try {
          const u = new URL(url.trim());
          await configureProxy({
            protocol: u.protocol.replace(":", ""),
            host: u.hostname,
            port: u.port || "3128",
            persist: "both",
          });
          _lastUpdate = 0;
          return "Proxy configured";
        } catch (err) {
          return `Error: ${err.message}`;
        }
      },
    };
  }

  if (itemId === "remove-proxy") {
    try {
      const result = await removeProxy();
      _lastUpdate = 0;
      return result.ok ? "Proxy removed" : `Error: ${result.error}`;
    } catch (err) {
      return `Error: ${err.message}`;
    }
  }

  if (itemId.startsWith("mirror-")) {
    const scope = itemId.replace("mirror-", "");
    const { allMirrors } = await import("../../mirrors/registry.mjs");
    const mirrors = await allMirrors();
    const scopeMirrors = mirrors.filter((m) => m.scope === scope);
    if (scopeMirrors.length === 0) return null;

    // Test all mirrors in scope and pick fastest
    try {
      const results = await Promise.allSettled(
        scopeMirrors.map((m) => import("../../mirrors/speedtest.mjs").then(({ testMirrorLatency }) =>
          testMirrorLatency(m.id),
        )),
      );
      const valid = results
        .filter((r) => r.status === "fulfilled")
        .map((r) => r.value)
        .filter((r) => r.status === "ok")
        .sort((a, b) => a.ms - b.ms);

      if (valid.length === 0) return "No reachable mirror found";

      const best = valid[0];
      const { switchMirror } = await import("../../services/network.mjs");
      const result = await switchMirror(best.mirrorId, scope);
      _lastUpdate = 0;
      if (!result.ok) return `Error: ${result.error}`;
      return `Switched to ${best.mirrorId.replace(scope + "-", "")} (${best.ms}ms)`;
    } catch (err) {
      return `Error: ${err.message}`;
    }
  }

  if (itemId === "mirror-auto") {
    try {
      const { allMirrors } = await import("../../mirrors/registry.mjs");
      const mirrors = await allMirrors();
      let totalTested = 0;
      let bestInfo = null;

      for (const scope of ["npm", "pip", "apt", "node"]) {
        const scopeMirrors = mirrors.filter((m) => m.scope === scope);
        if (scopeMirrors.length === 0) continue;
        const results = await Promise.allSettled(
          scopeMirrors.map((m) =>
            import("../../mirrors/speedtest.mjs").then(({ testMirrorLatency }) =>
              testMirrorLatency(m.id),
            ),
          ),
        );
        const valid = results
          .filter((r) => r.status === "fulfilled")
          .map((r) => r.value)
          .filter((r) => r.status === "ok")
          .sort((a, b) => a.ms - b.ms);
        if (valid.length > 0) {
          const best = valid[0];
          const { switchMirror } = await import("../../services/network.mjs");
          await switchMirror(best.mirrorId, scope);
          totalTested += results.length;
          if (!bestInfo || best.ms < bestInfo.latency) {
            bestInfo = { name: best.mirrorId, latency: best.ms };
          }
        }
      }
      _lastUpdate = 0;
      return `Auto-selected best mirrors across ${totalTested} tests`;
    } catch (err) {
      return `Error: ${err.message}`;
    }
  }

  return null;
}
