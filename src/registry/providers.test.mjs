import { describe, it, expect } from "vitest";
import { getProvider, getProviderSafe, allProviders, providerChoices, setVaultProviders } from "./providers.mjs";

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

describe("provider registry — vault model-key providers", () => {
  it("vault providers merge into allProviders and are resolvable", () => {
    setVaultProviders([
      {
        id: "my_vault_mk",
        label: "My Vault MK",
        protocol: "anthropic",
        authType: "api_key",
        envVarName: "MY_VAULT_MK",
        baseURL: "https://api.example.com/anthropic",
        healthUrl: "https://api.example.com/anthropic/v1/messages",
        models: [],
        defaultModel: null,
        claudeEnv: {},
        source: "vault",
      },
    ]);
    const all = allProviders();
    expect(all.some((p) => p.id === "my_vault_mk")).toBe(true);
    const p = getProvider("my_vault_mk");
    expect(p.protocol).toBe("anthropic");
    expect(getProviderSafe("my_vault_mk")).toBeTruthy();
  });

  it("vault providers take precedence over builtin with same id", () => {
    setVaultProviders([{ id: "deepseek", label: "Override", protocol: "openai", envVarName: "X" }]);
    expect(getProvider("deepseek").label).toBe("Override");
    // restore
    setVaultProviders([]);
  });

  // Restore empty cache so other test files / later runs are unaffected.
  it("clears vault cache", () => {
    setVaultProviders([]);
    expect(allProviders()).toHaveLength(7);
  });
});
