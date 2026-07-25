import { describe, it, expect, vi, afterEach } from "vitest";
import { probeModel, clearProbeCache } from "./probes.mjs";

function mockFetchCapture() {
  const calls = [];
  vi.stubGlobal("fetch", vi.fn(async (url, opts) => {
    calls.push({ url, opts });
    return { status: 200, text: async () => "{}" };
  }));
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
  clearProbeCache();
});

describe("probeModel auth headers", () => {
  it("sends x-api-key for anthropic-protocol providers", async () => {
    const calls = mockFetchCapture();
    const provider = {
      id: "kimi",
      protocol: "anthropic",
      healthUrl: "https://example.com/anthropic/v1/messages",
      defaultModel: "m1",
    };
    const result = await probeModel(provider, "sk-test-key", "m1");
    expect(result.status).toBe("available");
    expect(calls[0].opts.headers["x-api-key"]).toBe("sk-test-key");
    expect(calls[0].opts.headers.Authorization).toBeUndefined();
  });

  it("sends Authorization: Bearer for openai-protocol providers", async () => {
    const calls = mockFetchCapture();
    const provider = {
      id: "openai",
      protocol: "openai",
      healthUrl: "https://example.com/v1/models",
      defaultModel: "gpt-x",
    };
    await probeModel(provider, "sk-openai-key", "gpt-x");
    expect(calls[0].opts.headers.Authorization).toBe("Bearer sk-openai-key");
    expect(calls[0].opts.headers["x-api-key"]).toBeUndefined();
  });

  it("rewrites /v1/models to /v1/chat/completions for openai probes", async () => {
    const calls = mockFetchCapture();
    const provider = {
      id: "openai",
      protocol: "openai",
      healthUrl: "https://example.com/v1/models",
      defaultModel: "gpt-x",
    };
    await probeModel(provider, "sk-openai-key", "gpt-x");
    expect(calls[0].url).toBe("https://example.com/v1/chat/completions");
  });
});
