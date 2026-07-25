import { platform } from "os";
import { readFileSync } from "fs";
import { run, hasCommand } from "../exec/runner.mjs";
import { detectWslNetworkMode } from "../network/wsl.mjs";

let _detected = null;

export function getOS() {
  const p = platform();
  if (p === "win32") return "windows";
  if (p === "darwin") return "macos";
  if (p === "linux") {
    if (isWSL()) return "wsl";
    return "linux";
  }
  return p;
}

export function isWSL() {
  try {
    const osRelease = readFileSync("/proc/version", "utf-8").toLowerCase();
    return osRelease.includes("microsoft") || osRelease.includes("wsl");
  } catch {
    return false;
  }
}

export function wslVersion() {
  if (!isWSL()) return null;
  try {
    const content = readFileSync("/proc/version", "utf-8");
    if (content.includes("WSL2") || content.toLowerCase().includes("wsl2")) return 2;
    return 1;
  } catch {
    return null;
  }
}

export function wslNetworkMode() {
  return detectWslNetworkMode();
}

export function getShell() {
  if (process.env.SHELL) {
    const s = process.env.SHELL.split("/").pop();
    return s || "bash";
  }
  if (process.env.WSLENV) return "bash";
  return "bash";
}

export async function detectCapabilities() {
  const [node, npm, git, curl, gh, cc, oc] = await Promise.all([
    hasCommand("node"),
    hasCommand("npm"),
    hasCommand("git"),
    hasCommand("curl"),
    hasCommand("gh"),
    hasCommand("claude"),
    hasCommand("opencode"),
  ]);

  // Fetch version strings in parallel — NOT in the object literal return
  // which evaluates left-to-right causing sequential awaits (~1.7s).
  const [nodeVer, npmVer, gitVer, , ccVer, ocVer, ghAuth] = await Promise.all([
    node ? getVersion("node") : null,
    npm ? getVersion("npm") : null,
    git ? getVersion("git") : null,
    gh ? getVersion("gh") : null,
    cc ? getVersion("claude") : null,
    oc ? getVersion("opencode") : null,
    gh ? checkGhAuth() : false,
  ]);

  return {
    os: getOS(),
    isWSL: isWSL(),
    wslVersion: wslVersion(),
    wslNetworkMode: wslNetworkMode(),
    shell: getShell(),
    node: { installed: node, version: nodeVer },
    npm: { installed: npm, version: npmVer },
    git: { installed: git, version: gitVer },
    curl: { installed: curl },
    gh: { installed: gh, loggedIn: ghAuth },
    claude: { installed: cc, version: ccVer },
    opencode: { installed: oc, version: ocVer },
    proxy: detectProxyEnv(),
    nodeVersion: process.version,
  };
}

async function getVersion(cmd) {
  const r = await run(cmd, ["--version"], { timeout: 5000 });
  if (r.exitCode === 0) return r.stdout.toString().trim();
  return null;
}

async function checkGhAuth() {
  const { createStore } = await import("../store/credential-store.mjs");
  const store = createStore();
  const data = await store.get("github_token");
  return !!(data && data.value);
}

export function detectProxyEnv() {
  return {
    http_proxy: process.env.http_proxy || process.env.HTTP_PROXY || null,
    https_proxy: process.env.https_proxy || process.env.HTTPS_PROXY || null,
    all_proxy: process.env.all_proxy || process.env.ALL_PROXY || null,
    no_proxy: process.env.no_proxy || process.env.NO_PROXY || null,
  };
}

export async function detectAll() {
  if (_detected) return _detected;
  _detected = await detectCapabilities();
  return _detected;
}

