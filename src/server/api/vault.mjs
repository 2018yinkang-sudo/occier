import { listCredentials, setCredential, removeCredential, testCredential } from "../../services/vault.mjs";
import { listTypesForApi, getModelPresets } from "../../store/credential-types.mjs";

export const vaultApi = {
  async list() {
    // listCredentials already masks secrets; plaintext never reaches the API.
    return { ok: true, data: await listCredentials() };
  },

  // Form schema for the UI. Contains field definitions only — no secrets.
  async types() {
    return { ok: true, data: { types: listTypesForApi() } };
  },

  // Model-key presets (provider → endpoint_type + base_url).
  async presets() {
    return { ok: true, data: { presets: getModelPresets() } };
  },

  async set(body) {
    if (!body || typeof body !== "object") return { ok: false, error: "Invalid request body" };
    const { key, type, value, fields } = body;
    if (!key) return { ok: false, error: "key is required" };
    const typeId = type || "other";
    // Structured types (model_key) carry `fields`; all others carry `value`.
    const payload = fields !== undefined ? { fields } : { value };
    return setCredential(key, typeId, payload);
  },

  async remove(key) {
    return removeCredential(key);
  },

  async test(key) {
    return testCredential(key);
  },
};
