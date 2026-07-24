import { describe, it, expect } from "vitest";
import { getTierLabel, checkConnectivity } from "./connectivity.mjs";

describe("getTierLabel", () => {
  it("returns correct label for each tier", () => {
    expect(getTierLabel(1)).toBe("Port");
    expect(getTierLabel(4)).toBe("HTTP");
    expect(getTierLabel(6)).toBe("Model");
    expect(getTierLabel(99)).toBe("Tier 99");
  });
});

describe("checkConnectivity", () => {
  it("returns result with pass/code/ms/error", async () => {
    const result = await checkConnectivity("https://example.com", 3000);
    expect(result).toHaveProperty("pass");
    expect(result).toHaveProperty("code");
    expect(result).toHaveProperty("ms");
    expect(result).toHaveProperty("error");
  }, 10000);
});
