import { describe, it, expect } from "vitest";
import {
  getMirror, getMirrorSafe, allMirrors, mirrorsByScope, enableMirror, disableMirror,
} from "./registry.mjs";

describe("mirror registry", () => {
  it("has built-in mirrors", async () => {
    const mirrors = await allMirrors();
    expect(mirrors.length).toBeGreaterThan(0);
  });

  it("has npm-official mirror", () => {
    const m = getMirror("npm-official");
    expect(m.scope).toBe("npm");
    expect(m.official).toBe(true);
    expect(m.baseUrl).toBe("https://registry.npmjs.org");
  });

  it("has cn mirrors", async () => {
    const cn = (await allMirrors()).filter((m) => m.region === "cn");
    expect(cn.length).toBeGreaterThan(0);
  });

  it("getMirrorSafe returns null for unknown", () => {
    expect(getMirrorSafe("nonexistent")).toBeNull();
  });

  it("mirrorsByScope filters by scope", async () => {
    const npm = await mirrorsByScope("npm");
    expect(npm.every((m) => m.scope === "npm")).toBe(true);
  });

  it("enableMirror and disableMirror work", async () => {
    const enResult = await enableMirror("npm-aliyun");
    expect(enResult).toBe(true);
    const m = getMirror("npm-aliyun");
    expect(m.enabled).toBe(true);

    const disResult = await disableMirror("npm-aliyun");
    expect(disResult).toBe(true);
    const m2 = getMirror("npm-aliyun");
    expect(m2.enabled).toBe(false);
  });
});
