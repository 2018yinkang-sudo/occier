import { describe, it, expect } from "vitest";
import {
  HOME,
  XDG_CONFIG_HOME,
  CC_CONFIG_DIR,
  ENV_FILE,
  CONFIG_FILE,
  shellRcPath,
} from "./paths.mjs";

describe("paths", () => {
  it("HOME is a string", () => {
    expect(typeof HOME).toBe("string");
    expect(HOME.length).toBeGreaterThan(0);
  });

  it("XDG_CONFIG_HOME ends with .config", () => {
    expect(XDG_CONFIG_HOME).toContain(".config");
  });

  it("CC_CONFIG_DIR is under XDG_CONFIG_HOME", () => {
    expect(CC_CONFIG_DIR).toContain("claude-code");
    expect(CC_CONFIG_DIR.startsWith(XDG_CONFIG_HOME)).toBe(true);
  });

  it("ENV_FILE and CONFIG_FILE are under CC_CONFIG_DIR", () => {
    expect(ENV_FILE.endsWith("providers.env")).toBe(true);
    expect(CONFIG_FILE.endsWith("config.json")).toBe(true);
  });

  it("shellRcPath returns a path under HOME", () => {
    const rc = shellRcPath();
    expect(rc.startsWith(HOME)).toBe(true);
    expect([".bashrc", ".zshrc", ".profile"].some((n) => rc.endsWith(n))).toBe(
      true,
    );
  });
});
