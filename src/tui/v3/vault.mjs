import { listCredentials, removeCredential, setCredential } from "../../services/vault.mjs";
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
    budget.tag("add-credential", "Add credential");
    draw("add-credential",
      { text: `${pad}No credentials — press Enter to add one`, fg: "yellow" },
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

export function getTabSummary() {
  if (!_cache) return null;
  return { count: _cache.count };
}

export async function handleAction(_term, itemId) {
  if (!_cache) return null;

  if (itemId === "add-credential") {
    return {
      input: {
        title: "Add Credential",
        prompt: "Key name: ",
      },
      async continue(keyName) {
        if (!keyName || !keyName.trim()) return "Cancelled";
        const k = keyName.trim();
        return {
          input: {
            title: `Value for ${k}`,
            prompt: "Value: ",
            password: true,
          },
          async continue(value) {
            if (!value) return "Cancelled";
            try {
              const result = await setCredential(k, value);
              _lastUpdate = 0;
              if (result.ok) return `${k} added`;
              return `Error: ${result.error}`;
            } catch (err) {
              return `Error: ${err.message}`;
            }
          },
        };
      },
    };
  }

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
