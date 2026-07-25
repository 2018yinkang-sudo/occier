import { describe, it, expect } from "vitest";
import { maskKey } from "./config-io.mjs";

describe("maskKey", () => {
  it("returns <not set> for empty key", () => {
    expect(maskKey("")).toBe("<not set>");
    expect(maskKey(null)).toBe("<not set>");
    expect(maskKey(undefined)).toBe("<not set>");
  });

  it("returns **** for short keys", () => {
    expect(maskKey("abc")).toBe("****");
    expect(maskKey("1234")).toBe("****");
  });

  it("masks long key showing only last 4", () => {
    const r = maskKey("sk-thisIsALongKey12345");
    expect(r).toContain("****");
    expect(r.endsWith("2345")).toBe(true);
    expect(r.startsWith("sk-t")).toBe(false);
  });
});
