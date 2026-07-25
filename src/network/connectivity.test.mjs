import { describe, it, expect } from "vitest";
import { checkConnectivity } from "./connectivity.mjs";

describe("checkConnectivity", () => {
  it("returns result with pass/code/ms/error", async () => {
    const result = await checkConnectivity("https://example.com", 3000);
    expect(result).toHaveProperty("pass");
    expect(result).toHaveProperty("code");
    expect(result).toHaveProperty("ms");
    expect(result).toHaveProperty("error");
  }, 10000);
});
