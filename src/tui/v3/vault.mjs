import { listCredentials, removeCredential, setCredential } from "../../services/vault.mjs";
import { line, selectedLine, sectionHeader } from "../v3/panel-utils.mjs";

let _lastUpdate = 0;
let _lastCacheGen = 0;
let _cache = null;

export function isCached() {
  return _cache !== null && (Date.now() - _lastUpdate) <= 10000;
}

export async function renderPanel(term, state, budget) {
  const now = Date.now();
  if (now - _lastUpdate > 10000 || !_cache || state.forceRefresh || state.cacheGen !== _lastCacheGen) {
    _cache = await listCredentials();
    _lastUpdate = now;
    _lastCacheGen = state.cacheGen;
  }

  const pad = "  ";
  const selectedId = state.cursorItemId ?? null;
  const draw = (id, ...parts) => {
    if (id && selectedId === id) {
      selectedLine(term, { text: "▸ " }, ...parts);
    } else {
      line(term, { text: "› ", fg: "brightWhite" }, ...parts);
    }
  };

  const emitLine = (...parts) => {
    const st = budget.nextLine();
    if (st === "beyond") return true;
    if (st === "draw") line(term, ...parts);
    return false;
  };
  const emitHeader = (title) => {
    const st = budget.nextLine();
    if (st === "beyond") return true;
    if (st === "draw") sectionHeader(term, title);
    return false;
  };
  const emitItem = (id, label, ...parts) => {
    const st = budget.nextLine();
    if (st === "draw") { budget.tag(id, label); draw(id, ...parts); }
    else if (st === "beyond") { budget.tag(id, label); }
    return false;
  };

  if (emitHeader("Credential Vault")) return;

  if (_cache.count === 0) {
    if (emitItem("add-credential", "Add credential",
      { text: `${pad}No credentials — press Enter to add one`, fg: "yellow" },
    )) return;
  } else {
    for (const cred of _cache.credentials) {
      if (!budget.shouldShow(cred.key)) continue;
      if (emitItem(cred.key, cred.key,
        { text: pad, fg: "white" },
        { text: "● ", fg: "brightCyan" },
        { text: cred.key.padEnd(25), fg: "brightWhite" },
        { text: cred.type.padEnd(14), fg: "gray" },
        { text: cred.fingerprint, fg: "gray" },
      )) break;
    }

    // Always show "Add credential" at the bottom so users can add new keys
    // even when the vault is non-empty.
    if (budget.shouldShow("Add credential")) {
      if (emitItem("add-credential", "Add credential",
        { text: `${pad}+ Add credential`, fg: "yellow" },
      )) return;
    }
  }

  if (emitLine({ text: "", fg: "white" })) return;

  if (emitLine({ text: `${pad}All keys are stored encrypted.`, fg: "green" })) return;
  if (_cache.count === 0) {
    emitLine(
      { text: `${pad}Press `, fg: "gray" },
      { text: "Enter", fg: "cyan" },
      { text: " to add your first credential.", fg: "gray" },
    );
  } else {
    emitLine(
      { text: `${pad}Press `, fg: "gray" },
      { text: "Enter", fg: "cyan" },
      { text: " on a key to remove, or '+ Add credential' to add.", fg: "gray" },
    );
  }
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
            if (!value || value.length < 4) return "Error: Value must be at least 4 characters";
            return {
              select: {
                prompt: "Credential type",
                choices: [
                  { label: "1  API Key", value: "api_key" },
                  { label: "2  GitHub Token", value: "github_token" },
                  { label: "3  Proxy Password", value: "proxy_password" },
                  { label: "4  System Password", value: "sudo_password" },
                  { label: "5  Other", value: "other" },
                ],
                defaultCursor: 0,
              },
              async continue(type) {
                if (!type) return "Cancelled";
                try {
                  const result = await setCredential(k, value, type);
                  _lastUpdate = 0;
                  if (result.ok) return `${k} added (${type})`;
                  return `Error: ${result.error}`;
                } catch (err) {
                  return `Error: ${err.message}`;
                }
              },
            };
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
