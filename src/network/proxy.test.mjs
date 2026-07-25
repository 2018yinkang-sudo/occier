import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { buildProxyEnv, buildShellRcBlock, removeShellRcBlock, detectExistingProxy, injectShellRc } from "./proxy.mjs";

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

describe("injectShellRc", () => {
  let tmpDir;
  let rcPath;

  afterEach(() => {
    if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = null;
  });

  function setup(content) {
    tmpDir = mkdtempSync(join(tmpdir(), "occier-rc-"));
    rcPath = join(tmpDir, ".bashrc");
    writeFileSync(rcPath, content);
  }

  it("appends a block to a file without markers and creates a backup", async () => {
    setup("export EDITOR=vim\n");
    await injectShellRc(rcPath, buildShellRcBlock("http", "127.0.0.1", 10808));
    const out = readFileSync(rcPath, "utf-8");
    expect(out).toContain("export EDITOR=vim");
    expect(out).toContain(">>> occier proxy >>>");
    expect(existsSync(`${rcPath}.occier-bak`)).toBe(true);
  });

  it("replaces an existing marked block", async () => {
    setup("before\n# >>> occier proxy >>>\nold\n# <<< occier proxy <<<\nafter\n");
    await injectShellRc(rcPath, buildShellRcBlock("http", "127.0.0.1", 7890));
    const out = readFileSync(rcPath, "utf-8");
    expect(out).toContain("before");
    expect(out).toContain("after");
    expect(out).toContain("7890");
    expect(out).not.toContain("old");
  });

  it("never truncates content after a dangling start marker", async () => {
    setup("# >>> occier proxy >>>\nexport IMPORTANT_VAR=keepme\nexport ANOTHER=alsokeep\n");
    await injectShellRc(rcPath, buildShellRcBlock("http", "127.0.0.1", 10808));
    const out = readFileSync(rcPath, "utf-8");
    expect(out).toContain("IMPORTANT_VAR=keepme");
    expect(out).toContain("ANOTHER=alsokeep");
    expect(out).toContain(">>> occier proxy >>>");
    expect(out).toContain("<<< occier proxy <<<");
  });
});
