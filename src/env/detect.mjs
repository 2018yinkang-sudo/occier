import { platform } from "os";
import { readFileSync, existsSync } from "fs";
import { run, hasCommand } from "../exec/runner.mjs";

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
  if (!isWSL()) return null;
  try {
    const content = readFileSync("/etc/wsl.conf", "utf-8");
    const match = content.match(/networkingMode\s*=\s*(\w+)/);
    if (match) return match[1];
  } catch { /* cannot read /etc/wsl.conf */ }
  try {
    const winHome = process.env.USERPROFILE;
    if (winHome) {
      const p = `${winHome.replace(/\\/g, "/")}/.wslconfig`;
      if (existsSync(p)) {
        const content = readFileSync(p, "utf-8");
        const match = content.match(/networkingMode\s*=\s*(\w+)/);
        if (match) return match[1];
      }
    }
  } catch { /* .wslconfig not found */ }
  return "nat";
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

  return {
    os: getOS(),
    isWSL: isWSL(),
    wslVersion: wslVersion(),
    wslNetworkMode: wslNetworkMode(),
    shell: getShell(),
    node: { installed: node, version: node ? await getVersion("node") : null },
    npm: { installed: npm, version: npm ? await getVersion("npm") : null },
    git: { installed: git, version: git ? await getVersion("git") : null },
    curl: { installed: curl },
    gh: { installed: gh, loggedIn: gh ? await checkGhAuth() : false },
    claude: { installed: cc, version: cc ? await getVersion("claude") : null },
    opencode: { installed: oc, version: oc ? await getVersion("opencode") : null },
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
  const r = await run("gh", ["auth", "status"], { timeout: 5000 });
  return r.exitCode === 0;
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

