import { createStore } from "../store/credential-store.mjs";
import { setVaultProviders } from "../registry/providers.mjs";
import { spawn } from "child_process";
import {
  getType,
  isStructuredType,
  validateCredential,
  isValidKeyName,
  maskEntry,
  publicFieldsFor,
  fieldMatchesDepend,
  defaultKeyFor,
} from "../store/credential-types.mjs";

// Re-export type/preset accessors for the API/CLI layers.
export { listTypesForApi, getModelPresets } from "../store/credential-types.mjs";

// ── read ──

export async function listCredentials() {
  const store = createStore();
  const entries = await store.list();
  // store.list() already masks secrets; fields is the non-secret projection.
  return {
    count: entries.length,
    credentials: entries.map((e) => ({
      key: e.key,
      type: e.type,
      fingerprint: e.fingerprint,
      fields: e.fields,
      updatedAt: e.updatedAt,
    })),
  };
}

// Plaintext read. Intended for CLI `vault get --reveal` only — the HTTP API
// never calls this.
export async function getCredential(key) {
  if (!key) return { ok: false, error: "Key is required" };
  const store = createStore();
  const data = await store.get(key);
  if (!data) return { ok: false, error: "Not found" };
  if (isStructuredType(data.type)) {
    return { ok: true, data: { key, type: data.type, fields: data.fields || {} } };
  }
  return { ok: true, data: { key, type: data.type || "api_key", value: data.value } };
}

// ── write ──

// setCredential(key, type, payload)
//   payload = { value }      for non-structured types (sudo_password)
//   payload = { fields: {} } for structured types (model_key, github_token, proxy_password)

// Only keep fields that match their dependsOn (if any); discard fields whose
// dependency condition isn't met. Trims string values.
function sanitizeFields(typeDef, input) {
  const out = {};
  const src = input && typeof input === "object" ? input : {};
  for (const f of typeDef.fields) {
    if (f.dependsOn && !fieldMatchesDepend(f.dependsOn, src)) continue;
    if (f.name in src) {
      const v = src[f.name];
      out[f.name] = typeof v === "string" ? v.trim() : v;
    }
  }
  return out;
}

export async function setCredential(key, type = "api_key", payload = {}) {
  const typeDef = getType(type);
  if (!typeDef) return { ok: false, error: `Unknown credential type: ${type}` };

  // Determine the effective storage key.
  let effectiveKey;
  if (typeDef.keyMode === "fixed" && typeDef.fixedKey) {
    effectiveKey = typeDef.fixedKey;
  } else {
    effectiveKey = String(key || "").trim();
    if (!effectiveKey && typeDef.keyMode === "default") {
      effectiveKey = defaultKeyFor(type) || "";
    }
  }
  if (!effectiveKey) return { ok: false, error: "Key is required" };
  if (!isValidKeyName(effectiveKey)) {
    return {
      ok: false,
      error: "Invalid key name — use letters, digits, underscores only (max 64 chars, must start with a letter)",
    };
  }

  const valid = validateCredential(type, payload);
  if (!valid.ok) return valid;

  const now = new Date().toISOString();
  const entry = typeDef.structured
    ? { type, fields: sanitizeFields(typeDef, payload.fields), updatedAt: now }
    : { type, value: String(payload.value), updatedAt: now };

  const store = createStore();
  await store.set(effectiveKey, entry);
  await refreshVaultProviders();

  return {
    ok: true,
    data: {
      key: effectiveKey,
      type,
      fingerprint: maskEntry(entry),
      fields: typeDef.structured ? publicFieldsFor(type, entry.fields) : undefined,
    },
  };
}

export async function removeCredential(key) {
  if (!key) return { ok: false, error: "Key is required" };
  const store = createStore();
  await store.delete(key);
  await refreshVaultProviders();
  return { ok: true, data: { key } };
}

// ── vault model keys → provider definitions ──

function deriveHealthUrl(endpointType, baseUrl) {
  if (!baseUrl) return null;
  const base = String(baseUrl).replace(/\/+$/, "");
  if (endpointType === "anthropic") return `${base}/v1/messages`;
  if (endpointType === "openai") return `${base}/models`;
  if (endpointType === "gemini") return `${base}/v1beta/models`;
  return null;
}

// Normalize stored model_key entries into provider objects that can be merged
// into the provider list. Secret material (api_key) is intentionally NOT
// included here — providers are definitions; the key is resolved separately
// from the vault by the credential key (= provider id).
export async function getVaultProviders() {
  const store = createStore();
  const entries = await store.list();
  const providers = [];
  for (const e of entries) {
    if (e.type !== "model_key" || !e.fields) continue;
    const f = e.fields;
    if (!f.endpoint_type || !f.base_url) continue;
    providers.push({
      id: e.key,
      label: f.label || e.key,
      description: "vault model key",
      protocol: f.endpoint_type,
      authType: "api_key",
      envVarName: e.key.toUpperCase(),
      baseURL: f.base_url,
      healthUrl: deriveHealthUrl(f.endpoint_type, f.base_url),
      models: [],
      defaultModel: null,
      claudeEnv: {},
      source: "vault",
    });
  }
  return providers;
}

