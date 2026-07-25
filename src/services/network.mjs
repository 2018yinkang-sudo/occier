import { detectExistingProxy, buildProxyEnv, buildShellRcBlock, injectShellRc } from "../network/proxy.mjs";
import { checkAll as checkConnectivity } from "../network/connectivity.mjs";
import { detectWslNetworkMode, buildWslConfig } from "../network/wsl.mjs";
import { allMirrors } from "../mirrors/registry.mjs";
import { readConfig, writeConfig } from "../schema/config.mjs";
import { detectCapabilities } from "../env/detect.mjs";

export async function getNetworkStatus() {
  const env = await detectCapabilities();
  const proxy = detectExistingProxy();
  const wslMode = env.isWSL ? detectWslNetworkMode() : null;

  return {
    platform: { os: env.os, isWSL: env.isWSL, wslVersion: env.wslVersion, wslMode },
    proxy,
    connectivity: null,
    mirrors: (await allMirrors()).map((m) => ({ id: m.id, enabled: m.enabled, baseUrl: m.baseUrl, official: !!m.official })),
  };
}

export async function testConnectivity() {
  const proxy = detectExistingProxy();
  const results = await checkConnectivity();
  return {
    proxyConfigured: !!proxy.http_proxy,
    proxyUrl: proxy.http_proxy || null,
    results: results.map((r) => ({
      name: r.name,
      url: r.url,
      dns: { pass: r.dns.pass, ms: r.dns.ms },
      http: { pass: r.http.pass, code: r.http.code, ms: r.http.ms, error: r.http.error || null },
      status: r.status,
    })),
  };
}

export async function configureProxy({ protocol, host, port, username = "", password = "", persist = "session" }) {
  const portNum = parseInt(port, 10);
  const results = { envSet: false, rcWritten: false, rcPath: null };

  if (persist === "session" || persist === "both") {
    const env = buildProxyEnv(protocol, host, portNum, username, password);
    Object.assign(process.env, env);
    results.envSet = true;
  }

  if (persist === "shell" || persist === "both") {
    const { join } = await import("path");
    const { homedir } = await import("os");
    const candidates = [".bashrc", ".zshrc", ".profile"];
    let rcPath = null;
    for (const name of candidates) {
      try {
        const { accessSync, R_OK } = await import("fs");
        accessSync(join(homedir(), name), R_OK);
        rcPath = join(homedir(), name);
        break;
      } catch { /* rc not found */ }
    }
    if (!rcPath) rcPath = join(homedir(), ".bashrc");
    const block = buildShellRcBlock(protocol, host, portNum, username, password);
    await injectShellRc(rcPath, block);
    results.rcWritten = true;
    results.rcPath = rcPath;
  }

  const config = await readConfig();
  config.networkConfigured = true;
  await writeConfig(config);

  return { ok: true, data: results };
}

export async function getWslConfig() {
  const mode = detectWslNetworkMode();
  const recommended = buildWslConfig("mirrored");
  return {
    currentMode: mode || "unknown",
    mirrored: mode === "mirrored",
    recommended,
  };
}
