import { getNetworkStatus, testConnectivity } from "../../services/network.mjs";
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
    _cache = await getNetworkStatus();
    _lastUpdate = now;
    _lastCacheGen = state.cacheGen;
  }

  const { platform, proxy, mirrors } = _cache;
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

  if (emitHeader("Platform")) return;

  if (emitLine(
    { text: `${pad}OS: `.padEnd(18), fg: "brightWhite" },
    { text: platform.os || "unknown", fg: "white" },
  )) return;

  if (platform.isWSL) {
    if (emitLine(
      { text: `${pad}WSL mode: `.padEnd(18), fg: "brightWhite" },
      { text: platform.wslMode || "unknown", fg: platform.wslMode === "mirrored" ? "green" : "yellow" },
    )) return;
  }

  if (emitLine({ text: "", fg: "white" })) return;

  if (emitHeader("Proxy Configuration")) return;

  if (!proxy || Object.keys(proxy).length === 0) {
    if (emitLine({ text: `${pad}No proxy configured`, fg: "gray" })) return;
  } else {
    for (const [k, v] of Object.entries(proxy)) {
      const w = Number.isFinite(term.width) ? term.width : 80;
      const maxValLen = Math.max(1, w - pad.length - 15);
      const displayVal = v
        ? (v.length > maxValLen ? v.slice(0, maxValLen - 1) + "…" : v)
        : "not set";
      if (emitLine(
        { text: `${pad}${k.padEnd(15)}`, fg: "brightWhite" },
        { text: displayVal, fg: v ? "brightGreen" : "gray" },
      )) break;
    }
  }

  if (emitLine({ text: "", fg: "white" })) return;

  if (emitHeader("Mirrors")) return;

  for (const m of mirrors || []) {
    if (!budget.shouldShow(m.id)) continue;
    const url = m.baseUrl.length > 50 ? `${m.baseUrl.slice(0, 47)}...` : m.baseUrl;
    if (emitItem(m.id, m.id,
      { text: `${pad}`, fg: "white" },
      { text: "● ", fg: m.enabled ? "brightGreen" : "gray" },
      { text: m.id.padEnd(18), fg: "brightWhite" },
      { text: url, fg: "gray" },
    )) break;
  }
  term.styleReset();
}

export function getTabSummary() {
  if (!_cache) return null;
  return { count: (_cache.mirrors || []).length };
}

export async function handleAction(_term, itemId) {
  if (!_cache) return null;
  const mirror = (_cache.mirrors || []).find((m) => m.id === itemId);
  if (!mirror) return null;

  try {
    const result = await testConnectivity();
    const passed = result.results.filter((r) => r.status === "ok").length;
    const total = result.results.length;
    return `${mirror.id}: ${passed}/${total} endpoints reachable`;
  } catch (err) {
    return `Error: ${err.message}`;
  }
}
