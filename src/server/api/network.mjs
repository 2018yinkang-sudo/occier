import {
  getNetworkStatus,
  testConnectivity,
  scanForProxy,
  testProxy,
  configureProxy,
  removeProxy,
  switchMirror,
} from "../../services/network.mjs";
import { allMirrors } from "../../mirrors/registry.mjs";
import { testMirrorLatency } from "../../mirrors/speedtest.mjs";

export const networkApi = {
  async get() {
    const status = await getNetworkStatus();
    let conn = null;
    try { conn = await testConnectivity(); } catch { /* optional */ }
    return {
      ok: true,
      data: { ...status, connectivity: conn?.results || null },
    };
  },

  async testProxy() {
    const status = await getNetworkStatus();
    const p = status.proxy;
    if (!p?.http_proxy) return { ok: false, error: "No proxy configured" };
    try {
      const url = new URL(p.http_proxy);
      const proto = url.protocol.replace(":", "").replace("socks5h", "socks5");
      const defaultPort = proto === "socks5" ? 1080 : 3128;
      const result = await testProxy(url.hostname, url.port || defaultPort, proto);
      return result.ok
        ? { ok: true, data: { latency: result.latency } }
        : { ok: false, error: result.detail || "failed" };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },

  async scanProxy() {
    const found = await scanForProxy();
    if (!found) return { ok: true, data: { found: false } };
    return { ok: true, data: { found: true, host: found.host, port: found.port } };
  },

  async configureProxy(body) {
    const { protocol, host, port, username, password, persist } = body;
    if (!host) return { ok: false, error: "host is required" };
    const result = await configureProxy({ protocol, host, port, username, password, persist });
    return result;
  },

  async removeProxy() {
    const result = await removeProxy();
    return result;
  },

  async switchMirror(scope, _body) {
    const mirrors = await allMirrors();
    const scopeMirrors = mirrors.filter((m) => m.scope === scope);
    if (scopeMirrors.length === 0) return { ok: false, error: "No mirrors for scope: " + scope };

    const results = await Promise.allSettled(
      scopeMirrors.map((m) => testMirrorLatency(m.id)),
    );
    const valid = results
      .filter((r) => r.status === "fulfilled")
      .map((r) => r.value)
      .filter((r) => r.status === "ok")
      .sort((a, b) => a.ms - b.ms);

    if (valid.length === 0) return { ok: false, error: "No reachable mirror found" };
    const result = await switchMirror(valid[0].mirrorId, scope);
    return result.ok
      ? { ok: true, data: { mirror: valid[0].mirrorId, latency: valid[0].ms } }
      : { ok: false, error: result.error };
  },

  async autoSwitchMirrors() {
    const mirrors = await allMirrors();
    let switched = 0;
    const failures = [];

    for (const scope of ["npm", "pip", "node"]) {
      const scopeMirrors = mirrors.filter((m) => m.scope === scope);
      if (scopeMirrors.length === 0) continue;
      try {
        const results = await Promise.allSettled(
          scopeMirrors.map((m) => testMirrorLatency(m.id)),
        );
        const valid = results
          .filter((r) => r.status === "fulfilled")
          .map((r) => r.value)
          .filter((r) => r.status === "ok")
          .sort((a, b) => a.ms - b.ms);
        if (valid.length > 0) {
          const result = await switchMirror(valid[0].mirrorId, scope);
          if (result.ok) switched++;
          else failures.push(`${scope}: ${result.error}`);
        }
      } catch (err) {
        failures.push(`${scope}: ${err.message}`);
      }
    }

    return {
      ok: switched > 0,
      data: { switched, failures },
      error: failures.length > 0 ? failures.join(", ") : undefined,
    };
  },
};