// Populate the in-memory provider cache used by registry/providers.mjs so
// vault model keys appear in allProviders()/getProvider() without making
// those sync functions async. Called at startup and after every vault write.
export async function loadVaultProviders() {
  const providers = await getVaultProviders();
  setVaultProviders(providers);
  return providers;
}

// Best-effort cache refresh; never let cache failures break a vault write.
async function refreshVaultProviders() {
  try {
    await loadVaultProviders();
  } catch {
    // Vault may be temporarily unreadable (e.g. passphrase-gated in a
    // context without OCCIER_PASSPHRASE). The cache stays stale; listing
    // will retry on next loadVaultProviders() call.
  }
}

// ── connectivity / validity tests ──

function deriveTestUrl(endpointType, baseUrl) {
  const base = String(baseUrl || "").replace(/\/+$/, "");
  if (endpointType === "anthropic") return `${base}/v1/models`;
  if (endpointType === "openai") return `${base}/models`;
  if (endpointType === "gemini") return `${base}/v1beta/models`;
  return null;
}

function httpCmd(method, url, authHeader) {
  return `${method} ${url}${authHeader ? ` [${authHeader}]` : ""}`;
}

// Check if an API key works with a given provider endpoint. Does an
// authenticated GET to the derived models endpoint. Exported so both
// testCredential (vault model keys) and testProviderConnectivity (builtin)
// use the same logic. The API key is never printed or logged.
export async function checkProviderConnectivity(protocol, baseURL, apiKey) {
  const testUrl = deriveTestUrl(protocol, baseURL);
  if (!testUrl) {
    return { reachable: false, keyValid: null, httpCode: null, detail: `Unsupported protocol: ${protocol}`, commands: [] };
  }

  let url, headers = {}, authLabel = "";
  if (protocol === "anthropic") { url = testUrl; headers["x-api-key"] = apiKey; authLabel = "x-api-key: ***"; }
  else if (protocol === "openai") { url = testUrl; headers["Authorization"] = `Bearer ${apiKey}`; authLabel = "Authorization: Bearer ***"; }
  else if (protocol === "gemini") { url = `${testUrl}?key=***`; }

  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    let body = "";
    try { if (typeof res.text === "function") body = await res.text(); } catch { /* plain-object mock */ }
    const keyValid = res.status === 200 ? true : (res.status === 401 || res.status === 403 ? false : null);
    return {
      reachable: true, keyValid, httpCode: res.status,
      detail: keyValid === true ? "Key valid" : keyValid === false ? "Key invalid (unauthorized)" : `Reachable; key validation unavailable (HTTP ${res.status})`,
      commands: [{
        cmd: httpCmd("GET", url, authLabel),
        exitCode: res.status, stdout: body.slice(0, 500), stderr: "",
        duration: Date.now() - start,
      }],
    };
  } catch (err) {
    return {
      reachable: false, keyValid: null, httpCode: null,
      detail: err.name === "AbortError" ? "Connection timed out" : err.message,
      commands: [{
        cmd: httpCmd("GET", url, authLabel),
        exitCode: -1, stdout: "", stderr: err.name === "AbortError" ? "Connection timed out" : err.message,
        duration: Date.now() - start,
      }],
    };
  } finally { clearTimeout(timer); }
}

async function testModelKey(fields) {
  const { endpoint_type, base_url, api_key } = fields;
  return checkProviderConnectivity(endpoint_type, base_url, api_key);
}

async function testGitHubToken(token) {
  const url = "https://api.github.com/user";
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  let cmdResult;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `token ${token}` },
      signal: controller.signal,
    });
    let body = "";
    try { if (typeof res.text === "function") body = await res.text(); } catch { /* plain-object mock */ }
    const keyValid = res.status === 200 ? true : (res.status === 401 || res.status === 403 ? false : null);
    cmdResult = {
      cmd: httpCmd("GET", url, "Authorization: token ***"),
      exitCode: res.status, stdout: body.slice(0, 500), stderr: "",
      duration: Date.now() - start,
    };
    return {
      reachable: true, keyValid, httpCode: res.status,
      detail: keyValid === true ? "Token valid" : keyValid === false ? "Token invalid (unauthorized)" : `HTTP ${res.status}`,
      commands: [cmdResult],
    };
  } catch (err) {
    cmdResult = {
      cmd: httpCmd("GET", url, "Authorization: token ***"),
      exitCode: -1, stdout: "", stderr: err.name === "AbortError" ? "Connection timed out" : err.message,
      duration: Date.now() - start,
    };
    return {
      reachable: false, keyValid: null,
      detail: err.name === "AbortError" ? "Connection timed out" : err.message,
      commands: [cmdResult],
    };
  } finally { clearTimeout(timer); }
}

