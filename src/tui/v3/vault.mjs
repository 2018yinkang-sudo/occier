import { listCredentials, removeCredential } from "../../services/vault.mjs";
import { line, selectedLine, sectionHeader } from "../v3/panel-utils.mjs";

let _lastUpdate = 0;
let _cache = null;

export async function renderPanel(term, state, budget) {
  const now = Date.now();
  if (now - _lastUpdate > 10000 || !_cache) {
    _cache = await listCredentials();
    _lastUpdate = now;
  }

  const pad = "  ";
  const selectedId = state.cursorItemId ?? null;
  const draw = (id, ...parts) => {
    if (id && selectedId === id) {
      selectedLine(term, ...parts);
    } else {
      line(term, ...parts);
    }
  };

  sectionHeader(term, "Credential Vault");
  if (budget.okLine()) return;

  if (_cache.count === 0) {
    line(term,
      { text: `${pad}No credentials stored`, fg: "gray" },
    );
    if (budget.okLine()) return;
    line(term,
      { text: `${pad}Run `, fg: "gray" },
      { text: "occier vault set", fg: "cyan" },
      { text: " to add one", fg: "gray" },
    );
    if (budget.okLine()) return;
  } else {
    for (const cred of _cache.credentials) {
      budget.tag(cred.key, cred.key);
      draw(cred.key,
        { text: pad, fg: "white" },
        { text: "● ", fg: "brightCyan" },
        { text: cred.key.padEnd(25), fg: "brightWhite" },
        { text: cred.type.padEnd(12), fg: "gray" },
        { text: cred.fingerprint, fg: "gray" },
      );
      if (budget.okLine()) break;
    }
  }

  line(term, { text: "", fg: "white" });
  if (budget.okLine()) return;

  line(term,
    { text: `${pad}All keys are stored encrypted.`, fg: "green" },
  );
  if (budget.okLine()) return;
  line(term,
    { text: `${pad}Run `, fg: "gray" },
    { text: "occier vault list", fg: "cyan" },
      { text: " to manage credentials", fg: "gray" },
  );
  term.styleReset();
}

export async function handleAction(_term, itemId) {
  if (!_cache) return null;
  const cred = _cache.credentials.find((c) => c.key === itemId);
  if (!cred) return null;

  return {
    input: {
      title: `Remove ${cred.key}?`,
      prompt: "Type 'yes' to confirm: ",
    },
    async continue(value) {
      if ((value || "").toLowerCase() !== "yes") {
        return "Cancelled";
      }
      try {
        await removeCredential(cred.key);
        _lastUpdate = 0;
        return `${cred.key} removed`;
      } catch (err) {
        return `Error: ${err.message}`;
      }
    },
  };
}
