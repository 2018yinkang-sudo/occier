import { describe, it, expect } from "vitest";
import { getProvider, allProviders, providerChoices } from "./registry.mjs";

describe("getProvider", () => {
  it("returns deepseek provider", () => {
    const p = getProvider("deepseek");
    expect(p.id).toBe("deepseek");
    expect(p.label).toBe("DeepSeek");
    expect(p.envVar).toBe("DEEPSEEK_API_KEY");
    expect(p.env.ANTHROPIC_BASE_URL).toBe("https://api.deepseek.com/anthropic");
  });

  it("returns kimi provider", () => {
    const p = getProvider("kimi");
    expect(p.id).toBe("kimi");
    expect(p.envVar).toBe("KIMI_API_KEY");
    expect(p.env.ANTHROPIC_BASE_URL).toBe("https://api.moonshot.cn/anthropic");
  });

  it("returns anthropic provider", () => {
    const p = getProvider("anthropic");
    expect(p.id).toBe("anthropic");
    expect(p.envVar).toBe("ANTHROPIC_API_KEY_OFFICIAL");
    expect(p.healthUrl).toBeNull();
  });

  it("throws for unknown provider", () => {
    expect(() => getProvider("unknown")).toThrow("Unknown provider");
  });
});

describe("allProviders", () => {
  it("returns all three providers", () => {
    const providers = allProviders();
    expect(providers).toHaveLength(3);
    expect(providers.map((p) => p.id).sort()).toEqual([
      "anthropic",
      "deepseek",
      "kimi",
    ]);
  });
});

describe("providerChoices", () => {
  it("returns formatted choices for inquirer", () => {
    const choices = providerChoices();
    expect(choices).toHaveLength(3);
    for (const c of choices) {
      expect(c).toHaveProperty("name");
      expect(c).toHaveProperty("value");
      expect(["deepseek", "kimi", "anthropic"]).toContain(c.value);
    }
  });
});