async function testSudoPassword(password, credKey) {
  const commands = [];
  const { run } = await import("../exec/runner.mjs");

  if (credKey) {
    const r = await run("id", [credKey], { timeout: 3000 });
    commands.push({ cmd: `id ${credKey}`, exitCode: r.exitCode, stdout: r.stdout.trim(), stderr: r.stderr.trim(), duration: r.duration });
    if (r.exitCode !== 0) {
      return { reachable: true, keyValid: false, httpCode: null, detail: `User '${credKey}' does not exist on this system`, commands };
    }
  }

  const nopasswd = await run("sudo", ["-k", "-n", "true"], { timeout: 5000 });
  commands.push({ cmd: "sudo -k -n true", exitCode: nopasswd.exitCode, stdout: nopasswd.stdout.trim(), stderr: nopasswd.stderr.trim(), duration: nopasswd.duration });
  if (nopasswd.exitCode === 0) {
    return { reachable: true, keyValid: null, httpCode: null, detail: "sudo is NOPASSWD — password not required, cannot validate", commands };
  }
  if (nopasswd.exitCode < 0) {
    return { reachable: false, keyValid: null, httpCode: null, detail: nopasswd.stderr.trim() || "sudo not available on this system", commands };
  }

  const start = Date.now();
  return new Promise((resolve) => {
    const child = spawn("sudo", ["-S", "--", "id"], { stdio: ["pipe", "pipe", "pipe"], timeout: 10000 });
    let out = "", err = "";
    child.stdout.on("data", (d) => out += d);
    child.stderr.on("data", (d) => err += d);
    child.stdin.write(password + "\n");
    child.stdin.end();
    child.on("exit", (code) => {
      const cmdResult = { cmd: "sudo -S -- id [password via stdin]", exitCode: code ?? -1, stdout: out.trim(), stderr: err.trim(), duration: Date.now() - start };
      commands.push(cmdResult);
      if (code === 0 && out.includes("uid=0")) {
        resolve({ reachable: true, keyValid: true, httpCode: null, detail: "Password valid — sudo works", commands });
      } else {
        const hint = err.includes("Sorry") ? "sudo rejected the password" : `exit code ${code}`;
        resolve({ reachable: true, keyValid: false, httpCode: null, detail: `Password incorrect — ${hint}`, commands });
      }
    });
    child.on("error", (e) => {
      commands.push({ cmd: "sudo -S -- id [password via stdin]", exitCode: -1, stdout: "", stderr: e.message, duration: Date.now() - start });
      resolve({ reachable: false, keyValid: null, httpCode: null, detail: e.message, commands });
    });
  });
}

function testProxyPassword(fields) {
  const { protocol, username, password, method, id } = fields || {};
  const missing = [];
  if (protocol === "http" || protocol === "socks") {
    if (!username) missing.push("username");
    if (!password) missing.push("password");
  } else if (protocol === "shadowsocks") {
    if (!method) missing.push("method");
    if (!password) missing.push("password");
  } else if (protocol === "trojan") {
    if (!password) missing.push("password");
  } else if (protocol === "vless" || protocol === "vmess") {
    if (!id) missing.push("id");
  } else {
    return { reachable: null, keyValid: null, httpCode: null, detail: `Unknown protocol: ${protocol}`, commands: [] };
  }
  if (missing.length > 0) {
    return { reachable: null, keyValid: null, httpCode: null, detail: `Missing required fields: ${missing.join(", ")}`, commands: [] };
  }
  return { reachable: null, keyValid: null, httpCode: null, detail: `Fields complete for ${protocol}`, commands: [] };
}

export async function testCredential(key) {
  const store = createStore();
  const data = await store.get(key);
  if (!data) return { ok: false, error: "Credential not found" };

  let result;
  switch (data.type) {
    case "model_key": {
      if (!data.fields) return { ok: false, error: "Not a model_key credential" };
      result = await testModelKey(data.fields);
      break;
    }
    case "github_token": {
      const token = data.fields?.token || data.value;
      if (!token) return { ok: false, error: "Token not set" };
      result = await testGitHubToken(token);
      break;
    }
    case "sudo_password": {
      if (!data.value) return { ok: false, error: "Password not set" };
      result = await testSudoPassword(data.value, key);
      break;
    }
    case "proxy_password": {
      result = testProxyPassword(data.fields);
      break;
    }
    default:
      return { ok: false, error: `Type '${data.type}' is not testable` };
  }

  return { ok: true, data: result };
}
