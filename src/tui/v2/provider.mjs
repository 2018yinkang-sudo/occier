import { getProviderStatus } from "../../services/provider.mjs";

let _lastUpdate = 0;
let _cache = null;

export async function renderPanel(term) {
  const now = Date.now();
  if (now - _lastUpdate > 10000 || !_cache) {
    _cache = await getProviderStatus();
    _lastUpdate = now;
  }

  const w = Math.min(64, term.width - 4);
  const pad = "  ";

  drawSectionHeader(term, pad, w, "Providers");

  const configured = _cache.filter((p) => p.configured);
  const available = _cache.filter((p) => !p.configured);

  if (configured.length > 0) {
    term(`${pad}`);
    term.brightGreen("Configured:\n");
    for (const p of configured) {
      term(`${pad}`);
      term.brightGreen("● ");
      term.bold(p.label.padEnd(14));
      term.gray(p.protocol.padEnd(10));
      term.dim(p.fingerprint || "");
      term("\n");
    }
    term("\n");
  }

  if (available.length > 0) {
    term(`${pad}`);
    term.bold("Available:\n");
    for (const p of available) {
      term(`${pad}`);
      term.gray("○ ");
      term(p.label.padEnd(14));
      term.gray(p.protocol);
      term("\n");
    }
    term("\n");
  }

  term.gray(`${pad}Run `);
  term.cyan("occier provider connect");
  term.gray(" to configure\n");
}

function drawSectionHeader(term, pad, w, title) {
  term(`${pad}`);
  term.brightCyan("─ ");
  term.bold(title);
  term.gray(` ${"─".repeat(Math.max(0, w - title.length - 4))}\n`);
}
