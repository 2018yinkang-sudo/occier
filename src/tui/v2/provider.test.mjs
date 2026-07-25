import { describe, it, expect, vi, beforeEach } from "vitest";

const getProviderStatus = vi.fn();
const testProviderConnectivity = vi.fn();
const connectProvider = vi.fn();

vi.mock("../../services/provider.mjs", () => ({
  getProviderStatus,
  testProviderConnectivity,
  connectProvider,
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
    "brightGreen", "brightCyan", "bgGray", "bgBlack", "styleReset",
  ];
  for (const prop of props) {
    term[prop] = (...args) => {
      if (args.length > 0) lines.push(String(args.join("")));
      return term;
    };
  }

  return { term, lines };
}

describe("provider panel interactivity", () => {
  beforeEach(async () => {
    vi.resetModules();
    getProviderStatus.mockReset();
    testProviderConnectivity.mockReset();
    connectProvider.mockReset();
  });

  it("handleAction returns an input spec for an unconfigured provider", async () => {
    getProviderStatus.mockResolvedValue([
      { id: "openai", label: "OpenAI", configured: false, protocol: "openai" },
    ]);

    const provider = await import("./provider.mjs");
    const { term } = createMockTerm();
    await provider.renderPanel(term);

    const result = await provider.handleAction(term, "openai");
    expect(result).toHaveProperty("input");
    expect(result.input.title).toContain("OpenAI");
    expect(result.input.prompt).toContain("API key");
    expect(result.input.password).toBe(true);
    expect(typeof result.continue).toBe("function");
  });

  it("continue callback connects the provider and returns a success message", async () => {
    getProviderStatus.mockResolvedValue([
      { id: "openai", label: "OpenAI", configured: false, protocol: "openai" },
    ]);
    connectProvider.mockResolvedValue({ ok: true });

    const provider = await import("./provider.mjs");
    const { term } = createMockTerm();
    await provider.renderPanel(term);

    const result = await provider.handleAction(term, "openai");
    const message = await result.continue("sk-test-key");

    expect(connectProvider).toHaveBeenCalledWith("openai", "sk-test-key");
    expect(message).toBe("OpenAI connected");
  });

  it("continue callback surfaces a provider error", async () => {
    getProviderStatus.mockResolvedValue([
      { id: "openai", label: "OpenAI", configured: false, protocol: "openai" },
    ]);
    connectProvider.mockResolvedValue({ ok: false, error: "invalid key" });

    const provider = await import("./provider.mjs");
    const { term } = createMockTerm();
    await provider.renderPanel(term);

    const result = await provider.handleAction(term, "openai");
    const message = await result.continue("bad-key");

    expect(message).toBe("Error: invalid key");
  });

  it("handleAction returns reachability status for a configured provider", async () => {
    getProviderStatus.mockResolvedValue([
      { id: "anthropic", label: "Anthropic", configured: true, protocol: "anthropic", fingerprint: "abc" },
    ]);
    testProviderConnectivity.mockResolvedValue({ ok: true, data: { reachable: true } });

    const provider = await import("./provider.mjs");
    const { term } = createMockTerm();
    await provider.renderPanel(term);

    const message = await provider.handleAction(term, "anthropic");
    expect(testProviderConnectivity).toHaveBeenCalledWith("anthropic");
    expect(message).toBe("Anthropic is reachable");
  });

  it("handleAction returns null when cache is empty", async () => {
    const provider = await import("./provider.mjs");
    const { term } = createMockTerm();
    const message = await provider.handleAction(term, "openai");
    expect(message).toBeNull();
  });

  it("handleAction returns null for an unknown item id", async () => {
    getProviderStatus.mockResolvedValue([
      { id: "openai", label: "OpenAI", configured: false, protocol: "openai" },
    ]);

    const provider = await import("./provider.mjs");
    const { term } = createMockTerm();
    await provider.renderPanel(term);

    const message = await provider.handleAction(term, "unknown");
    expect(message).toBeNull();
  });
});
