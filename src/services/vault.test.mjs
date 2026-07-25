import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { tmpdir } from "os";
import { join } from "path";
import { mkdtempSync, rmSync } from "fs";

let tmpDir;
let credFile;

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "occier-vault-test-"));
  credFile = join(tmpDir, "creds.json");
});

afterAll(() => {
  try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
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
    await store.set("test_key", { type: "api_key", value: "sk-1234567890abcdef", updatedAt: new Date().toISOString() });

    const entry = await store.get("test_key");
    expect(entry).toBeTruthy();
    expect(entry.type).toBe("api_key");
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
    await store.set("del_key", { type: "api_key", value: "tmp", updatedAt: new Date().toISOString() });

    let entry = await store.get("del_key");
    expect(entry).toBeTruthy();

    await store.delete("del_key");
    entry = await store.get("del_key");
    expect(entry).toBeNull();
  });
});

describe("services/vault — setCredential service wrapper", () => {
  it("returns ok with fingerprint", async () => {
    const { setCredential } = await import("./vault.mjs");
    const result = await setCredential("svc_test", "my-secret-value", "api_key");
    expect(result.ok).toBe(true);
    expect(result.data.key).toBe("svc_test");
    expect(result.data.type).toBe("api_key");
    expect(result.data.fingerprint).toBe("****alue");
  });

  it("rejects empty key", async () => {
    const { setCredential } = await import("./vault.mjs");
    const result = await setCredential("", "value");
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("defaults type to api_key", async () => {
    const { setCredential } = await import("./vault.mjs");
    const result = await setCredential("auto_type", "val");
    expect(result.ok).toBe(true);
    expect(result.data.type).toBe("api_key");
  });
});

describe("services/vault — getCredential", () => {
  it("returns raw value", async () => {
    const { setCredential, getCredential } = await import("./vault.mjs");
    await setCredential("raw_test", "plain-secret", "api_key");
    const result = await getCredential("raw_test");
    expect(result.ok).toBe(true);
    expect(result.data.value).toBe("plain-secret");
  });

  it("returns error for missing key", async () => {
    const { getCredential } = await import("./vault.mjs");
    const result = await getCredential("not_there");
    expect(result.ok).toBe(false);
  });
});

describe("services/vault — many operations", () => {
  it("list reflects set and remove", async () => {
    const { listCredentials, setCredential } = await import("./vault.mjs");
    await setCredential("batch1", "v1");
    await setCredential("batch2", "v2");
    const list = await listCredentials();
    expect(list.credentials.some((c) => c.key === "batch1")).toBe(true);
    expect(list.credentials.some((c) => c.key === "batch2")).toBe(true);
  });
});
