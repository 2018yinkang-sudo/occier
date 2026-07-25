import { listCredentials } from "../../services/vault.mjs";

let _lastUpdate = 0;
let _cache = null;

export async function renderPanel(term, refreshFn) {
  const now = Date.now();
  if (now - _lastUpdate > 10000 || !_cache) {
    _cache = await listCredentials();
    _lastUpdate = now;
  }

  term.bold("\n  ── Credential Vault ──\n\n");

  if (_cache.count === 0) {
    term.gray("  No credentials stored\n");
    term.gray("  Run 'occier vault set' to add one\n");
  } else {
    for (const cred of _cache.credentials) {
      term("  ");
      term.cyan("●");
      term(" ");
      term(cred.key.padEnd(25));
      term.gray(cred.type.padEnd(12));
      term.gray(cred.fingerprint);
      term("\n");
    }
  }

  term("\n");
  term.gray("  Press Tab/Arrows to switch  |  F5 to refresh\n");

  if (refreshFn) refreshFn();
}
