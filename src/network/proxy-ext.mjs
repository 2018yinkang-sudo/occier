import { configureGitProxy, unsetGitProxy, configureNpmProxy, unsetNpmProxy } from "./proxy.mjs";

export async function configurePipProxy(protocol, host, port) {
  const url = `http://${host}:${port}`;
  const { runString } = await import("../exec/runner.mjs");
  await runString("pip", ["config", "set", "global.proxy", url], { timeout: 5000 });
}

export async function unsetPipProxy() {
  const { runString } = await import("../exec/runner.mjs");
  await runString("pip", ["config", "unset", "global.proxy"], { timeout: 5000 }).catch(() => {});
}

export async function configureAptProxy(protocol, host, port) {
  const url = `http://${host}:${port}`;
  const { writeFile } = await import("fs/promises");
  try {
    await writeFile("/etc/apt/apt.conf.d/95proxy", [
      `Acquire::http::Proxy "${url}";`,
      `Acquire::https::Proxy "${url}";`,
      "",
    ].join("\n"));
  } catch (err) {
    if (err.code === "EACCES") {
      process.stderr.write("  \x1b[33m⚠\x1b[0m  APT proxy requires root. Run with sudo.\n");
    }
    throw err;
  }
}

export async function unsetAptProxy() {
  const { unlink } = await import("fs/promises");
  await unlink("/etc/apt/apt.conf.d/95proxy").catch(() => {});
}

export async function configureProxychains(protocol, host, port) {
  const { writeFile } = await import("fs/promises");
  const proto = protocol === "socks5" ? "socks5" : "http";
  try {
    await writeFile("/etc/proxychains4.conf", [
      "strict_chain",
      "proxy_dns",
      "tcp_read_time_out 15000",
      "tcp_connect_time_out 8000",
      "",
      "[ProxyList]",
      `${proto}  ${host} ${port}`,
      "",
    ].join("\n"));
  } catch (err) {
    if (err.code === "EACCES") {
      process.stderr.write("  \x1b[33m⚠\x1b[0m  Proxychains requires root. Run with sudo.\n");
    }
    throw err;
  }
}

export async function configureAllProxies(protocol, host, port) {
  const results = {};
  try { await configureGitProxy(protocol, host, port); results.git = true; } catch { results.git = false; }
  try { await configureNpmProxy(protocol, host, port); results.npm = true; } catch { results.npm = false; }
  try { await configurePipProxy(protocol, host, port); results.pip = true; } catch { results.pip = false; }
  try { await configureAptProxy(protocol, host, port); results.apt = true; } catch { results.apt = false; }
  try { await configureProxychains(protocol, host, port); results.proxychains = true; } catch { results.proxychains = false; }
  return results;
}

export async function unsetAllProxies() {
  const results = {};
  try { await unsetGitProxy(); results.git = true; } catch { results.git = false; }
  try { await unsetNpmProxy(); results.npm = true; } catch { results.npm = false; }
  try { await unsetPipProxy(); results.pip = true; } catch { results.pip = false; }
  try { await unsetAptProxy(); results.apt = true; } catch { results.apt = false; }
  return results;
}
