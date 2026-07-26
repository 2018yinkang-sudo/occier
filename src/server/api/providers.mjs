import { getProviderStatus, testProviderConnectivity } from "../../services/provider.mjs";

export const providersApi = {
  async list() {
    const providers = await getProviderStatus();
    return { ok: true, data: providers };
  },

  async test(id) {
    const result = await testProviderConnectivity(id);
    return result;
  },
};
