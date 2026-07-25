import { describe, it, expect } from "vitest";
import { getProvider, allProviders, providerChoices } from "./registry.mjs";

describe("getProvider", () => {
  it("returns deepseek provider", () => {
    const p = getProvider("deepseek");
    expect(p.id).toBe("deepseek");
    expect(p.label).toBe("DeepSeek");
    expect(p.envVarName).toBe("DEEPSEEK_API_KEY");
    expect(p.claudeEnv.ANTHROPIC_BASE_URL).toBe("https://api.deepseek.com/anthropic");
  });

  it("returns kimi provider", () => {
    const p = getProvider("kimi");
    expect(p.id).toBe("kimi");
    expect(p.envVarName).toBe("KIMI_API_KEY");
    expect(p.claudeEnv.ANTHROPIC_BASE_URL).toBe("https://api.moonshot.cn/anthropic");
  });

  it("returns anthropic provider", () => {
    const p = getProvider("anthropic");
    expect(p.id).toBe("anthropic");
    expect(p.envVarName).toBe("ANTHROPIC_API_KEY_OFFICIAL");
    expect(p.healthUrl).toBeNull();
  });

  it("throws for unknown provider", () => {
    expect(() => getProvider("unknown")).toThrow("Unknown");
  });
});

describe("allProviders", () => {
  it("returns all seven providers", () => {
    const providers = allProviders();
    expect(providers).toHaveLength(7);
    expect(providers.map((p) => p.id).sort()).toEqual([
      "anthropic",
      "deepseek",
      "kimi",
      "openai",
      "openai-compatible",
      "openrouter",
      "zhipu",
    ]);
  });
});

describe("providerChoices", () => {
  it("returns formatted choices for all providers", () => {
    const choices = providerChoices();
    expect(choices).toHaveLength(7);
    for (const c of choices) {
      expect(c).toHaveProperty("name");
      expect(c).toHaveProperty("value");
    }
  });
});
