import { describe, it, expect } from "vitest";
import {
  CREDENTIAL_TYPES,
  ENDPOINT_TYPES,
  MODEL_PRESETS,
  SYSTEM_USERNAME,
  XRAY_PROTOCOLS,
  XRAY_METHODS,
  getType,
  isStructuredType,
  listTypes,
  listTypesForApi,
  getModelPresets,
  secretFieldsFor,
  isValidKeyName,
  validateCredential,
  maskEntry,
  maskValue,
  publicFieldsFor,
  defaultKeyFor,
  fieldMatchesDepend,
} from "./credential-types.mjs";

describe("credential-types — registry", () => {
  it("model_key, github_token, proxy_password are structured", () => {
    const structured = CREDENTIAL_TYPES.filter((t) => t.structured).map((t) => t.id);
    expect(structured).toEqual(["model_key", "github_token", "proxy_password"]);
  });

  it("isStructuredType recognises structured types", () => {
    expect(isStructuredType("model_key")).toBe(true);
    expect(isStructuredType("github_token")).toBe(true);
    expect(isStructuredType("proxy_password")).toBe(true);
    expect(isStructuredType("sudo_password")).toBe(false);
    expect(isStructuredType("unknown")).toBe(false);
  });

  it("model_key declares endpoint_type, base_url, api_key (no model)", () => {
    const t = getType("model_key");
    const names = t.fields.map((f) => f.name);
    expect(names).toEqual(expect.arrayContaining(["endpoint_type", "base_url", "api_key"]));
    expect(names).not.toContain("model");
    expect(secretFieldsFor("model_key")).toEqual(["api_key"]);
  });

  it("github_token is fixed-key structured with token + email", () => {
    const t = getType("github_token");
    expect(t.keyMode).toBe("fixed");
    expect(t.fixedKey).toBe("github_token");
    expect(t.fields.map((f) => f.name)).toEqual(expect.arrayContaining(["token", "email"]));
    expect(secretFieldsFor("github_token")).toEqual(["token"]);
  });

  it("proxy_password declares protocol + conditional fields", () => {
    const t = getType("proxy_password");
    expect(t.keyMode).toBe("user");
    expect(t.fields.map((f) => f.name)).toEqual(expect.arrayContaining([
      "protocol", "username", "password", "method", "id", "security", "flow", "email",
    ]));
    expect(secretFieldsFor("proxy_password")).toEqual(expect.arrayContaining(["password", "id"]));
  });

  it("sudo_password is non-structured with default keyMode", () => {
    const t = getType("sudo_password");
    expect(t.structured).toBe(false);
    expect(t.keyMode).toBe("default");
  });

  it("api_key is hidden from the form but recognized by the type system", () => {
    expect(getType("api_key")).toBeTruthy();
    expect(getType("api_key").hidden).toBe(true);
    expect(listTypes().some((t) => t.id === "api_key")).toBe(false);
    expect(listTypesForApi().some((t) => t.id === "api_key")).toBe(false);
    expect(isValidKeyName("deepseek_api_key")).toBe(true);
  });

  it("other is NOT in the registry at all", () => {
    expect(getType("other")).toBeNull();
  });

  it("listTypes and listTypesForApi return 4 visible types", () => {
    expect(listTypes().length).toBe(4);
    expect(listTypesForApi().length).toBe(4);
    // CREDENTIAL_TYPES includes hidden api_key = 5 total.
    expect(CREDENTIAL_TYPES.length).toBe(5);
  });

  it("listTypesForApi exposes keyMode and fixedKey", () => {
    const api = listTypesForApi();
    const gh = api.find((t) => t.id === "github_token");
    expect(gh.keyMode).toBe("fixed");
    expect(gh.fixedKey).toBe("github_token");
    const mk = api.find((t) => t.id === "model_key");
    expect(mk.keyMode).toBe("user");
    expect(mk.fixedKey).toBeNull();
  });

  it("returns null for unknown type", () => {
    expect(getType("nope")).toBeNull();
  });
});

