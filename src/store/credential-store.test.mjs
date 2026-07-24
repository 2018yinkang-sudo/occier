import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  FileCredentialStore,
  CredentialStore,
  maskValue,
} from "./credential-store.mjs";

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
