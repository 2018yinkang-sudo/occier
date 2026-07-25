import { getProvider, allProviders } from "../registry/providers.mjs";
import { createStore } from "../store/credential-store.mjs";
import { ProbeCache } from "./probe-cache.mjs";

const probeCache = new ProbeCache();

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
  return Date.now() - new Date(testedAt).getTime() < 5 * 60 * 1000;
}

export async function probeModel(provider, apiKey, modelId) {
  const start = Date.now();
  const cacheKey = `${provider.id}:${modelId}`;

  const cached = probeCache.get(cacheKey);
  if (cached) return { ...cached, ms: Date.now() - start };

  if (!provider.healthUrl) {
    const result = { status: ModelStatus.UNKNOWN, ms: 0, detail: "No health endpoint", testedAt: new Date().toISOString() };
    probeCache.set(cacheKey, result);
    return result;
  }

  let url = provider.healthUrl;
  if (provider.protocol === "openai" && url.endsWith("/v1/models")) {
    url = url.replace(/\/v1\/models$/, "/v1/chat/completions");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  let httpCode = 0;
  let body = "";
  let errorDetail = "";

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        model: modelId || provider.defaultModel,
        max_tokens: 1,
        messages: [{ role: "user", content: "ping" }],
      }),
      signal: controller.signal,
    });
    httpCode = res.status;
    body = await res.text().catch(() => "");
  } catch (err) {
    if (err.name === "AbortError") {
      errorDetail = "timeout";
    } else {
      errorDetail = err.message || "Connection failed";
    }
  } finally {
    clearTimeout(timer);
  }

  const ms = Date.now() - start;
  let status;
  let detail;

  if (errorDetail) {
    status = errorDetail === "timeout" ? ModelStatus.NETWORK_ERROR : ModelStatus.NETWORK_ERROR;
    detail = errorDetail;
  } else if (httpCode === 200) {
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

  const result = { status, ms, detail, testedAt: new Date().toISOString() };
  probeCache.set(cacheKey, result);
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
  probeCache.clear();
}
