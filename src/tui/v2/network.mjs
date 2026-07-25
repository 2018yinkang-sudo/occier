import { getNetworkStatus } from "../../services/network.mjs";

let _lastUpdate = 0;
let _cache = null;

export async function renderPanel(term) {
  const now = Date.now();
  if (now - _lastUpdate > 10000 || !_cache) {
    _cache = await getNetworkStatus();
    _lastUpdate = now;
  }

  const { platform, proxy, mirrors } = _cache;
  const w = Math.min(64, term.width - 4);
  const pad = "  ";

  // ── Platform ──
  drawSectionHeader(term, pad, w, "Platform");
  term(`${pad}`);
  term.bold("OS:".padEnd(14));
  term.gray(platform.os || "unknown");
  if (platform.isWSL) {
    term.gray("  WSL mode: ");
    term.yellow(platform.wslMode || "unknown");
  }
  term("\n");

  term("\n");

  // ── Proxy ──
  drawSectionHeader(term, pad, w, "Proxy Configuration");
  if (!proxy || Object.keys(proxy).length === 0) {
    term.gray(`${pad}No proxy configured\n`);
  } else {
    for (const [k, v] of Object.entries(proxy)) {
      term(`${pad}`);
      term.bold(k.padEnd(15));
      if (v) term.brightGreen(v);
      else term.gray("not set");
      term("\n");
    }
  }

  term("\n");

  // ── Mirrors ──
  drawSectionHeader(term, pad, w, "Mirrors");
  for (const m of mirrors || []) {
    term(`${pad}`);
    if (m.enabled) term.brightGreen("●");
    else term.gray("○");
    term(" ");
    term.bold(m.id.padEnd(18));
    term.gray(m.baseUrl);
    term("\n");
  }
}

function drawSectionHeader(term, pad, w, title) {
  term(`${pad}`);
  term.brightCyan("─ ");
  term.bold(title);
  term.gray(` ${"─".repeat(Math.max(0, w - title.length - 4))}\n`);
}
