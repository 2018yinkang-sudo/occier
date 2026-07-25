import { createStore } from "../store/credential-store.mjs";

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
  const store = createStore();
  await store.set(key.trim(), { type, value, updatedAt: new Date().toISOString() });
  return { ok: true, data: { key: key.trim(), type, fingerprint: value.slice(0, 4) + "****" + value.slice(-4) } };
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
