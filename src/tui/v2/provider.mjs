import { getProviderStatus } from "../../services/provider.mjs";
import { line, sectionHeader, contentMaxLines } from "./panel-utils.mjs";

let _lastUpdate = 0;
let _cache = null;

export async function renderPanel(term) {
  const now = Date.now();
  if (now - _lastUpdate > 10000 || !_cache) {
    _cache = await getProviderStatus();
    _lastUpdate = now;
  }

  const pad = "  ";
  let lines = 0;
  const max = contentMaxLines(term);

  function okLine() { lines++; if (lines >= max) return true; return false; }

  sectionHeader(term, "Providers");
  if (okLine()) return;

  const configured = _cache.filter((p) => p.configured);
  const available = _cache.filter((p) => !p.configured);

  if (configured.length > 0) {
    line(term, { text: `${pad}Configured:`, fg: "brightGreen" });
    if (okLine()) return;
    for (const p of configured) {
      line(term,
        { text: pad, fg: "white" },
        { text: "● ", fg: "brightGreen" },
        { text: p.label.padEnd(14), fg: "brightWhite" },
        { text: p.protocol.padEnd(10), fg: "gray" },
        { text: p.fingerprint || "", fg: "gray" },
      );
      if (okLine()) break;
    }
    line(term, { text: "", fg: "white" });
    if (okLine()) return;
  }

  if (available.length > 0) {
    line(term, { text: `${pad}Available:`, fg: "brightWhite" });
    if (okLine()) return;
    for (const p of available) {
      line(term,
        { text: pad, fg: "white" },
        { text: "○ ", fg: "gray" },
        { text: p.label.padEnd(14), fg: "white" },
        { text: p.protocol, fg: "gray" },
      );
      if (okLine()) break;
    }
    line(term, { text: "", fg: "white" });
    if (okLine()) return;
  }

  line(term,
    { text: `${pad}Run `, fg: "gray" },
    { text: "occier provider connect", fg: "cyan" },
    { text: " to configure", fg: "gray" },
  );
}
