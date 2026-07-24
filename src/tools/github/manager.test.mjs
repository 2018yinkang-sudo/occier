import { describe, it, expect } from "vitest";
import { detectGitHubCLI, testGitHubAPI } from "./manager.mjs";

describe("GitHub manager", () => {
  it("detectGitHubCLI returns state object", async () => {
    const r = await detectGitHubCLI();
    expect(r).toHaveProperty("installed");
    expect(r).toHaveProperty("loggedIn");
  }, 10000);

  it("testGitHubAPI returns success or failure", async () => {
    const r = await testGitHubAPI();
    expect(typeof r).toBe("boolean");
  }, 10000);
});
