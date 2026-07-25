import { listCredentials } from "../../services/vault.mjs";
import { line, sectionHeader, contentMaxLines } from "./panel-utils.mjs";

let _lastUpdate = 0;
let _cache = null;

export async function renderPanel(term) {
  const now = Date.now();
  if (now - _lastUpdate > 10000 || !_cache) {
    _cache = await listCredentials();
    _lastUpdate = now;
  }

  const pad = "  ";
  let lines = 0;
  const max = contentMaxLines(term);

  function okLine() { lines++; if (lines >= max) return true; return false; }

  sectionHeader(term, "Credential Vault");
  if (okLine()) return;

  if (_cache.count === 0) {
    line(term,
      { text: `${pad}No credentials stored`, fg: "gray" },
    );
    if (okLine()) return;
    line(term,
      { text: `${pad}Run `, fg: "gray" },
      { text: "occier vault set", fg: "cyan" },
      { text: " to add one", fg: "gray" },
    );
    if (okLine()) return;
  } else {
    for (const cred of _cache.credentials) {
      line(term,
        { text: pad, fg: "white" },
        { text: "● ", fg: "brightCyan" },
        { text: cred.key.padEnd(25), fg: "brightWhite" },
        { text: cred.type.padEnd(12), fg: "gray" },
        { text: cred.fingerprint, fg: "gray" },
      );
      if (okLine()) break;
    }
  }

  line(term, { text: "", fg: "white" });
  if (okLine()) return;

  line(term,
    { text: `${pad}All keys are stored encrypted.`, fg: "green" },
  );
  line(term,
    { text: `${pad}Run `, fg: "gray" },
    { text: "occier vault list", fg: "cyan" },
    { text: " for details", fg: "gray" },
  );
}
