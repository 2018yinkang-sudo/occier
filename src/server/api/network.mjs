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
import { testMirrorLatency, testAllMirrors } from "../../mirrors/speedtest.mjs";

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

  async listMirrors() {
    const mirrors = await allMirrors();
    return {
      ok: true,
      data: mirrors.map((m) => ({
        id: m.id,
        scope: m.scope,
        baseUrl: m.baseUrl,
        region: m.region,
        official: !!m.official,
        enabled: m.enabled,
      })),
    };
  },

  async testMirrors() {
    const results = await testAllMirrors();
    const mirrors = await allMirrors();
    const scopeMap = {};
    for (const m of mirrors) scopeMap[m.id] = m.scope;

    return {
      ok: true,
      data: results.map((r) => ({
        mirrorId: r.mirrorId,
        scope: scopeMap[r.mirrorId] || "",
        ms: r.ms,
        status: r.status,
      })),
    };
  },

  async switchMirror(scope, body) {
    if (body && body.mirrorId) {
      const result = await switchMirror(body.mirrorId, scope);
      return result.ok
        ? { ok: true, data: { mirror: body.mirrorId } }
        : { ok: false, error: result.error };
    }

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
    const allScopes = ["npm", "pip", "apt", "node"];
    let switched = 0;
    const results = {};

    for (const scope of allScopes) {
      const scopeMirrors = mirrors.filter((m) => m.scope === scope);
      if (scopeMirrors.length === 0) continue;
      try {
        const testResults = await Promise.allSettled(
          scopeMirrors.map((m) => testMirrorLatency(m.id)),
        );
        const valid = testResults
          .filter((r) => r.status === "fulfilled")
          .map((r) => r.value)
          .filter((r) => r.status === "ok")
          .sort((a, b) => a.ms - b.ms);
        if (valid.length > 0) {
          const result = await switchMirror(valid[0].mirrorId, scope);
          if (result.ok) {
            switched++;
            results[scope] = { mirror: valid[0].mirrorId.replace(scope + "-", ""), ms: valid[0].ms };
          } else {
            results[scope] = { error: result.error };
          }
        }
      } catch (err) {
        results[scope] = { error: err.message };
      }
    }

    return {
      ok: switched > 0,
      data: { switched, results },
    };
  },
};
