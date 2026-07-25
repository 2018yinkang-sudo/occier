import { getNetworkStatus, testConnectivity } from "../../services/network.mjs";
import { line, selectedLine, sectionHeader } from "../v3/panel-utils.mjs";

let _lastUpdate = 0;
let _cache = null;

export async function renderPanel(term, state, budget) {
  const now = Date.now();
  if (now - _lastUpdate > 10000 || !_cache) {
    _cache = await getNetworkStatus();
    _lastUpdate = now;
  }

  const { platform, proxy, mirrors } = _cache;
  const pad = "  ";
  const selectedId = state.cursorItemId ?? null;
  const draw = (id, ...parts) => {
    if (id && selectedId === id) {
      selectedLine(term, ...parts);
    } else {
      line(term, ...parts);
    }
  };

  sectionHeader(term, "Platform");
  if (budget.okLine()) return;

  line(term,
    { text: `${pad}OS: `.padEnd(18), fg: "brightWhite" },
    { text: platform.os || "unknown", fg: "white" },
  );
  if (budget.okLine()) return;

  if (platform.isWSL) {
    line(term,
      { text: `${pad}WSL mode: `.padEnd(18), fg: "brightWhite" },
      { text: platform.wslMode || "unknown", fg: platform.wslMode === "mirrored" ? "green" : "yellow" },
    );
    if (budget.okLine()) return;
  }

  line(term, { text: "", fg: "white" });
  if (budget.okLine()) return;

  sectionHeader(term, "Proxy Configuration");
  if (budget.okLine()) return;

  if (!proxy || Object.keys(proxy).length === 0) {
    line(term, { text: `${pad}No proxy configured`, fg: "gray" });
    if (budget.okLine()) return;
  } else {
    for (const [k, v] of Object.entries(proxy)) {
      line(term,
        { text: `${pad}${k.padEnd(15)}`, fg: "brightWhite" },
        { text: v || "not set", fg: v ? "brightGreen" : "gray" },
      );
      if (budget.okLine()) break;
    }
  }

  line(term, { text: "", fg: "white" });
  if (budget.okLine()) return;

  sectionHeader(term, "Mirrors");
  if (budget.okLine()) return;

  for (const m of mirrors || []) {
    const url = m.baseUrl.length > 50 ? `${m.baseUrl.slice(0, 47)}...` : m.baseUrl;
    budget.tag(m.id, m.id);
    draw(m.id,
      { text: `${pad}`, fg: "white" },
      { text: "● ", fg: m.enabled ? "brightGreen" : "gray" },
      { text: m.id.padEnd(18), fg: "brightWhite" },
      { text: url, fg: "gray" },
    );
    if (budget.okLine()) break;
  }
  term.styleReset();
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
