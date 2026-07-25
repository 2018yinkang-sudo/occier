import { getNetworkStatus } from "../../services/network.mjs";
import { line, sectionHeader, contentMaxLines } from "./panel-utils.mjs";

let _lastUpdate = 0;
let _cache = null;

export async function renderPanel(term) {
  const now = Date.now();
  if (now - _lastUpdate > 10000 || !_cache) {
    _cache = await getNetworkStatus();
    _lastUpdate = now;
  }

  const { platform, proxy, mirrors } = _cache;
  const pad = "  ";
  let lines = 0;
  const max = contentMaxLines(term);

  function okLine() { lines++; if (lines >= max) return true; return false; }

  // ── Platform ──
  sectionHeader(term, "Platform");
  if (okLine()) return;

  line(term,
    { text: `${pad}OS: `.padEnd(18), fg: "brightWhite" },
    { text: platform.os || "unknown", fg: "white" },
  );
  if (okLine()) return;

  if (platform.isWSL) {
    line(term,
      { text: `${pad}WSL mode: `.padEnd(18), fg: "brightWhite" },
      { text: platform.wslMode || "unknown", fg: platform.wslMode === "mirrored" ? "green" : "yellow" },
    );
    if (okLine()) return;
  }

  line(term, { text: "", fg: "white" });
  if (okLine()) return;

  // ── Proxy ──
  sectionHeader(term, "Proxy Configuration");
  if (okLine()) return;

  if (!proxy || Object.keys(proxy).length === 0) {
    line(term, { text: `${pad}No proxy configured`, fg: "gray" });
    if (okLine()) return;
  } else {
    for (const [k, v] of Object.entries(proxy)) {
      line(term,
        { text: `${pad}${k.padEnd(15)}`, fg: "brightWhite" },
        { text: v || "not set", fg: v ? "brightGreen" : "gray" },
      );
      if (okLine()) break;
    }
  }

  line(term, { text: "", fg: "white" });
  if (okLine()) return;

  // ── Mirrors ──
  sectionHeader(term, "Mirrors");
  if (okLine()) return;

  for (const m of mirrors || []) {
    const url = m.baseUrl.length > 50 ? `${m.baseUrl.slice(0, 47)}...` : m.baseUrl;
    line(term,
      { text: `${pad}`, fg: "white" },
      { text: "● ", fg: m.enabled ? "brightGreen" : "gray" },
      { text: m.id.padEnd(18), fg: "brightWhite" },
      { text: url, fg: "gray" },
    );
    if (okLine()) break;
  }
  term.styleReset();
}
