import { readFile, writeFile } from "fs/promises";
import { runString } from "../exec/runner.mjs";

const SHELL_MARKER_START = "# >>> occier proxy >>>";
const SHELL_MARKER_END = "# <<< occier proxy <<<";

export const COMMON_PORTS = [10808, 7890, 7891, 1080, 10809, 2080, 3128, 8080];

export async function scanProxyPorts(host = "127.0.0.1", ports = COMMON_PORTS) {
  const { connect } = await import("net");
  const available = [];

  for (const port of ports) {
    try {
      const result = await new Promise((resolve) => {
        const sock = connect(port, host, () => {
          sock.destroy();
          resolve(true);
        });
        sock.setTimeout(500);
        sock.on("error", () => resolve(false));
        sock.on("timeout", () => { sock.destroy(); resolve(false); });
      });
      if (result) available.push(port);
    } catch { /* port scan failed, skip */ }
  }
  return available;
}

export async function detectProxyType(host = "127.0.0.1", port) {
  const r1 = await runString("curl", [
    "-s", "-o", "/dev/null", "-w", "%{http_code}",
    "--connect-timeout", "3",
    "-x", `http://${host}:${port}`,
    "https://www.google.com",
  ], { timeout: 5000 });
  if (r1.exitCode === 0 && r1.stdout === "200") return "http";

  const r2 = await runString("curl", [
    "-s", "-o", "/dev/null", "-w", "%{http_code}",
    "--connect-timeout", "3",
    "-x", `socks5h://${host}:${port}`,
    "https://www.google.com",
  ], { timeout: 5000 });
  if (r2.exitCode === 0 && r2.stdout === "200") return "socks5";

  return null;
}

export function buildProxyEnv(protocol, host, port, username, password) {
  const auth = username && password ? `${username}:${password}@` : "";
  let url;
  if (protocol === "http" || protocol === "https") {
    url = `http://${auth}${host}:${port}`;
  } else {
    url = `socks5h://${auth}${host}:${port}`;
  }
  return {
    http_proxy: url,
    https_proxy: url,
    all_proxy: url,
    HTTP_PROXY: url,
    HTTPS_PROXY: url,
    ALL_PROXY: url,
    no_proxy: "localhost,127.0.0.1,::1,10.0.0.0/8,192.168.0.0/16,172.16.0.0/12,.local",
    NO_PROXY: "localhost,127.0.0.1,::1,10.0.0.0/8,192.168.0.0/16,172.16.0.0/12,.local",
  };
}

export function buildShellRcBlock(protocol, host, port, username, password) {
  const env = buildProxyEnv(protocol, host, port, username, password);
  const lines = [
    SHELL_MARKER_START,
    `# Proxy configured by occier`,
    `host_proxy="${host}"`,
    `proxy_port="${port}"`,
    `proxy_url="${env.all_proxy}"`,
    `proxy_http_url="${env.http_proxy}"`,
    "",
    `proxy_on() {`,
    `  export http_proxy="\${proxy_http_url}"`,
    `  export https_proxy="\${proxy_http_url}"`,
    `  export all_proxy="\${proxy_url}"`,
    `  export HTTP_PROXY="\${proxy_http_url}"`,
    `  export HTTPS_PROXY="\${proxy_http_url}"`,
    `  export ALL_PROXY="\${proxy_url}"`,
    `  export no_proxy="${env.no_proxy}"`,
    `  export NO_PROXY="${env.no_proxy}"`,
    `  echo "  proxy ON  -> \${proxy_url}"`,
    `}`,
    "",
    `proxy_off() {`,
    `  unset http_proxy https_proxy all_proxy`,
    `  unset HTTP_PROXY HTTPS_PROXY ALL_PROXY`,
    `  unset no_proxy NO_PROXY`,
    `  echo "  proxy OFF"`,
    `}`,
    `proxy_on`,
    SHELL_MARKER_END,
  ];
  return lines.join("\n");
}

export async function injectShellRc(rcPath, block) {
  let content;
  try {
    content = await readFile(rcPath, "utf-8");
  } catch {
    content = "";
  }

  const startIdx = content.indexOf(SHELL_MARKER_START);
  const endIdx = content.indexOf(SHELL_MARKER_END);

  if (startIdx !== -1 && endIdx !== -1) {
    const before = content.slice(0, startIdx);
    const after = content.slice(endIdx + SHELL_MARKER_END.length);
    content = before + block + "\n" + after;
  } else if (startIdx !== -1) {
    const before = content.slice(0, startIdx);
    content = before + block + "\n";
  } else {
    content = content.trimEnd() + "\n\n" + block + "\n";
  }

  await writeFile(rcPath, content);
  return true;
}

export function removeShellRcBlock(content) {
  const startIdx = content.indexOf(SHELL_MARKER_START);
  const endIdx = content.indexOf(SHELL_MARKER_END);
  if (startIdx !== -1 && endIdx !== -1) {
    const before = content.slice(0, startIdx);
    const after = content.slice(endIdx + SHELL_MARKER_END.length);
    return before + after;
  }
  return content;
}

export function detectExistingProxy() {
  return {
    http_proxy: process.env.http_proxy || process.env.HTTP_PROXY || null,
    https_proxy: process.env.https_proxy || process.env.HTTPS_PROXY || null,
    all_proxy: process.env.all_proxy || process.env.ALL_PROXY || null,
    no_proxy: process.env.no_proxy || process.env.NO_PROXY || null,
  };
}

export async function configureGitProxy(protocol, host, port) {
  const url = protocol === "socks5"
    ? `socks5h://${host}:${port}`
    : `http://${host}:${port}`;

  await runString("git", ["config", "--global", "http.proxy", url], { timeout: 5000 });
  await runString("git", ["config", "--global", "https.proxy", url], { timeout: 5000 });
}

export async function unsetGitProxy() {
  await runString("git", ["config", "--global", "--unset", "http.proxy"], { timeout: 5000 }).catch(() => {});
  await runString("git", ["config", "--global", "--unset", "https.proxy"], { timeout: 5000 }).catch(() => {});
}

export async function configureNpmProxy(protocol, host, port) {
  const url = `http://${host}:${port}`;
  await runString("npm", ["config", "set", "proxy", url], { timeout: 5000 });
  await runString("npm", ["config", "set", "https-proxy", url], { timeout: 5000 });
}

export async function unsetNpmProxy() {
  await runString("npm", ["config", "delete", "proxy"], { timeout: 5000 }).catch(() => {});
  await runString("npm", ["config", "delete", "https-proxy"], { timeout: 5000 }).catch(() => {});
}
