import { allProviders, getProviderSafe } from "../registry/providers.mjs";
import { createStore } from "../store/credential-store.mjs";
import { checkProviderConnectivity } from "./vault.mjs";
import { setCredential } from "./vault.mjs";

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

  if (apiKey) {
    const result = await setCredential(provider.envVarName.toLowerCase(), "api_key", { value: apiKey });
    if (!result.ok) return result;
    return {
      ok: true,
      data: {
        id: providerId,
        label: provider.label,
        configured: true,
        fingerprint: result.data.fingerprint,
      },
    };
  }

  return {
    ok: true,
    data: {
      id: providerId,
      label: provider.label,
      configured: false,
      fingerprint: null,
    },
  };
}

// Test provider connectivity AND API key validity by sending the stored key
// with an authenticated GET request. Resolves the API key by envVarName for
// builtin/user providers, or by provider id for vault model keys.
export async function testProviderConnectivity(providerId) {
  const provider = getProviderSafe(providerId);
  if (!provider) return { ok: false, error: `Unknown provider: ${providerId}` };
  if (!provider.healthUrl && !provider.baseURL) {
    return { ok: true, data: { reachable: null, keyValid: null, detail: "Uses login flow", commands: [] } };
  }

  const store = createStore();
  const lookupKey = provider.source === "vault"
    ? provider.id
    : provider.envVarName.toLowerCase();
  const keyEntry = await store.get(lookupKey);
  const apiKey = keyEntry?.fields?.api_key || keyEntry?.value;
  if (!apiKey) {
    return { ok: true, data: { reachable: null, keyValid: null, detail: "API key not configured", commands: [] } };
  }

  const result = await checkProviderConnectivity(provider.protocol, provider.baseURL, apiKey);
  return { ok: true, data: result };
}
