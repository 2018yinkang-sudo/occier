import { getToolStatus } from "../../services/tools.mjs";
import { getProviderStatus } from "../../services/provider.mjs";
import { getNetworkStatus } from "../../services/network.mjs";
import { listCredentials } from "../../services/vault.mjs";

let _lastUpdate = 0;
let _cache = { tools: null, providers: null, network: null, vault: null };

export async function renderPanel(term, refreshFn) {
  const now = Date.now();
  if (now - _lastUpdate > 10000 || !_cache.tools) {
    _cache.tools = await getToolStatus();
    _cache.providers = await getProviderStatus();
    _cache.network = await getNetworkStatus();
    _cache.vault = await listCredentials();
    _lastUpdate = now;
  }

  const { tools, providers, network, vault } = _cache;

  drawSection(term, "System Status");
  drawStatusLine(term, "Network", network && network.proxy && network.proxy.http_proxy ? "proxy set" : "no proxy", !!network);
  drawStatusLine(term, "Claude Code", tools.claude.installed ? `v${tools.claude.version || ""}` : "not installed", tools.claude.installed);
  drawStatusLine(term, "OpenCode", tools.opencode.installed ? `v${tools.opencode.version || ""}` : "not installed", tools.opencode.installed);
  drawStatusLine(term, "GitHub", tools.gh && tools.gh.loggedIn ? "logged in" : "not logged in", !!(tools.gh && tools.gh.loggedIn));
  drawStatusLine(term, "Credentials", `${vault.count} stored`, vault.count > 0);

  term("\n");
  drawSection(term, "Configured Providers");
  if (providers) {
    const configured = providers.filter((p) => p.configured);
    if (configured.length === 0) {
      term.gray("  No providers configured\n");
    } else {
      for (const p of configured) {
        term("  ");
        term.green("●");
        term(" ");
        term.bold(p.label);
        term("  ");
        term.gray(p.fingerprint || "");
        term("\n");
      }
    }
  }

  term("\n");
  term.gray("  Press Tab/Arrows to switch panels  ");
  term.gray("|  F5 to refresh\n");

  if (refreshFn) refreshFn();
}

function drawSection(term, title) {
  term.bold("\n  ");
  term.bold.white("── ");
  term.bold(title);
  term.bold.white(" ──\n");
}

function drawStatusLine(term, label, value, ok) {
  term("  ");
  if (ok) term.green("●");
  else term.yellow("○");
  term(" ");
  term(label.padEnd(14));
  term(" ");
  if (ok) term.green(value);
  else term.gray(value);
  term("\n");
}
