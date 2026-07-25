import { describe, it, expect, vi, beforeEach } from "vitest";

const getToolStatus = vi.fn();
const installTool = vi.fn();
const updateTool = vi.fn();

vi.mock("../../services/tools.mjs", () => ({
  getToolStatus,
  installTool,
  updateTool,
}));

function createMockTerm() {
  const lines = [];

  function term(s) {
    if (s !== undefined) lines.push(String(s));
    return term;
  }

  term.moveTo = () => {};
  term.height = 24;
  term.width = 80;

  const props = [
    "bold", "gray", "cyan", "green", "yellow", "white", "black", "brightWhite",
    "brightGreen", "brightYellow", "brightCyan", "bgGray", "bgBlack", "styleReset",
  ];
  for (const prop of props) {
    term[prop] = (...args) => {
      if (args.length > 0) lines.push(String(args.join("")));
      return term;
    };
  }

  return { term, lines };
}

describe("tools panel interactivity", () => {
  beforeEach(async () => {
    vi.resetModules();
    getToolStatus.mockReset();
    installTool.mockReset();
    updateTool.mockReset();
  });

  it("handleAction installs Claude when not installed", async () => {
    getToolStatus.mockResolvedValue({
      claude: { installed: false, version: null },
      opencode: { installed: false, version: null },
      gh: { installed: false, loggedIn: false },
    });
    installTool.mockResolvedValue({ installed: true });

    const tools = await import("./tools.mjs");
    const { term } = createMockTerm();
    await tools.renderPanel(term);

    const message = await tools.handleAction(term, "claude");
    expect(installTool).toHaveBeenCalledWith("claude");
    expect(message).toBe("Claude Code installed");
  });

  it("handleAction updates Claude when already installed", async () => {
    getToolStatus.mockResolvedValue({
      claude: { installed: true, version: "1.0" },
      opencode: { installed: false, version: null },
      gh: { installed: false, loggedIn: false },
    });
    updateTool.mockResolvedValue({ installed: true });

    const tools = await import("./tools.mjs");
    const { term } = createMockTerm();
    await tools.renderPanel(term);

    const message = await tools.handleAction(term, "claude");
    expect(updateTool).toHaveBeenCalledWith("claude");
    expect(message).toBe("Claude Code updated");
  });

  it("handleAction installs OpenCode", async () => {
    getToolStatus.mockResolvedValue({
      claude: { installed: false, version: null },
      opencode: { installed: false, version: null },
      gh: { installed: false, loggedIn: false },
    });
    installTool.mockResolvedValue({ installed: true });

    const tools = await import("./tools.mjs");
    const { term } = createMockTerm();
    await tools.renderPanel(term);

    const message = await tools.handleAction(term, "opencode");
    expect(installTool).toHaveBeenCalledWith("opencode");
    expect(message).toBe("OpenCode installed");
  });

  it("handleAction returns a hint for GitHub CLI", async () => {
    getToolStatus.mockResolvedValue({
      claude: { installed: false, version: null },
      opencode: { installed: false, version: null },
      gh: { installed: false, loggedIn: false },
    });

    const tools = await import("./tools.mjs");
    const { term } = createMockTerm();
    await tools.renderPanel(term);

    const message = await tools.handleAction(term, "gh");
    expect(message).toContain("GitHub CLI");
  });

  it("handleAction surfaces installation errors", async () => {
    getToolStatus.mockResolvedValue({
      claude: { installed: false, version: null },
      opencode: { installed: false, version: null },
      gh: { installed: false, loggedIn: false },
    });
    installTool.mockRejectedValue(new Error("network failure"));

    const tools = await import("./tools.mjs");
    const { term } = createMockTerm();
    await tools.renderPanel(term);

    const message = await tools.handleAction(term, "claude");
    expect(message).toBe("Error: network failure");
  });
});
