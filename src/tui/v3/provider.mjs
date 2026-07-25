import { getProviderStatus, testProviderConnectivity, connectProvider } from "../../services/provider.mjs";
import { line, selectedLine, sectionHeader } from "../v3/panel-utils.mjs";

let _lastUpdate = 0;
let _cache = null;

export async function renderPanel(term, state, budget) {
  const now = Date.now();
  if (now - _lastUpdate > 10000 || !_cache) {
    _cache = await getProviderStatus();
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

  sectionHeader(term, "Providers");
  if (budget.okLine()) return;

  const configured = _cache.filter((p) => p.configured);
  const available = _cache.filter((p) => !p.configured);

  if (configured.length > 0) {
    line(term, { text: `${pad}Configured:`, fg: "brightGreen" });
    if (budget.okLine()) return;
    for (const p of configured) {
      budget.tag(p.id, p.label);
      draw(p.id,
        { text: pad, fg: "white" },
        { text: "● ", fg: "brightGreen" },
        { text: p.label.padEnd(14), fg: "brightWhite" },
        { text: p.protocol.padEnd(10), fg: "gray" },
        { text: p.fingerprint || "", fg: "gray" },
      );
      if (budget.okLine()) break;
    }
    line(term, { text: "", fg: "white" });
    if (budget.okLine()) return;
  }

  if (available.length > 0) {
    line(term, { text: `${pad}Available:`, fg: "brightWhite" });
    if (budget.okLine()) return;
    for (const p of available) {
      budget.tag(p.id, p.label);
      draw(p.id,
        { text: pad, fg: "white" },
        { text: "○ ", fg: "gray" },
        { text: p.label.padEnd(14), fg: "white" },
        { text: p.protocol, fg: "gray" },
      );
      if (budget.okLine()) break;
    }
    line(term, { text: "", fg: "white" });
    if (budget.okLine()) return;
  }

  line(term,
    { text: `${pad}Run `, fg: "gray" },
    { text: "occier provider connect", fg: "cyan" },
      { text: " to configure", fg: "gray" },
  );
  term.styleReset();
}

export async function handleAction(_term, itemId) {
  if (!_cache) return null;
  const p = _cache.find((x) => x.id === itemId);
  if (!p) return null;

  try {
    if (p.configured) {
      const result = await testProviderConnectivity(itemId);
      if (result.ok && result.data?.reachable) {
        return `${p.label} is reachable`;
      }
      return `${p.label} unreachable`;
    }
    return {
      input: {
        title: `Connect ${p.label}`,
        prompt: `API key for ${p.label}: `,
        password: true,
      },
      async continue(apiKey) {
        const result = await connectProvider(itemId, apiKey);
        _lastUpdate = 0;
        if (result.ok) return `${p.label} connected`;
        return `Error: ${result.error}`;
      },
    };
  } catch (err) {
    return `Error: ${err.message}`;
  }
}