describe("credential-types — dependsOn", () => {
  it("fieldMatchesDepend resolves single and array values", () => {
    expect(fieldMatchesDepend({ field: "a", value: "x" }, { a: "x" })).toBe(true);
    expect(fieldMatchesDepend({ field: "a", value: "x" }, { a: "y" })).toBe(false);
    expect(fieldMatchesDepend({ field: "a", value: ["x", "z"] }, { a: "z" })).toBe(true);
    expect(fieldMatchesDepend({ field: "a", value: ["x", "z"] }, { a: "w" })).toBe(false);
    expect(fieldMatchesDepend(null, {})).toBe(true);
    expect(fieldMatchesDepend(undefined, {})).toBe(true);
  });

  it("proxy_password fields with dependsOn are conditional", () => {
    const t = getType("proxy_password");
    const usernameF = t.fields.find((f) => f.name === "username");
    expect(usernameF.dependsOn).toEqual({ field: "protocol", value: ["http", "socks"] });
    const passwordF = t.fields.find((f) => f.name === "password");
    expect(passwordF.dependsOn).toEqual({ field: "protocol", value: ["http", "socks", "shadowsocks", "trojan"] });
    const idF = t.fields.find((f) => f.name === "id");
    expect(idF.dependsOn).toEqual({ field: "protocol", value: ["vless", "vmess"] });
  });
});

describe("credential-types — endpoint types", () => {
  it("supports anthropic, openai, gemini", () => {
    expect(ENDPOINT_TYPES).toEqual(["anthropic", "openai", "gemini"]);
  });

  it("presets include major Chinese providers", () => {
    const ids = MODEL_PRESETS.map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining(["deepseek", "kimi", "zhipu", "qwen", "openrouter", "gemini"]));
    const qwen = getModelPresets().find((p) => p.id === "qwen");
    expect(qwen.endpoint_type).toBe("openai");
    expect(qwen.base_url).toContain("compatible-mode");
  });
});

describe("credential-types — xray protocols", () => {
  it("includes all major xray proxy protocols", () => {
    expect(XRAY_PROTOCOLS).toEqual(expect.arrayContaining([
      "http", "socks", "shadowsocks", "trojan", "vless", "vmess",
    ]));
    expect(XRAY_METHODS).toEqual(expect.arrayContaining([
      "2022-blake3-aes-256-gcm", "aes-128-gcm", "chacha20-poly1305",
    ]));
  });
});

describe("credential-types — key name validation", () => {
  it("accepts valid names", () => {
    expect(isValidKeyName("deepseek_api")).toBe(true);
    expect(isValidKeyName("github_token")).toBe(true);
  });

  it("rejects invalid names", () => {
    expect(isValidKeyName("1starts_with_digit")).toBe(false);
    expect(isValidKeyName("")).toBe(false);
  });
});

describe("credential-types — validateCredential", () => {
  it("validates a model_key", () => {
    const r = validateCredential("model_key", {
      fields: { endpoint_type: "openai", base_url: "https://x.com/v1", api_key: "sk-x" },
    });
    expect(r.ok).toBe(true);
  });

  it("rejects missing required model_key fields", () => {
    const r = validateCredential("model_key", { fields: { endpoint_type: "openai", base_url: "https://x.com/v1" } });
    expect(r.ok).toBe(false);
  });

  it("validates proxy_password with dependsOn (shadowsocks)", () => {
    const r = validateCredential("proxy_password", {
      fields: { protocol: "shadowsocks", method: "aes-256-gcm", password: "ss-pass" },
    });
    expect(r.ok).toBe(true);
  });

  it("skips password for vless (dependsOn mismatch)", () => {
    const r = validateCredential("proxy_password", {
      fields: { protocol: "vless", id: "uuid", flow: "xtls-rprx-vision" },
    });
    expect(r.ok).toBe(true);
  });

  it("rejects vless without id", () => {
    const r = validateCredential("proxy_password", { fields: { protocol: "vless" } });
    expect(r.ok).toBe(false);
  });

  it("rejects non-string value for non-structured", () => {
    expect(validateCredential("sudo_password", { value: "" }).ok).toBe(false);
    expect(validateCredential("sudo_password", { value: 123 }).ok).toBe(false);
  });

  it("rejects unknown type", () => {
    expect(validateCredential("nope", { value: "x" }).ok).toBe(false);
  });
});

