import { describe, it, expect } from "vitest";
import { getProvider, getProviderSafe, allProviders, providerChoices } from "./providers.mjs";

describe("provider registry", () => {
  it("has 7 built-in providers", () => {
    expect(allProviders()).toHaveLength(7);
  });

  it("deepseek has expected properties", () => {
    const p = getProvider("deepseek");
    expect(p.label).toBe("DeepSeek");
    expect(p.protocol).toBe("anthropic");
    expect(p.authType).toBe("api_key");
    expect(p.models).toHaveLength(2);
    expect(p.defaultModel).toBe("deepseek-v4-pro[1m]");
  });

  it("kimi has kimi-k3 as default model", () => {
    const p = getProvider("kimi");
    expect(p.defaultModel).toBe("kimi-k3[1m]");
  });

  it("anthropic has no default model and no baseURL", () => {
    const p = getProvider("anthropic");
    expect(p.baseURL).toBe("");
    expect(p.defaultModel).toBeNull();
    expect(p.healthUrl).toBeNull();
  });

  it("openai is registered with protocol openai", () => {
    const p = getProvider("openai");
    expect(p.protocol).toBe("openai");
    expect(p.envVarName).toBe("OPENAI_API_KEY");
  });

  it("zhipu is registered with GLM models", () => {
    const p = getProvider("zhipu");
    expect(p.models.map((m) => m.id)).toContain("glm-4");
    expect(p.models.map((m) => m.id)).toContain("glm-4-flash");
  });

  it("getProviderSafe returns null for unknown", () => {
    expect(getProviderSafe("unknown")).toBeNull();
  });

  it("providerChoices returns formatted choices", () => {
    const choices = providerChoices();
    expect(choices).toHaveLength(7);
    for (const c of choices) {
      expect(c).toHaveProperty("name");
      expect(c).toHaveProperty("value");
    }
  });
});
