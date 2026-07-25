import { listCredentials } from "../../services/vault.mjs";
import { line, selectedLine, sectionHeader, makeLineBudget } from "./panel-utils.mjs";

let _lastUpdate = 0;
let _cache = null;

export async function renderPanel(term, state = {}) {
  const now = Date.now();
  if (now - _lastUpdate > 10000 || !_cache) {
    _cache = await listCredentials();
    _lastUpdate = now;
  }

  const pad = "  ";
  const budget = makeLineBudget(term, state.scrollOffset ?? 0);
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
    { text: " for details", fg: "gray" },
  );
  term.styleReset();
}

export function getScrollInfo() {
  if (!_cache) return { supportsScroll: false, totalLines: 0 };
  // header + credentials (or 2 empty-state lines) + empty line + 2 hint lines
  const credentialLines = _cache.count > 0 ? _cache.count : 2;
  return { supportsScroll: true, totalLines: 1 + credentialLines + 1 + 2 };
}

export function getSelectableItems() {
  if (!_cache || _cache.count === 0) return [];
  const items = [];
  let lineNum = 2; // after sectionHeader
  for (const cred of _cache.credentials) {
    items.push({ id: cred.key, label: cred.key, line: lineNum });
    lineNum++;
  }
  return items;
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
      const { removeCredential } = await import("../../services/vault.mjs");
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
