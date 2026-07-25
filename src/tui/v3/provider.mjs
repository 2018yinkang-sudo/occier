import { getProviderStatus, testProviderConnectivity, connectProvider } from "../../services/provider.mjs";
import { line, selectedLine, sectionHeader } from "../v3/panel-utils.mjs";

let _lastUpdate = 0;
let _lastCacheGen = 0;
let _cache = null;
let _reachability = {};

export async function renderPanel(term, state, budget) {
  const now = Date.now();
  if (now - _lastUpdate > 10000 || !_cache || state.forceRefresh || state.cacheGen !== _lastCacheGen) {
    _cache = await getProviderStatus();
    _lastUpdate = now;
    if (state.cacheGen !== _lastCacheGen) _reachability = {};
    _lastCacheGen = state.cacheGen;
  }

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

  if (emitHeader("Providers")) return;

  const configured = _cache.filter((p) => p.configured);
  const available = _cache.filter((p) => !p.configured);

  if (configured.length > 0) {
    if (emitLine({ text: `${pad}Configured:`, fg: "brightGreen" })) return;
    for (const p of configured) {
      if (!budget.shouldShow(p.label)) continue;
      if (emitItem(p.id, p.label,
        { text: pad, fg: "white" },
        { text: "● ", fg: "brightGreen" },
        { text: p.label.length > 18 ? (p.label.slice(0, 17) + "…").padEnd(20) : p.label.padEnd(20), fg: "brightWhite" },
        { text: p.protocol.padEnd(10), fg: "gray" },
        { text: p.fingerprint || "", fg: "gray" },
      )) break;
    }
    if (emitLine({ text: "", fg: "white" })) return;
  }

  if (available.length > 0) {
    if (emitLine({ text: `${pad}Available:`, fg: "brightWhite" })) return;
    for (const p of available) {
      if (!budget.shouldShow(p.label)) continue;
      if (emitItem(p.id, p.label,
        { text: pad, fg: "white" },
        { text: "○ ", fg: "gray" },
        { text: p.label.length > 18 ? (p.label.slice(0, 17) + "…").padEnd(20) : p.label.padEnd(20), fg: "white" },
        { text: p.protocol, fg: "gray" },
      )) break;
    }
    if (emitLine({ text: "", fg: "white" })) return;
  }

  emitLine(
    { text: `${pad}Run `, fg: "gray" },
    { text: "occier provider connect", fg: "cyan" },
    { text: " to configure", fg: "gray" },
  );
  term.styleReset();
}

export function getTabSummary() {
  if (!_cache) return null;
  const configured = _cache.filter((p) => p.configured);
  const hasError = configured.some((p) => _reachability[p.id] === false);
  return { count: configured.length, error: hasError || undefined };
}

export async function handleAction(_term, itemId) {
  if (!_cache) return null;
  const p = _cache.find((x) => x.id === itemId);
  if (!p) return null;

  try {
    if (p.configured) {
      const result = await testProviderConnectivity(itemId);
      _reachability[itemId] = result.ok ? result.data?.reachable === true : false;
      if (result.ok && result.data?.reachable) {
        return `${p.label} is reachable`;
      }
      return `${p.label} unreachable`;
    }
    return {
      input: {
        title: `Connect ${p.label}`,
        prompt: `API key for ${p.label}: `,
        password: true,
      },
      async continue(apiKey) {
        const result = await connectProvider(itemId, apiKey);
        _lastUpdate = 0;
        if (result.ok) return `${p.label} connected`;
        return `Error: ${result.error}`;
      },
    };
  } catch (err) {
    return `Error: ${err.message}`;
  }
}
