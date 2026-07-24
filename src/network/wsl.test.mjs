import { describe, it, expect } from "vitest";
import { isWSL, detectWslVersion, detectWslNetworkMode, buildWslConfig } from "./wsl.mjs";

describe("isWSL", () => {
  it("returns boolean", () => {
    expect(typeof isWSL()).toBe("boolean");
  });
});

describe("detectWslVersion", () => {
  it("returns null or number", () => {
    const v = detectWslVersion();
    if (v !== null) {
      expect(typeof v).toBe("number");
    }
  });
});

describe("detectWslNetworkMode", () => {
  it("returns a string when in WSL", () => {
    const mode = detectWslNetworkMode();
    if (mode !== null) {
      expect(["mirrored", "nat", "bridged"]).toContain(mode);
    }
  });
});

describe("buildWslConfig", () => {
  it("generates .wslconfig content", () => {
    const cfg = buildWslConfig("mirrored");
    expect(cfg).toContain("[wsl2]");
    expect(cfg).toContain("networkingMode=mirrored");
    expect(cfg).toContain("autoProxy=true");
  });
});
