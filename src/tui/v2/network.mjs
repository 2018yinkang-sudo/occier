import { getNetworkStatus } from "../../services/network.mjs";

let _lastUpdate = 0;
let _cache = null;

export async function renderPanel(term, refreshFn) {
  const now = Date.now();
  if (now - _lastUpdate > 10000 || !_cache) {
    _cache = await getNetworkStatus();
    _lastUpdate = now;
  }

  const { platform, proxy, mirrors } = _cache;

  term.bold("\n  ── Network Status ──\n\n");

  term("  Platform:\n");
  term("    OS:       ");
  term.gray(platform.os || "");
  if (platform.isWSL) {
    term("  WSL mode: ");
    term.gray(platform.wslMode || "unknown");
  }
  term("\n");

  term("\n  Proxy:\n");
  const proxyEntries = proxy ? Object.entries(proxy) : [];
  if (proxyEntries.length === 0) {
    term.gray("    No proxy configured\n");
  } else {
    for (const [k, v] of proxyEntries) {
      term("    ");
      term(k.padEnd(15));
      if (v) term.green(v);
      else term.gray("not set");
      term("\n");
    }
  }

  term("\n  Mirrors:\n");
  if (mirrors) {
    for (const m of mirrors) {
      term("    ");
      if (m.enabled) term.green("●");
      else term.gray("○");
      term(" ");
      term(m.id.padEnd(18));
      term.gray(m.baseUrl);
      term("\n");
    }
  }

  term("\n");
  term.gray("  Press Tab/Arrows to switch  |  F5 to refresh\n");

  if (refreshFn) refreshFn();
}
