import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { tmpdir } from "os";
import { join } from "path";
import { mkdtempSync, rmSync } from "fs";

// Set XDG_CONFIG_HOME BEFORE importing vault.mjs / credential-store.mjs
// so createStore() writes to a temp vault, not the user's real vault.
const _xdg = mkdtempSync(join(tmpdir(), "occier-vault-xdg-"));
process.env.XDG_CONFIG_HOME = _xdg;

let tmpDir;
let credFile;

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "occier-vault-test-"));
  credFile = join(tmpDir, "creds.json");
});

afterAll(() => {
  try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  try { rmSync(_xdg, { recursive: true, force: true }); } catch { /* ignore */ }
});

describe("services/vault — listCredentials", () => {
  it("returns empty list for new store", async () => {
    const { listCredentials } = await import("./vault.mjs");
    const result = await listCredentials();
    expect(result).toHaveProperty("count");
    expect(result).toHaveProperty("credentials");
    expect(Array.isArray(result.credentials)).toBe(true);
  });
});

describe("services/vault — setCredential and get", () => {
  it("stores and retrieves a credential", async () => {
    const { createStore, maskValue } = await import("../store/credential-store.mjs");
    const store = createStore("plain", { filePath: credFile });
    await store.set("test_key", { type: "sudo_password", value: "sk-1234567890abcdef", updatedAt: new Date().toISOString() });
    const entry = await store.get("test_key");
    expect(entry).toBeTruthy();
    expect(entry.type).toBe("sudo_password");
    expect(entry.value).toBe("sk-1234567890abcdef");
    expect(maskValue(entry.value)).toBe("****cdef");
  });

  it("returns null for missing key", async () => {
    const { createStore } = await import("../store/credential-store.mjs");
    const store = createStore("plain", { filePath: credFile });
    const entry = await store.get("nonexistent");
    expect(entry).toBeNull();
  });
});

describe("services/vault — removeCredential", () => {
  it("removes a stored credential", async () => {
    const { createStore } = await import("../store/credential-store.mjs");
    const store = createStore("plain", { filePath: credFile });
    await store.set("del_key", { type: "sudo_password", value: "tmp", updatedAt: new Date().toISOString() });
    let entry = await store.get("del_key");
    expect(entry).toBeTruthy();
    await store.delete("del_key");
    entry = await store.get("del_key");
    expect(entry).toBeNull();
  });
});

