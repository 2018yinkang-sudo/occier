import { getToolStatus } from "../../services/tools.mjs";
import { getProviderStatus } from "../../services/provider.mjs";
import { getNetworkStatus } from "../../services/network.mjs";
import { listCredentials } from "../../services/vault.mjs";

let _lastUpdate = 0;
let _cache = { tools: null, providers: null, network: null, vault: null };

export async function renderPanel(term) {
  const now = Date.now();
  if (now - _lastUpdate > 10000 || !_cache.tools) {
    _cache.tools = await getToolStatus();
    _cache.providers = await getProviderStatus();
    _cache.network = await getNetworkStatus();
    _cache.vault = await listCredentials();
    _lastUpdate = now;
  }

  const { tools, providers, network, vault } = _cache;
  const w = Math.min(64, term.width - 4);
  const pad = "  ";

  // ── System Status ──
  drawSectionHeader(term, pad, w, "System Status");
  drawRow(term, pad, "Claude Code", tools.claude.installed, tools.claude.version || null);
  drawRow(term, pad, "OpenCode", tools.opencode.installed, tools.opencode.version || null);
  drawRow(term, pad, "GitHub CLI", tools.gh.installed, tools.gh.loggedIn ? "authenticated" : "not logged in");
  drawRow(term, pad, "Network", !!(network && network.proxy && network.proxy.http_proxy), network?.proxy?.http_proxy ? "proxy set" : "direct");

  term("\n");

  // ── Providers ──
  drawSectionHeader(term, pad, w, "Providers");
  const configured = providers.filter((p) => p.configured);
  if (configured.length === 0) {
    term.gray(`${pad}No providers configured\n`);
    term.gray(`${pad}Run `);
    term.cyan("occier provider connect");
    term.gray(" to add one\n");
  } else {
    for (const p of configured) {
      term(`${pad}`);
      term.brightGreen("● ");
      term.bold(p.label.padEnd(14));
      term.gray(p.protocol.padEnd(10));
      term.dim(p.fingerprint || "");
      term("\n");
    }
  }

  term("\n");

  // ── Summary ──
  const line = "─".repeat(w - 2);
  term.gray(`${pad}${line}\n`);
  term(`${pad}`);
  term.brightCyan("●");
  term(`  ${vault.count} credentials  `);
  term.brightGreen("●");
  term(`  ${providers.filter((p) => p.configured).length} providers  `);
  term.brightBlue("●");
  term(`  ${network?.mirrors?.filter((m) => m.enabled).length || 0} mirrors\n`);
}

function drawSectionHeader(term, pad, w, title) {
  term(`${pad}`);
  term.brightCyan("─ ");
  term.bold(title);
  term.gray(` ${"─".repeat(Math.max(0, w - title.length - 4))}\n`);
}

function drawRow(term, pad, label, ok, detail) {
  term(`${pad}`);
  if (ok) term.brightGreen("●");
  else term.yellow("○");
  term(" ");
  term.bold(label.padEnd(14));
  if (ok) {
    term.brightGreen("installed");
    if (detail) {
      term("  ");
      term.gray(detail);
    }
  } else {
    term.gray("not installed");
  }
  term("\n");
}
