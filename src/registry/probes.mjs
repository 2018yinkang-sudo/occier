import { runString } from "../exec/runner.mjs";
import { getProvider } from "../registry/providers.mjs";
import { createStore } from "../store/credential-store.mjs";

const CACHE_TTL = 5 * 60 * 1000;
const _cache = new Map();

export const ModelStatus = {
  AVAILABLE: "available",
  AUTH_FAILED: "auth_failed",
  UNAVAILABLE: "unavailable",
  RATE_LIMITED: "rate_limited",
  NO_BALANCE: "no_balance",
  NETWORK_ERROR: "network_error",
  UNKNOWN: "unknown",
};

export function isCacheValid(testedAt) {
  if (!testedAt) return false;
  return Date.now() - new Date(testedAt).getTime() < CACHE_TTL;
}

export async function probeModel(provider, apiKey, modelId) {
  const start = Date.now();
  const cacheKey = `${provider.id}:${modelId}`;

  if (_cache.has(cacheKey)) {
    const cached = _cache.get(cacheKey);
    if (isCacheValid(cached.testedAt)) {
      return cached;
    }
  }

  if (!provider.healthUrl) {
    const result = { status: ModelStatus.UNKNOWN, ms: 0, detail: "No health endpoint", testedAt: new Date().toISOString() };
    _cache.set(cacheKey, result);
    return result;
  }

  const r = await runString("curl", [
    "-s", "-w", "\n%{http_code}",
    "--connect-timeout", "5",
    "--max-time", "8",
    "-H", "Content-Type: application/json",
    "-H", `x-api-key: ${apiKey}`,
    "-d", JSON.stringify({
      model: modelId || provider.defaultModel,
      max_tokens: 1,
      messages: [{ role: "user", content: "ping" }],
    }),
    `${provider.healthUrl.replace(/\/v1\/messages$/, "/v1/chat/completions")}`,
  ], { timeout: 10000 });

  const ms = Date.now() - start;
  let status;
  let detail;

  if (r.exitCode === -1) {
    status = ModelStatus.NETWORK_ERROR;
    detail = r.stderr || "Connection failed";
  } else if (r.exitCode !== 0) {
    status = ModelStatus.NETWORK_ERROR;
    detail = r.stderr || `Exit code ${r.exitCode}`;
  } else {
    const lines = r.stdout.split("\n");
    const httpCode = parseInt(lines.pop() || "0");
    const body = lines.join("\n");

    if (httpCode === 200) {
      status = ModelStatus.AVAILABLE;
      detail = "OK";
    } else if (httpCode === 401 || httpCode === 403) {
      status = ModelStatus.AUTH_FAILED;
      detail = `HTTP ${httpCode}: Invalid API key`;
    } else if (httpCode === 429) {
      if (body.includes("quota") || body.includes("credit") || body.includes("balance") || body.includes("insufficient")) {
        status = ModelStatus.NO_BALANCE;
        detail = "Insufficient balance or quota";
      } else {
        status = ModelStatus.RATE_LIMITED;
        detail = "Rate limited";
      }
    } else if (httpCode >= 500) {
      status = ModelStatus.UNAVAILABLE;
      detail = `Server error HTTP ${httpCode}`;
    } else {
      status = ModelStatus.UNKNOWN;
      detail = `HTTP ${httpCode}: ${body.slice(0, 100)}`;
    }
  }

  const result = { status, ms, detail, testedAt: new Date().toISOString() };
  _cache.set(cacheKey, result);
  return result;
}

export async function probeProviderAll(providerId) {
  const provider = getProvider(providerId);
  const store = createStore();
  const data = await store.get(provider.envVarName.toLowerCase());
  const apiKey = data?.value;

  if (!apiKey) {
    return { providerId, models: [], error: "No API key configured" };
  }

  const models = provider.models.length > 0
    ? provider.models
    : [{ id: provider.defaultModel || "default", name: "Default" }];

  const results = [];
  for (const model of models) {
    results.push({
      modelId: model.id,
      modelName: model.name,
      ...await probeModel(provider, apiKey, model.id),
    });
  }

  return { providerId, models: results, testedAt: new Date().toISOString() };
}

export async function probeAllConfiguredProviders() {
  const { allProviders } = await import("../registry/providers.mjs");
  const store = createStore();
  const entries = await store.list();
  const results = [];

  for (const p of allProviders()) {
    const key = p.envVarName?.toLowerCase();
    if (!key) continue;
    if (entries.some((e) => e.key === key)) {
      results.push(await probeProviderAll(p.id));
    }
  }

  return results;
}

export function clearProbeCache() {
  _cache.clear();
}
