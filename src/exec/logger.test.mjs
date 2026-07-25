import { describe, it, expect } from "vitest";
import { sanitizeLog } from "./logger.mjs";

describe("sanitizeLog", () => {
  it("masks key=value secrets", () => {
    expect(sanitizeLog("DEEPSEEK_API_KEY=sk-abc123")).toBe("DEEPSEEK_API_KEY=***");
  });

  it("masks JSON-quoted secrets", () => {
    const out = sanitizeLog('{"apiKey":"sk-json-leak-123","ok":1}');
    expect(out).not.toContain("sk-json-leak-123");
    expect(out).toContain("***");
  });

  it("masks Bearer tokens", () => {
    expect(sanitizeLog("Authorization: Bearer sk-abcdef123456")).toBe(
      "Authorization: Bearer ***",
    );
  });

  it("passes normal text through", () => {
    expect(sanitizeLog("provider connected")).toBe("provider connected");
  });
});
