import { readFile, writeFile } from "fs/promises";
import { detectExistingProxy, buildProxyEnv, buildShellRcBlock, injectShellRc } from "../network/proxy.mjs";
import { checkAll as checkConnectivity } from "../network/connectivity.mjs";
import { detectWslNetworkMode, buildWslConfig } from "../network/wsl.mjs";
import { allMirrors } from "../mirrors/registry.mjs";
import { detectCapabilities } from "../env/detect.mjs";
import { runString, runWithSudo } from "../exec/runner.mjs";
import { shellRcPath } from "../paths.mjs";

// ── Status ──

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

// ── Proxy ──

const PROXY_PORTS = [10808, 7890, 7891, 1080, 10809, 2080, 3128, 8080];

export async function scanForProxy(host = "127.0.0.1") {
  const { connect } = await import("net");
  const open = await Promise.all(
    PROXY_PORTS.map((port) =>
      new Promise((resolve) => {
        const sock = connect(port, host, () => {
          sock.destroy();
          resolve(port);
        });
        sock.setTimeout(200);
        sock.on("error", () => resolve(null));
        sock.on("timeout", () => { sock.destroy(); resolve(null); });
      }),
    ),
  );
  const found = open.filter(Boolean);
  if (found.length === 0) return null;
  return { host, port: found[0] };
}

export async function testProxy(host, port, type = "http") {
  const proxyUrl = `${type}://${host}:${port}`;
  const r = await runString("curl", [
    "-s", "-o", "/dev/null", "-w", "%{http_code}",
    "--connect-timeout", "5",
    "-x", proxyUrl,
    "https://api.anthropic.com",
  ], { timeout: 8000 });
  const ok = r.exitCode === 0 && r.stdout.startsWith("2");
  return {
    ok,
    latency: r.duration,
    detail: ok ? null : (r.stderr || r.stdout || "Connection failed"),
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
    const rcPath = shellRcPath();
    const block = buildShellRcBlock(protocol, host, portNum, username, password);
    await injectShellRc(rcPath, block);
    results.rcWritten = true;
    results.rcPath = rcPath;
  }

  return { ok: true, data: results };
}

export async function removeProxy() {
  // Remove from session
  const keys = ["http_proxy", "https_proxy", "all_proxy", "no_proxy",
    "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY"];
  for (const k of keys) delete process.env[k];

  // Remove from shell RC
  const rcPath = shellRcPath();
  try {
    let content = await readFile(rcPath, "utf-8");
    const start = content.indexOf("# >>> occier proxy >>>");
    const end = content.indexOf("# <<< occier proxy <<<");
    if (start !== -1 && end !== -1 && end > start) {
      const before = content.slice(0, start);
      const after = content.slice(end + "# <<< occier proxy <<<".length);
      content = before + after;
      await writeFile(rcPath, content);
      return { ok: true };
    }
    return { ok: true, detail: "No proxy block found" };
  } catch {
    return { ok: false, error: "Failed to read shell RC file" };
  }
}

// ── Mirror ──

export async function switchMirror(mirrorId, scope) {
  const { getMirrorSafe, enableMirror, disableMirror } = await import("../mirrors/registry.mjs");
  const mirror = getMirrorSafe(mirrorId);
  if (!mirror || mirror.scope !== scope) return { ok: false, error: "Mirror not found" };

  const url = mirror.baseUrl;

  if (scope === "npm") {
    const r = await runString("npm", ["config", "set", "registry", url], { timeout: 5000 });
    if (r.exitCode !== 0) return { ok: false, error: `npm config failed: ${r.stderr || ""}` };
  } else if (scope === "pip") {
    const r = await runString("pip", ["config", "set", "global.index-url", url], { timeout: 5000 });
    if (r.exitCode !== 0) return { ok: false, error: `pip config failed: ${r.stderr || ""}` };
  } else if (scope === "node") {
    const r = await runString("npm", ["config", "set", "disturl", url], { timeout: 5000 });
    if (r.exitCode !== 0) return { ok: false, error: `npm disturl failed: ${r.stderr || ""}` };
  } else if (scope === "apt") {
    const codenameR = await runString("lsb_release", ["-cs"], { timeout: 5000 });
    const codename = codenameR.exitCode === 0 ? codenameR.stdout.trim() : "noble";
    const content = `deb ${url} ${codename} main restricted universe multiverse\n`;

    const { mkdtemp, writeFile: wf, rm } = await import("fs/promises");
    const { join: pJoin } = await import("path");
    const { tmpdir } = await import("os");
    const tmpDir = await mkdtemp(pJoin(tmpdir(), "occier-apt-"));
    try {
      const tmpPath = pJoin(tmpDir, "mirror.list");
      await wf(tmpPath, content);
      const r = await runWithSudo("cp", [tmpPath, "/etc/apt/sources.list.d/occier-mirror.list"]);
      if (r.exitCode !== 0) return { ok: false, error: `apt source write failed: ${r.stderr || ""}` };
    } finally {
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  // Update registry state — serialize writes to avoid race
  const mirrors = await allMirrors();
  for (const m of mirrors) {
    if (m.scope !== scope) continue;
    if (m.id === mirrorId) await enableMirror(m.id);
    else await disableMirror(m.id);
  }

  return { ok: true, mirrorId, scope, url };
}

// ── WSL ──

export async function getWslConfig() {
  const mode = detectWslNetworkMode();
  const recommended = buildWslConfig("mirrored");
  return {
    currentMode: mode || "unknown",
    mirrored: mode === "mirrored",
    recommended,
  };
}
