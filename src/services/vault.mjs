import { createStore, maskValue } from "../store/credential-store.mjs";

const KEY_PATTERN = /^[a-z][a-z0-9_]{0,63}$/i;

export async function listCredentials() {
  const store = createStore();
  const entries = await store.list();
  return {
    count: entries.length,
    credentials: entries.map((e) => ({
      key: e.key,
      type: e.type,
      fingerprint: e.fingerprint,
      updatedAt: e.updatedAt,
    })),
  };
}

export async function setCredential(key, value, type = "api_key") {
  if (!key || !value) return { ok: false, error: "Key and value are required" };
  const trimmedKey = key.trim();
  if (!KEY_PATTERN.test(trimmedKey)) {
    return { ok: false, error: "Invalid key name — use letters, digits, and underscores only (max 64 chars)" };
  }
  const store = createStore();
  await store.set(trimmedKey, { type, value, updatedAt: new Date().toISOString() });
  return { ok: true, data: { key: trimmedKey, type, fingerprint: maskValue(value) } };
}

export async function removeCredential(key) {
  if (!key) return { ok: false, error: "Key is required" };
  const store = createStore();
  await store.delete(key);
  return { ok: true, data: { key } };
}

export async function getCredential(key) {
  const store = createStore();
  const data = await store.get(key);
  if (!data) return { ok: false, error: "Not found" };
  return { ok: true, data: { key, type: data.type, value: data.value } };
}
