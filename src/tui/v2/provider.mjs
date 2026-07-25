import { getProviderStatus } from "../../services/provider.mjs";

let _lastUpdate = 0;
let _cache = null;

export async function renderPanel(term, refreshFn) {
  const now = Date.now();
  if (now - _lastUpdate > 10000 || !_cache) {
    _cache = await getProviderStatus();
    _lastUpdate = now;
  }

  term.bold("\n  ── Providers ──\n\n");

  if (!_cache || _cache.length === 0) {
    term.gray("  No providers available\n");
  } else {
    const configured = _cache.filter((p) => p.configured);
    const unconfigured = _cache.filter((p) => !p.configured);

    if (configured.length > 0) {
      term("  Configured:\n");
      for (const p of configured) {
        term("    ");
        term.green("●");
        term(" ");
        term.bold(p.label.padEnd(14));
        term.gray(p.protocol + "  ");
        term.gray(p.fingerprint || "");
        term("\n");
      }
      term("\n");
    }

    if (unconfigured.length > 0) {
      term("  Available:\n");
      for (const p of unconfigured) {
        term("    ");
        term.gray("○");
        term(" ");
        term(p.label.padEnd(14));
        term.gray(p.protocol);
        term("\n");
      }
    }
  }

  term("\n");
  term.gray("  Press Tab/Arrows to switch  |  F5 to refresh\n");

  if (refreshFn) refreshFn();
}
