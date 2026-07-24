import { describe, it, expect } from "vitest";
import { getOS, isWSL, getShell, detectProxyEnv } from "./detect.mjs";

describe("getOS", () => {
  it("returns a known OS string", () => {
    const os = getOS();
    expect(["linux", "wsl", "macos", "windows"]).toContain(os);
  });
});

describe("isWSL", () => {
  it("returns boolean", () => {
    expect(typeof isWSL()).toBe("boolean");
  });
});

describe("getShell", () => {
  it("returns a shell name", () => {
    const shell = getShell();
    expect(["bash", "zsh", "fish", "sh"]).toContain(shell);
  });
});

describe("detectProxyEnv", () => {
  it("returns proxy environment variables", () => {
    const proxy = detectProxyEnv();
    expect(proxy).toHaveProperty("http_proxy");
    expect(proxy).toHaveProperty("https_proxy");
    expect(proxy).toHaveProperty("no_proxy");
  });
});