describe("credential-types — masking", () => {
  it("maskEntry masks model_key api_key", () => {
    const fp = maskEntry({ type: "model_key", fields: { api_key: "sk-abcdef123456" } });
    expect(fp).toBe("****3456");
  });

  it("maskEntry masks github_token token", () => {
    const fp = maskEntry({ type: "github_token", fields: { token: "ghp_abcdef1234" } });
    expect(fp).toBe("****1234");
  });

  it("maskEntry masks proxy_password (shadowsocks) via password field", () => {
    const fp = maskEntry({ type: "proxy_password", fields: { protocol: "shadowsocks", password: "ss-key-1234", method: "aes-256-gcm" } });
    expect(fp).toBe("****1234");
  });

  it("maskEntry masks proxy_password (vless) via id field", () => {
    const fp = maskEntry({ type: "proxy_password", fields: { protocol: "vless", id: "uuid-1234" } });
    expect(fp).toBe("****1234");
  });

  it("maskEntry returns 'configured' for sudo_password", () => {
    expect(maskEntry({ type: "sudo_password", value: "hunter2" })).toBe("configured");
    expect(maskEntry({ type: "sudo_password" })).toBe("<not set>");
  });

  it("maskEntry handles legacy api_key with no type def (masked as string)", () => {
    const fp = maskEntry({ type: "api_key", value: "sk-legacy-1234" });
    expect(fp).toBe("****1234");
  });

  it("maskValue stays backwards compatible", () => {
    expect(maskValue("sk-abcdef123456")).toBe("****3456");
    expect(maskValue("hunter2", "sudo_password")).toBe("configured");
    expect(maskValue(undefined)).toBe("<not set>");
  });

  it("publicFieldsFor masks secret fields and passes others through", () => {
    const pub = publicFieldsFor("model_key", {
      endpoint_type: "openai",
      base_url: "https://x.com/v1",
      api_key: "sk-secret1234",
      label: "My Key",
    });
    expect(pub.api_key).toBe("****1234");
    expect(pub.base_url).toBe("https://x.com/v1");
    expect(pub.endpoint_type).toBe("openai");
    expect(pub.label).toBe("My Key");
  });

  it("publicFieldsFor returns undefined for non-structured", () => {
    expect(publicFieldsFor("sudo_password", { value: "x" })).toBeUndefined();
  });
});

describe("credential-types — sudo_password default key", () => {
  it("defaultKeyFor returns the OS username for sudo_password", () => {
    expect(defaultKeyFor("sudo_password")).toBe(SYSTEM_USERNAME);
    expect(typeof SYSTEM_USERNAME).toBe("string");
    expect(SYSTEM_USERNAME.length).toBeGreaterThan(0);
  });

  it("defaultKeyFor returns null for other types", () => {
    expect(defaultKeyFor("model_key")).toBeNull();
    expect(defaultKeyFor("unknown")).toBeNull();
  });

  it("listTypesForApi exposes defaultKey only for sudo_password", () => {
    const api = listTypesForApi();
    const sudo = api.find((t) => t.id === "sudo_password");
    const gh = api.find((t) => t.id === "github_token");
    expect(sudo.defaultKey).toBe(SYSTEM_USERNAME);
    expect(gh.defaultKey).toBeNull();
  });
});
