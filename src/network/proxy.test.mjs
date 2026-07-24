import { describe, it, expect } from "vitest";
import { buildProxyEnv, buildShellRcBlock, removeShellRcBlock, detectExistingProxy } from "./proxy.mjs";

describe("buildProxyEnv", () => {
  it("builds HTTP proxy env vars", () => {
    const env = buildProxyEnv("http", "127.0.0.1", 10808);
    expect(env.http_proxy).toBe("http://127.0.0.1:10808");
    expect(env.https_proxy).toBe("http://127.0.0.1:10808");
    expect(env.no_proxy).toContain("localhost");
  });

  it("builds SOCKS5 proxy env vars", () => {
    const env = buildProxyEnv("socks5", "192.168.1.1", 7890);
    expect(env.all_proxy).toBe("socks5h://192.168.1.1:7890");
  });

  it("includes auth in URL when provided", () => {
    const env = buildProxyEnv("http", "proxy.com", 8080, "user", "pass");
    expect(env.http_proxy).toContain("user:pass@");
  });
});

describe("buildShellRcBlock", () => {
  it("generates proxy_on/off functions with markers", () => {
    const block = buildShellRcBlock("http", "127.0.0.1", 10808);
    expect(block).toContain("# >>> occier proxy >>>");
    expect(block).toContain("# <<< occier proxy <<<");
    expect(block).toContain("proxy_on()");
    expect(block).toContain("proxy_off()");
    expect(block).toContain("127.0.0.1");
    expect(block).toContain("10808");
  });
});

describe("removeShellRcBlock", () => {
  it("removes proxy block from content", () => {
    const content = "line1\n# >>> occier proxy >>>\nstuff\n# <<< occier proxy <<<\nline2";
    const result = removeShellRcBlock(content);
    expect(result).toContain("line1");
    expect(result).toContain("line2");
    expect(result).not.toContain(">>> occier proxy >>>");
    expect(result).not.toContain("stuff");
  });

  it("returns original if no marker", () => {
    expect(removeShellRcBlock("hello")).toBe("hello");
  });
});

describe("detectExistingProxy", () => {
  it("returns current env proxy vars", () => {
    const proxy = detectExistingProxy();
    expect(proxy).toHaveProperty("http_proxy");
    expect(proxy).toHaveProperty("https_proxy");
    expect(proxy).toHaveProperty("no_proxy");
  });
});
