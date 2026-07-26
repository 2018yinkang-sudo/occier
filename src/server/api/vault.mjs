import { listCredentials, setCredential, removeCredential } from "../../services/vault.mjs";

export const vaultApi = {
  async list() {
    const result = await listCredentials();
    return { ok: true, data: result };
  },

  async set(body) {
    const { key, value, type } = body;
    if (!key || !value) return { ok: false, error: "key and value are required" };
    const result = await setCredential(key, value, type || "other");
    return result;
  },

  async remove(key) {
    const result = await removeCredential(key);
    return result;
  },
};
