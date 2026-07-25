import { listCredentials } from "../../services/vault.mjs";

let _lastUpdate = 0;
let _cache = null;

export async function renderPanel(term) {
  const now = Date.now();
  if (now - _lastUpdate > 10000 || !_cache) {
    _cache = await listCredentials();
    _lastUpdate = now;
  }

  const w = Math.min(64, term.width - 4);
  const pad = "  ";

  drawSectionHeader(term, pad, w, "Credential Vault");

  if (_cache.count === 0) {
    term.gray(`${pad}No credentials stored\n`);
    term.gray(`${pad}Run `);
    term.cyan("occier vault set");
    term.gray(" to add one\n");
  } else {
    for (const cred of _cache.credentials) {
      term(`${pad}`);
      term.brightCyan("● ");
      term.bold(cred.key.padEnd(25));
      term.gray(cred.type.padEnd(12));
      term.dim(cred.fingerprint);
      term("\n");
    }
  }

  term("\n");
  term.gray(`${pad}All keys are stored encrypted.\n`);
  term.gray(`${pad}Run `);
  term.cyan("occier vault list");
  term.gray(" for details\n");
}

function drawSectionHeader(term, pad, w, title) {
  term(`${pad}`);
  term.brightCyan("─ ");
  term.bold(title);
  term.gray(` ${"─".repeat(Math.max(0, w - title.length - 4))}\n`);
}
