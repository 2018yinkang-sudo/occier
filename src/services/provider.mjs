import { allProviders, getProviderSafe } from "../registry/providers.mjs";
import { createStore, maskValue } from "../store/credential-store.mjs";

export function listProviders() {
  return allProviders().map((p) => ({
    id: p.id,
    label: p.label,
    description: p.description,
    protocol: p.protocol,
    models: p.models.map((m) => ({ id: m.id, name: m.name, context: m.context })),
  }));
}

export async function getProviderStatus() {
  const store = createStore();
  const entries = await store.list();
  const providers = allProviders();

  return providers.map((p) => {
    const entry = entries.find((e) => e.key.toLowerCase() === (p.envVarName || "").toLowerCase());
    return {
      id: p.id,
      label: p.label,
      configured: !!entry,
      fingerprint: entry?.fingerprint || null,
      protocol: p.protocol,
      hasHealthUrl: !!p.healthUrl,
    };
  });
}

export async function connectProvider(providerId, apiKey) {
  const provider = getProviderSafe(providerId);
  if (!provider) return { ok: false, error: `Unknown provider: ${providerId}` };

  const store = createStore();
  if (apiKey) {
    await store.set(provider.envVarName.toLowerCase(), {
      type: "api_key",
      value: apiKey,
      provider: providerId,
      updatedAt: new Date().toISOString(),
    });
  }

  return {
    ok: true,
    data: {
      id: providerId,
      label: provider.label,
      configured: !!apiKey,
      fingerprint: apiKey ? maskValue(apiKey, "api_key") : null,
    },
  };
}

export async function testProviderConnectivity(providerId) {
  const provider = getProviderSafe(providerId);
  if (!provider) return { ok: false, error: `Unknown provider: ${providerId}` };
  if (!provider.healthUrl) return { ok: true, data: { reachable: null, detail: "Uses login flow" } };

  const { run } = await import("../exec/runner.mjs");
  const r = await run("curl", [
    "-s", "-o", "/dev/null", "-w", "%{http_code}",
    "--connect-timeout", "5", provider.healthUrl,
  ], { timeout: 8000 });

  if (r.exitCode === 0) {
    return { ok: true, data: { reachable: true, httpCode: parseInt(r.stdout) } };
  }
  return { ok: true, data: { reachable: false, detail: r.stderr || "Connection failed" } };
}
