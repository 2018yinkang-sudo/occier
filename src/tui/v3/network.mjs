import { getNetworkStatus, testConnectivity, scanForProxy, testProxy, configureProxy, removeProxy } from "../../services/network.mjs";
import { line, selectedLine, sectionHeader, secondaryHeader, skeletonLine, skeletonHeader } from "../v3/panel-utils.mjs";

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
      selectedLine(term, { text: "\u25B8 " }, ...parts);
    } else {
      line(term, { text: "\u203A ", fg: "brightWhite" }, ...parts);
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
  const emitSubHeader = (title) => {
    const st = budget.nextLine();
    if (st === "beyond") return true;
    if (st === "draw") secondaryHeader(term, title);
    return false;
  };
  const emitItem = (id, label, ...parts) => {
    const st = budget.nextLine();
    if (st === "draw") { budget.tag(id, label); draw(id, ...parts); }
    else if (st === "beyond") { budget.tag(id, label); }
    return false;
  };

  if (emitHeader("Proxy")) return;

  if (hasProxy) {
    if (emitLine(
      { text: `${pad}  \u25CF `, fg: "green" },
      { text: proxy.http_proxy || "", fg: "brightWhite" },
    )) return;
  } else {
    if (emitLine(
      { text: `${pad}  \u25CB No proxy configured`, fg: "gray" },
    )) return;
  }

  if (emitLine({ text: "", fg: "white" })) return;

  if (hasProxy) {
    if (emitItem("test-proxy", "Test proxy",
      { text: `${pad}`, fg: "white" },
      { text: "Test proxy", fg: "cyan" },
      { text: " \u2014 verify connectivity through proxy", fg: "gray" },
    )) return;
  }

  if (!hasProxy) {
    if (emitItem("scan-proxy", "Scan for proxy",
      { text: `${pad}`, fg: "white" },
      { text: "Scan for proxy", fg: "cyan" },
      { text: " \u2014 auto-detect on common ports", fg: "gray" },
    )) return;
  }

  if (emitItem("configure-proxy", "Configure proxy",
    { text: `${pad}`, fg: "white" },
    { text: "Configure proxy", fg: "cyan" },
    { text: " \u2014 set up manually", fg: "gray" },
  )) return;

  if (hasProxy) {
    if (emitItem("remove-proxy", "Remove proxy",
      { text: `${pad}`, fg: "white" },
      { text: "Remove proxy", fg: "yellow" },
      { text: " \u2014 turn off and clean up", fg: "gray" },
    )) return;
  }

  if (emitLine({ text: "", fg: "white" })) return;

  if (emitHeader("Mirrors")) return;

  const scopes = ["npm", "pip", "apt", "node"];
  for (const scope of scopes) {
    const scopeMirrors = (mirrors || []).filter((m) => m.id.startsWith(scope));
    const active = scopeMirrors.find((m) => m.enabled);
    const name = active ? active.id.replace(scope + "-", "") : "none";
    const bullet = active ? "\u25CF" : "\u25CB";
    const bulletFg = active ? "brightGreen" : "gray";
    const nameFg = active ? "brightWhite" : "gray";
    const countStr = `[${scopeMirrors.length}]`;

    if (emitItem(`mirror-${scope}`, `Mirror ${scope}`,
      { text: `${pad}`, fg: "white" },
      { text: `${scope.padEnd(6)}`, fg: "brightWhite" },
      { text: `${bullet} `, fg: bulletFg },
      { text: name.padEnd(14), fg: nameFg },
      { text: countStr, fg: "gray" },
    )) break;
  }

  if (emitLine({ text: "", fg: "white" })) return;

  if (emitItem("mirror-auto", "Auto-switch mirrors",
    { text: `${pad}`, fg: "white" },
    { text: "Auto-switch fastest", fg: "cyan" },
    { text: " \u2014 test all and apply best", fg: "gray" },
  )) return;

  if (emitLine({ text: "", fg: "white" })) return;

  if (emitSubHeader("Connectivity")) return;

  const conn = _cache.connectivityResults;
  if (conn && conn.length > 0) {
    for (const r of conn) {
      const icon = r.status === "ok" ? "\u25CF" : "\u2717";
      const iconFg = r.status === "ok" ? "brightGreen" : "brightRed";
      const lat = r.status === "ok" ? ` ${String(r.http.ms).padStart(4)}ms` : "".padStart(6);
      const label = r.status === "ok" ? "" : r.label || "timeout";
      if (emitLine(
        { text: `${pad}${icon} `, fg: iconFg },
        { text: r.name.padEnd(18), fg: "brightWhite" },
        { text: lat, fg: "gray" },
        { text: `  ${label}`, fg: r.status === "ok" ? "gray" : "red" },
      )) break;
    }
  } else {
    if (emitLine({ text: `${pad}\u00B7 No connectivity data \u2014 press F5 to test`, fg: "gray" })) return;
  }

  if (emitLine({ text: "", fg: "white" })) return;

  if (emitSubHeader("Platform")) return;

  const wsl = platform.isWSL ? ` WSL${platform.wslVersion} (${platform.wslMode || "nat"})` : "";
  if (emitLine(
    { text: `${pad}${platform.os}${wsl}`, fg: "gray" },
  )) return;

  term.styleReset();
}

