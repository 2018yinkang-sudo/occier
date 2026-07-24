import { describe, it, expect } from "vitest";
import { clearProviderEnv, applyProviderEnv } from "./launch.mjs";

describe("clearProviderEnv", () => {
  it("removes anthropic-related env vars", () => {
    const env = {
      KEEP_ME: "yes",
      ANTHROPIC_API_KEY: "secret",
      ANTHROPIC_BASE_URL: "https://old.example.com",
      ANTHROPIC_MODEL: "old-model",
      ANTHROPIC_DEFAULT_OPUS_MODEL: "old-opus",
      ANTHROPIC_DEFAULT_SONNET_MODEL: "old-sonnet",
      ANTHROPIC_DEFAULT_HAIKU_MODEL: "old-haiku",
      ANTHROPIC_DEFAULT_FABLE_MODEL: "old-fable",
      ANTHROPIC_AUTH_TOKEN: "tok",
      CLAUDE_CODE_SUBAGENT_MODEL: "old-sub",
      CLAUDE_CODE_EFFORT_LEVEL: "low",
      CLAUDE_CODE_AUTO_COMPACT_WINDOW: "123",
      ENABLE_TOOL_SEARCH: "true",
    };

    clearProviderEnv(env);

    expect(env.KEEP_ME).toBe("yes");
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(env.ANTHROPIC_BASE_URL).toBeUndefined();
    expect(env.ANTHROPIC_MODEL).toBeUndefined();
    expect(env.ANTHROPIC_DEFAULT_OPUS_MODEL).toBeUndefined();
    expect(env.ANTHROPIC_DEFAULT_SONNET_MODEL).toBeUndefined();
    expect(env.ANTHROPIC_DEFAULT_HAIKU_MODEL).toBeUndefined();
    expect(env.ANTHROPIC_DEFAULT_FABLE_MODEL).toBeUndefined();
    expect(env.ANTHROPIC_AUTH_TOKEN).toBeUndefined();
    expect(env.CLAUDE_CODE_SUBAGENT_MODEL).toBeUndefined();
    expect(env.CLAUDE_CODE_EFFORT_LEVEL).toBeUndefined();
    expect(env.CLAUDE_CODE_AUTO_COMPACT_WINDOW).toBeUndefined();
    expect(env.ENABLE_TOOL_SEARCH).toBeUndefined();
  });
});

describe("applyProviderEnv", () => {
  it("sets provider env vars on target", () => {
    const env = { EXISTING: "keep" };
    const config = {
      ANTHROPIC_BASE_URL: "https://example.com",
      ANTHROPIC_MODEL: "test-model",
    };

    applyProviderEnv(env, config);

    expect(env.EXISTING).toBe("keep");
    expect(env.ANTHROPIC_BASE_URL).toBe("https://example.com");
    expect(env.ANTHROPIC_MODEL).toBe("test-model");
  });

  it("skips null and undefined values", () => {
    const env = {};
    const config = { ANTHROPIC_BASE_URL: null, ANTHROPIC_MODEL: undefined };

    applyProviderEnv(env, config);

    expect(env.ANTHROPIC_BASE_URL).toBeUndefined();
    expect(env.ANTHROPIC_MODEL).toBeUndefined();
  });

  it("allows empty string values", () => {
    const env = {};
    const config = { ANTHROPIC_MODEL: "" };

    applyProviderEnv(env, config);

    expect(env.ANTHROPIC_MODEL).toBe("");
  });
});
