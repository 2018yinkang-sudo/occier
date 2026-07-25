import { readFile, writeFile } from "fs/promises";

const SHELL_MARKER_START = "# >>> occier proxy >>>";
const SHELL_MARKER_END = "# <<< occier proxy <<<";

export function buildProxyEnv(protocol, host, port, username, password) {
  const auth = username && password
    ? `${encodeURIComponent(username)}:${encodeURIComponent(password)}@`
    : "";
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
  const safeUrl = env.all_proxy.replace(/[$`\\"!]/g, "\\$&");
  const safeHttpUrl = env.http_proxy.replace(/[$`\\"!]/g, "\\$&");
  const safeHost = String(host).replace(/[$`\\"!]/g, "\\$&");
  const safePort = String(port).replace(/[$`\\"!]/g, "\\$&");
  const lines = [
    SHELL_MARKER_START,
    `# Proxy configured by occier`,
    `host_proxy="${safeHost}"`,
    `proxy_port="${safePort}"`,
    `proxy_url="${safeUrl}"`,
    `proxy_http_url="${safeHttpUrl}"`,
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

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const before = content.slice(0, startIdx);
    const after = content.slice(endIdx + SHELL_MARKER_END.length);
    content = before + block + "\n" + after;
  } else if (startIdx !== -1) {
    // Start marker without a matching end marker (user edited the file).
    // Remove only the dangling marker line — never truncate the rest.
    const lineEnd = content.indexOf("\n", startIdx);
    const before = content.slice(0, startIdx);
    const after = lineEnd === -1 ? "" : content.slice(lineEnd + 1);
    content = before + after.trimStart() + "\n" + block + "\n";
  } else {
    content = content.trimEnd() + "\n\n" + block + "\n";
  }

  // Back up the rc file before modifying it (best-effort).
  if (content !== "") {
    const { copyFile } = await import("fs/promises");
    await copyFile(rcPath, `${rcPath}.occier-bak`).catch(() => {});
  }

  await writeFile(rcPath, content);
  return true;
}

export function detectExistingProxy() {
  return {
    http_proxy: process.env.http_proxy || process.env.HTTP_PROXY || null,
    https_proxy: process.env.https_proxy || process.env.HTTPS_PROXY || null,
    all_proxy: process.env.all_proxy || process.env.ALL_PROXY || null,
    no_proxy: process.env.no_proxy || process.env.NO_PROXY || null,
  };
}