export async function renderSkeleton(term, budget) {
  const emitLine = (width) => {
    const st = budget.nextLine();
    if (st === "beyond") return true;
    if (st === "draw") skeletonLine(term, width);
    return false;
  };
  const emitPlaceholder = (title) => {
    const st = budget.nextLine();
    if (st === "beyond") return true;
    if (st === "draw") skeletonHeader(term, title);
    return false;
  };

  if (emitPlaceholder("Proxy")) return;
  if (emitLine(38)) return;
  if (emitLine("")) return;
  if (emitLine(32)) return;
  if (emitLine(30)) return;
  if (emitLine(28)) return;
  if (emitLine("")) return;

  if (emitPlaceholder("Mirrors")) return;
  if (emitLine(32)) return;
  if (emitLine(32)) return;
  if (emitLine(32)) return;
  if (emitLine(32)) return;
  if (emitLine("")) return;
  if (emitLine(26)) return;
  if (emitLine("")) return;

  if (emitPlaceholder("Connectivity")) return;
  if (emitLine(28)) return;
  if (emitLine(28)) return;
  if (emitLine(28)) return;
  if (emitLine("")) return;

  if (emitPlaceholder("Platform")) return;
  if (emitLine(22)) return;

  term.styleReset();
}

export function getTabSummary() {
  if (!_cache) return null;
  const proxyCount = _cache.proxy?.http_proxy ? 1 : 0;
  const mirrorCount = (_cache.mirrors || []).filter((m) => m.enabled).length;
  return { count: proxyCount + mirrorCount };
}

export function getFooterHint(cursorId, mode) {
  if (mode !== "focus" || !_cache) return null;

  const hints = {
    "test-proxy": "\u21B5 test proxy  \u00B7  Esc cancel",
    "scan-proxy": "\u21B5 scan for proxy  \u00B7  Esc cancel",
    "configure-proxy": "\u21B5 configure proxy",
    "remove-proxy": "\u21B5 remove proxy",
    "mirror-auto": "\u21B5 auto-switch fastest mirrors",
  };

  if (cursorId && hints[cursorId]) {
    return hints[cursorId];
  }

  if (cursorId && cursorId.startsWith("mirror-")) {
    const scope = cursorId.replace("mirror-", "");
    return `\u21B5 switch ${scope} mirror  \u00B7  a auto-switch all`;
  }

  return null;
}

export async function handleAction(_term, itemId) {
  if (!_cache) return null;

  if (itemId === "test-proxy") {
    try {
      const p = _cache.proxy;
      if (!p?.http_proxy) return "Error: No proxy configured";
      const url = new URL(p.http_proxy);
      const proto = url.protocol.replace(":", "").replace("socks5h", "socks5");
      const defaultPort = proto === "socks5" ? 1080 : 3128;
      const result = await testProxy(url.hostname, url.port || defaultPort, proto);
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
      return `Found proxy at ${found.host}:${found.port} \u2014 use Configure to apply`;
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
          const proto = u.protocol.replace(":", "");
          await configureProxy({
            protocol: proto,
            host: u.hostname,
            port: u.port || (proto === "socks5" ? "1080" : "3128"),
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

  if (itemId === "mirror-auto") {
    try {
      const { allMirrors } = await import("../../mirrors/registry.mjs");
      const { testMirrorLatency } = await import("../../mirrors/speedtest.mjs");
      const { switchMirror } = await import("../../services/network.mjs");
      const mirrors = await allMirrors();
      let switched = 0;
      const failures = [];

      for (const scope of ["npm", "pip", "node"]) {
        const scopeMirrors = mirrors.filter((m) => m.scope === scope);
        if (scopeMirrors.length === 0) continue;
        try {
          const results = await Promise.allSettled(
            scopeMirrors.map((m) => testMirrorLatency(m.id)),
          );
          const valid = results
            .filter((r) => r.status === "fulfilled")
            .map((r) => r.value)
            .filter((r) => r.status === "ok")
            .sort((a, b) => a.ms - b.ms);
          if (valid.length > 0) {
            const result = await switchMirror(valid[0].mirrorId, scope);
            if (result.ok) switched++;
            else failures.push(`${scope}: ${result.error}`);
          }
        } catch (err) {
          failures.push(`${scope}: ${err.message}`);
        }
      }

      _lastUpdate = 0;
      const msg = `Switched ${switched} scopes`;
      if (failures.length > 0) return `Error: ${msg}; failed: ${failures.join(", ")}`;
      return switched > 0 ? msg : "No mirrors reachable";
    } catch (err) {
      return `Error: ${err.message}`;
    }
  }

  if (itemId.startsWith("mirror-")) {
    const scope = itemId.replace("mirror-", "");
    try {
      const { allMirrors } = await import("../../mirrors/registry.mjs");
      const mirrors = await allMirrors();
      const scopeMirrors = mirrors.filter((m) => m.scope === scope);
      if (scopeMirrors.length === 0) return null;
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
      if (valid.length === 0) return "No reachable mirror found";
      const { switchMirror } = await import("../../services/network.mjs");
      const result = await switchMirror(valid[0].mirrorId, scope);
      _lastUpdate = 0;
      if (!result.ok) return `Error: ${result.error}`;
      return `Switched to ${valid[0].mirrorId.replace(scope + "-", "")} (${valid[0].ms}ms)`;
    } catch (err) {
      return `Error: ${err.message}`;
    }
  }

  return null;
}
