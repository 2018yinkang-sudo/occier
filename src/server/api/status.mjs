import { getToolStatus } from "../../services/tools.mjs";
import { getProviderStatus } from "../../services/provider.mjs";
import { getNetworkStatus } from "../../services/network.mjs";
import { listCredentials } from "../../services/vault.mjs";

export const statusApi = {
  async get() {
    const [tools, providers, network, vault] = await Promise.all([
      getToolStatus(),
      getProviderStatus(),
      getNetworkStatus(),
      listCredentials(),
    ]);
    return {
      ok: true,
      data: { tools, providers, network, vault },
    };
  },
};
