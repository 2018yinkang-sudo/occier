import { detectCapabilities } from "../env/detect.mjs";
import { readConfig } from "../schema/config.mjs";
import { createStore } from "../store/credential-store.mjs";
import { getProviderStatus } from "./provider.mjs";
import { getNetworkStatus } from "./network.mjs";

export async function runDiagnostics() {
  const env = await detectCapabilities();
  const store = createStore();
  const credentials = await store.list();
  const config = await readConfig();
  const providerStatus = await getProviderStatus();
  const network = await getNetworkStatus();

  const checks = [
    { name: "node", pass: env.node.installed, detail: env.node.version || "not found" },
    { name: "git", pass: env.git.installed, detail: env.git.version || "not found" },
    { name: "npm", pass: env.npm.installed, detail: env.npm.version || "not found" },
    { name: "curl", pass: env.curl.installed, detail: env.curl.installed ? "available" : "not found" },
    { name: "claude", pass: env.claude.installed, detail: env.claude.version || (env.claude.installed ? "installed" : "not found") },
    { name: "opencode", pass: env.opencode.installed, detail: env.opencode.version || (env.opencode.installed ? "installed" : "not found") },
    { name: "gh-cli", pass: env.gh.installed, detail: env.gh.installed ? (env.gh.loggedIn ? "authenticated" : "not logged in") : "not found" },
  ];

  const warnings = [];
  if (env.isWSL && env.wslNetworkMode !== "mirrored") {
    warnings.push({ name: "wsl-network", detail: `WSL mode: ${env.wslNetworkMode || "unknown"}, recommended: mirrored` });
  }
  if (credentials.length === 0) {
    warnings.push({ name: "credentials", detail: "No API keys configured" });
  }
  if (network.proxy.http_proxy) {
    warnings.push({ name: "proxy", detail: `Proxy: ${network.proxy.http_proxy}` });
  }

  return {
    os: `${env.os}${env.isWSL ? ` WSL${env.wslVersion}` : ""}`,
    shell: env.shell,
    checks,
    warnings,
    configuredProviders: providerStatus
      .filter((p) => p.configured)
      .map((p) => ({ id: p.id, label: p.label, fingerprint: p.fingerprint })),
    credentialCount: credentials.length,
    configVersion: config.version,
    allPassed: checks.filter((c) => !c.pass).length === 0,
  };
}
