import { describe, it, expect, vi } from "vitest";
import { checkProviderConnectivity } from "./checks.mjs";

vi.stubGlobal("fetch", vi.fn());

describe("checkProviderConnectivity", () => {
  it("resolves with HTTP status when status is 200", async () => {
    fetch.mockResolvedValueOnce({ status: 200 });

    const result = await checkProviderConnectivity("deepseek");
    expect(result.pass).toBe(true);
    expect(result.detail).toBe("HTTP 200");
  });

  it("returns fail for 401 status", async () => {
    fetch.mockResolvedValueOnce({ status: 401 });

    const result = await checkProviderConnectivity("deepseek");
    expect(result.pass).toBe(false);
    expect(result.detail).toBe("HTTP 401");
  });

  it("returns fail for 403 status", async () => {
    fetch.mockResolvedValueOnce({ status: 403 });

    const result = await checkProviderConnectivity("deepseek");
    expect(result.pass).toBe(false);
    expect(result.detail).toBe("HTTP 403");
  });

  it("returns null pass for anthropic (no healthUrl)", async () => {
    const result = await checkProviderConnectivity("anthropic");
    expect(result.pass).toBeNull();
    expect(result.detail).toBe("N/A (uses claude.ai login)");
  });

  it("handles network errors", async () => {
    fetch.mockRejectedValueOnce(new Error("connect ECONNREFUSED"));

    const result = await checkProviderConnectivity("deepseek");
    expect(result.pass).toBe(false);
  });
});
