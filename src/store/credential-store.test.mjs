import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readdirSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// Paths in credential-store/config-io are captured at module load from
// XDG_CONFIG_HOME — stub it BEFORE importing the modules under test.
const xdg = mkdtempSync(join(tmpdir(), "occier-xdg-"));
process.env.XDG_CONFIG_HOME = xdg;

let mod;
let FileCredentialStore;
let EncryptedFileStore;
let CredentialStore;
let maskValue;
let createStore;

beforeAll(async () => {
  mod = await import("./credential-store.mjs");
  FileCredentialStore = mod.FileCredentialStore;
  EncryptedFileStore = mod.EncryptedFileStore;
  CredentialStore = mod.CredentialStore;
  maskValue = mod.maskValue;
  createStore = mod.createStore;
});

afterEach(() => {
  // Clean vault/env artifacts between tests but keep the xdg root.
  for (const f of readdirSync(xdg)) {
    if (f === "claude-code") continue;
    rmSync(join(xdg, f), { recursive: true, force: true });
  }
  rmSync(join(xdg, "claude-code"), { recursive: true, force: true });
});

describe("CredentialStore (abstract)", () => {
  it("throws for unimplemented methods", async () => {
    const store = new CredentialStore();
    await expect(store.get("x")).rejects.toThrow("Not implemented");
    await expect(store.set("x", "y")).rejects.toThrow("Not implemented");
    await expect(store.delete("x")).rejects.toThrow("Not implemented");
    await expect(store.list()).rejects.toThrow("Not implemented");
  });
});

describe("FileCredentialStore", () => {
  let tmpDir;
  let store;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "occier-test-"));
    store = new FileCredentialStore(join(tmpDir, "creds.json"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("stores and retrieves a credential", async () => {
    await store.set("test-key", "test-value");
    const value = await store.get("test-key");
    expect(value).toBe("test-value");
  });

  it("returns null for missing key", async () => {
    const value = await store.get("does-not-exist");
    expect(value).toBeNull();
  });

  it("deletes a credential", async () => {
    await store.set("to-delete", "value");
    await store.delete("to-delete");
    const value = await store.get("to-delete");
    expect(value).toBeNull();
  });

  it("lists all credentials", async () => {
    await store.set("a", "value1");
    await store.set("b", { type: "api_key", value: "sk-test12345678" });
    const list = await store.list();
    expect(list).toHaveLength(2);
    expect(list.find((i) => i.key === "a")).toBeTruthy();
    expect(list.find((i) => i.key === "b")).toBeTruthy();
  });

  it("returns masked values in list", async () => {
    await store.set("key", { type: "api_key", value: "sk-test12345678" });
    const list = await store.list();
    expect(list[0].fingerprint).toContain("****");
    expect(list[0].fingerprint).not.toContain("sk-test12345678");
  });

  it("checks key existence", async () => {
    await store.set("exists", "yes");
    expect(await store.has("exists")).toBe(true);
    expect(await store.has("nonexistent")).toBe(false);
  });

  it("preserves a corrupted vault file instead of destroying it", async () => {
    const file = join(tmpDir, "creds.json");
    writeFileSync(file, "{ not valid json !!!");
    const list = await store.list();
    expect(list).toEqual([]);
    // The unreadable file must be moved aside, not overwritten.
    const aside = readdirSync(tmpDir).find((f) => f.includes(".corrupt-"));
    expect(aside).toBeTruthy();
    expect(readFileSync(join(tmpDir, aside), "utf-8")).toBe("{ not valid json !!!");
  });

  it("writes atomically — no temp files left behind", async () => {
    await store.set("k", "v");
    const leftovers = readdirSync(tmpDir).filter((f) => f.includes(".tmp-"));
    expect(leftovers).toEqual([]);
    expect(existsSync(join(tmpDir, "creds.json"))).toBe(true);
  });
});

describe("EncryptedFileStore", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "occier-enc-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("round-trips credentials with AES-256-GCM", async () => {
    const file = join(tmpDir, "vault.enc");
    const store = new EncryptedFileStore("test-master-key", file);
    await store.set("kimi_api_key", { type: "api_key", value: "sk-secret-123456" });
    expect(readFileSync(file)[0]).not.toBe(0x7b); // not plaintext JSON
    const again = new EncryptedFileStore("test-master-key", file);
    const entry = await again.get("kimi_api_key");
    expect(entry.value).toBe("sk-secret-123456");
  });

  it("migrates a legacy plaintext vault.enc on first read", async () => {
    const file = join(tmpDir, "vault.enc");
    writeFileSync(file, JSON.stringify({
      deepseek_api_key: { type: "api_key", value: "sk-legacy-98765" },
    }));
    const store = new EncryptedFileStore("test-master-key", file);
    const entry = await store.get("deepseek_api_key");
    expect(entry.value).toBe("sk-legacy-98765");
    // Next write re-encrypts.
    await store.set("new_key", { type: "api_key", value: "sk-new-12345" });
    expect(readFileSync(file)[0]).not.toBe(0x7b);
    expect((await store.get("deepseek_api_key")).value).toBe("sk-legacy-98765");
    expect((await store.get("new_key")).value).toBe("sk-new-12345");
  });
});

describe("v1/v2 credential bridge", () => {
  it("v2 store surfaces legacy providers.env entries (lowercased)", async () => {
    const legacyDir = join(xdg, "claude-code");
    mkdirSync(legacyDir, { recursive: true });
    writeFileSync(join(legacyDir, "providers.env"), 'DEEPSEEK_API_KEY="sk-fromenv-1234"\n');

    const store = new FileCredentialStore(join(xdg, "vault.json"));
    const entry = await store.get("deepseek_api_key");
    expect(entry?.value).toBe("sk-fromenv-1234");
    const list = await store.list();
    expect(list.some((i) => i.key === "deepseek_api_key")).toBe(true);
  });

  it("v1 readProvidersEnv surfaces v2 vault entries (uppercased)", async () => {
    const store = createStore(); // encrypted, device key, XDG vault path
    await store.set("kimi_api_key", { type: "api_key", value: "sk-vault-5678" });

    const { readProvidersEnv } = await import("../config-io.mjs");
    const entries = await readProvidersEnv();
    expect(entries.KIMI_API_KEY).toBe("sk-vault-5678");
  });
});

describe("maskValue", () => {
  it("returns <not set> for empty", () => {
    expect(maskValue("")).toBe("<not set>");
    expect(maskValue(null)).toBe("<not set>");
  });

  it("masks short values", () => {
    expect(maskValue("abc")).toBe("****");
    expect(maskValue("12345678")).toBe("****");
  });

  it("masks long values keeping first and last 4", () => {
    expect(maskValue("sk-abcdefgh12345678")).toBe("sk-a****5678");
  });
});
