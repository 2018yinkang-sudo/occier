import { getToolStatus } from "../../services/tools.mjs";

export const toolsApi = {
  async list() {
    const tools = await getToolStatus();
    return { ok: true, data: tools };
  },

  async install(id) {
    const { installTool } = await import("../../services/tools.mjs");
    await installTool(id);
    return { ok: true, data: { installed: id } };
  },

  async update(id) {
    const { updateTool } = await import("../../services/tools.mjs");
    await updateTool(id);
    return { ok: true, data: { updated: id } };
  },
};