describe("services/vault — setCredential service wrapper", () => {
  it("returns ok with fingerprint (sudo_password)", async () => {
    const { setCredential } = await import("./vault.mjs");
    const result = await setCredential("svc_test", "sudo_password", { value: "my-secret-value" });
    expect(result.ok).toBe(true);
    expect(result.data.key).toBe("svc_test");
    expect(result.data.type).toBe("sudo_password");
    // sudo_password masks as "configured", not per-character.
    expect(result.data.fingerprint).toBe("configured");
  });

  it("rejects empty key for user-mode type", async () => {
    const { setCredential } = await import("./vault.mjs");
    // model_key is keyMode "user" — no default to rescue empty input.
    const result = await setCredential("", "model_key", {
      fields: { endpoint_type: "openai", base_url: "https://x.com/v1", api_key: "sk-x" },
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("fixed keyMode enforces the fixed key", async () => {
    const { setCredential } = await import("./vault.mjs");
    // github_token is fixedKey "github_token". Whatever key the caller passes
    // is overridden; the stored entry uses the fixed key.
    const result = await setCredential("whatever_alias", "github_token", { fields: { token: "ghp_abcdef" } });
    expect(result.ok).toBe(true);
    expect(result.data.key).toBe("github_token");
    expect(result.data.type).toBe("github_token");
  });

  it("rejects unknown type", async () => {
    const { setCredential } = await import("./vault.mjs");
    const result = await setCredential("x", "api_key", { value: "v" });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Unknown/);
  });
});

describe("services/vault — model_key (structured, no model field)", () => {
  it("stores a model_key without model", async () => {
    const { setCredential } = await import("./vault.mjs");
    const result = await setCredential("my_glm", "model_key", {
      fields: {
        endpoint_type: "openai",
        base_url: "https://open.bigmodel.cn/api/paas/v4",
        api_key: "sk-glm-abcdef123456",
        label: "My GLM",
      },
    });
    expect(result.ok).toBe(true);
    expect(result.data.type).toBe("model_key");
    expect(result.data.fingerprint).toBe("****3456");
    expect(result.data.fields.api_key).toBe("****3456");
    expect(result.data.fields.label).toBe("My GLM");
  });

  it("rejects invalid base_url", async () => {
    const { setCredential } = await import("./vault.mjs");
    const result = await setCredential("bad_url", "model_key", {
      fields: { endpoint_type: "openai", base_url: "not-a-url", api_key: "sk-x" },
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Base URL/i);
  });

  it("accepts http base_url for localhost", async () => {
    const { setCredential } = await import("./vault.mjs");
    const result = await setCredential("local_url", "model_key", {
      fields: { endpoint_type: "openai", base_url: "http://127.0.0.1:8080/v1", api_key: "sk-x" },
    });
    expect(result.ok).toBe(true);
  });
});

describe("services/vault — proxy_password (xray)", () => {
  it("stores shadowsocks with method + password", async () => {
    const { setCredential } = await import("./vault.mjs");
    const result = await setCredential("my_ss", "proxy_password", {
      fields: { protocol: "shadowsocks", method: "aes-256-gcm", password: "ss-pass-1234" },
    });
    expect(result.ok).toBe(true);
    expect(result.data.fields.password).toBe("****1234");
    expect(result.data.fields.method).toBe("aes-256-gcm");
  });

  it("stores vless with id (UUID)", async () => {
    const { setCredential } = await import("./vault.mjs");
    const result = await setCredential("my_vless", "proxy_password", {
      fields: { protocol: "vless", id: "my-uuid-4321", flow: "xtls-rprx-vision" },
    });
    expect(result.ok).toBe(true);
    expect(result.data.fields.id).toBe("****4321");
    expect(result.data.fields.flow).toBe("xtls-rprx-vision");
    // password field should not be present (dependsOn mismatch)
    expect(result.data.fields).not.toHaveProperty("username");
  });
});

describe("services/vault — getCredential", () => {
  it("returns raw value for non-structured", async () => {
    const { setCredential, getCredential } = await import("./vault.mjs");
    await setCredential("raw_test", "sudo_password", { value: "plain-secret" });
    const result = await getCredential("raw_test");
    expect(result.ok).toBe(true);
    expect(result.data.value).toBe("plain-secret");
  });

  it("returns plaintext fields for structured (CLI reveal path)", async () => {
    const { setCredential, getCredential } = await import("./vault.mjs");
    await setCredential("reveal_test", "model_key", {
      fields: { endpoint_type: "anthropic", base_url: "https://api.example.com", api_key: "sk-reveal-99" },
    });
    const result = await getCredential("reveal_test");
    expect(result.ok).toBe(true);
    expect(result.data.fields.api_key).toBe("sk-reveal-99");
  });

  it("returns error for missing key", async () => {
    const { getCredential } = await import("./vault.mjs");
    const result = await getCredential("not_there");
    expect(result.ok).toBe(false);
  });
});

describe("services/vault — secret leakage", () => {
  it("listCredentials never returns plaintext api_key for model_key", async () => {
    const { setCredential, listCredentials } = await import("./vault.mjs");
    await setCredential("leak_test", "model_key", {
      fields: { endpoint_type: "openai", base_url: "https://a.com/v1", api_key: "sk-LEAKMARKER-xyz" },
    });
    const list = await listCredentials();
    const entry = list.credentials.find((c) => c.key === "leak_test");
    expect(entry).toBeTruthy();
    const serialized = JSON.stringify(entry);
    expect(serialized).not.toContain("LEAKMARKER");
    expect(entry.fields.api_key).toBe("****-xyz");
  });

  it("listCredentials never returns plaintext for proxy_password", async () => {
    const { setCredential, listCredentials } = await import("./vault.mjs");
    await setCredential("proxy_leak", "proxy_password", {
      fields: { protocol: "trojan", password: "tr-LEAK-test", email: "x@x.com" },
    });
    const list = await listCredentials();
    const entry = list.credentials.find((c) => c.key === "proxy_leak");
    expect(entry).toBeTruthy();
    expect(JSON.stringify(entry)).not.toContain("LEAK");
  });
});

describe("services/vault — getVaultProviders", () => {
  it("normalizes model_key entries into provider objects (no default model)", async () => {
    const { getVaultProviders } = await import("./vault.mjs");
    const providers = await getVaultProviders();
    const glm = providers.find((p) => p.id === "my_glm");
    expect(glm).toBeTruthy();
    expect(glm.protocol).toBe("openai");
    expect(glm.baseURL).toBe("https://open.bigmodel.cn/api/paas/v4");
    expect(glm.healthUrl).toBe("https://open.bigmodel.cn/api/paas/v4/models");
    // Model is NOT stored with the credential — chosen at launch time.
    expect(glm.defaultModel).toBeNull();
    expect(glm.models).toEqual([]);
    expect(JSON.stringify(glm)).not.toContain("sk-");
  });

  it("derives anthropic healthUrl as /v1/messages", async () => {
    const { setCredential, getVaultProviders } = await import("./vault.mjs");
    await setCredential("anthropic_mk", "model_key", {
      fields: { endpoint_type: "anthropic", base_url: "https://api.deepseek.com/anthropic", api_key: "sk-ds" },
    });
    const providers = await getVaultProviders();
    const ds = providers.find((p) => p.id === "anthropic_mk");
    expect(ds.healthUrl).toBe("https://api.deepseek.com/anthropic/v1/messages");
  });
});

describe("services/vault — many operations", () => {
  it("list reflects set and remove", async () => {
    const { listCredentials, setCredential } = await import("./vault.mjs");
    await setCredential("batch1", "sudo_password", { value: "v1" });
    await setCredential("batch2", "sudo_password", { value: "v2" });
    const list = await listCredentials();
    expect(list.credentials.some((c) => c.key === "batch1")).toBe(true);
    expect(list.credentials.some((c) => c.key === "batch2")).toBe(true);
  });
});

describe("services/vault — testCredential", () => {
  it("rejects missing credentials", async () => {
    const { testCredential } = await import("./vault.mjs");
    const r = await testCredential("nonexistent");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/not found/);
  });

  it("rejects non-testable types", async () => {
    // Store directly (bypass setCredential validation) so we can create
    // an entry with an unknown type. Uses the encrypted store because
    // testCredential reads from createStore().
    const { createStore } = await import("../store/credential-store.mjs");
    const store = createStore();
    await store.set("untestable", { type: "unknown_kind", value: "x", updatedAt: new Date().toISOString() });
    const { testCredential } = await import("./vault.mjs");
    const r = await testCredential("untestable");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/not testable/);
  });

  it("tests a model_key and returns reachable/keyValid", async () => {
    const { setCredential, testCredential } = await import("./vault.mjs");
    await setCredential("testable_mk", "model_key", {
      fields: { endpoint_type: "openai", base_url: "https://x.com/v1", api_key: "sk-test-x" },
    });

    const origFetch = globalThis.fetch;
    let called = false;
    globalThis.fetch = async (_url, _init) => { called = true; return { status: 200 }; };

    const r = await testCredential("testable_mk");
    expect(r.ok).toBe(true);
    expect(r.data.reachable).toBe(true);
    expect(r.data.keyValid).toBe(true);
    expect(called).toBe(true);
    expect(r.data.commands).toBeDefined();
    expect(r.data.commands[0].cmd).toMatch(/GET/);
    expect(r.data.commands[0].cmd).not.toContain("sk-test-x");

    globalThis.fetch = origFetch;
  });

  it("reports keyInvalid on 401", async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = async () => ({ status: 401 });
    const { testCredential } = await import("./vault.mjs");
    const r = await testCredential("testable_mk");
    expect(r.data.keyValid).toBe(false);
    expect(r.data.commands).toBeDefined();
    globalThis.fetch = origFetch;
  });

  it("reports reachable but unknown on 404", async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = async () => ({ status: 404 });
    const { testCredential } = await import("./vault.mjs");
    const r = await testCredential("testable_mk");
    expect(r.data.reachable).toBe(true);
    expect(r.data.keyValid).toBeNull();
    globalThis.fetch = origFetch;
  });

  it("tests a github_token via GitHub API", async () => {
    const { setCredential, testCredential } = await import("./vault.mjs");
    // github_token is fixed-key → stored as "github_token" regardless of the
    // key argument passed to setCredential.
    await setCredential("test_gh", "github_token", { fields: { token: "ghp_test1234", email: "x@x.com" } });

    const origFetch = globalThis.fetch;
    let url = "";
    globalThis.fetch = async (u, _init) => { url = u; return { status: 200 }; };

    const r = await testCredential("github_token");
    expect(r.ok).toBe(true);
    expect(r.data.keyValid).toBe(true);
    expect(url).toBe("https://api.github.com/user");
    expect(r.data.commands[0].cmd).toMatch(/GET/);
    expect(r.data.commands[0].cmd).toContain("Authorization: token ***");

    globalThis.fetch = origFetch;
  });

  it("github_token returns invalid on 401", async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = async () => ({ status: 401 });
    const { testCredential } = await import("./vault.mjs");
    const r = await testCredential("github_token");
    expect(r.data.keyValid).toBe(false);
    globalThis.fetch = origFetch;
  });

  it("sudo_password rejects empty password", async () => {
    const { createStore } = await import("../store/credential-store.mjs");
    const store = createStore();
    await store.set("empty_sudo", { type: "sudo_password", value: "", updatedAt: new Date().toISOString() });
    const { testCredential } = await import("./vault.mjs");
    const r = await testCredential("empty_sudo");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/Password not set/);
  });

  it("proxy_password validates fields", async () => {
    const { setCredential, testCredential } = await import("./vault.mjs");
    // shadowsocks with complete fields.
    await setCredential("pp_complete", "proxy_password", {
      fields: { protocol: "shadowsocks", method: "aes-256-gcm", password: "ss-pass" },
    });
    const r = await testCredential("pp_complete");
    expect(r.ok).toBe(true);
    expect(r.data.reachable).toBeNull();
    expect(r.data.keyValid).toBeNull();
    expect(r.data.detail).toMatch(/Fields complete/);
  });

  it("proxy_password reports missing fields", async () => {
    // Bypass setCredential validation — store incomplete entry directly.
    const { createStore } = await import("../store/credential-store.mjs");
    const store = createStore();
    await store.set("pp_missing", {
      type: "proxy_password",
      fields: { protocol: "shadowsocks", method: "aes-256-gcm" },
      updatedAt: new Date().toISOString(),
    });
    const { testCredential } = await import("./vault.mjs");
    const r = await testCredential("pp_missing");
    expect(r.ok).toBe(true);
    expect(r.data.detail).toMatch(/Missing.*password/);
  });
});
