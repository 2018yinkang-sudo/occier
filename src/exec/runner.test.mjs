import { describe, it, expect } from "vitest";
import { sanitize, runString } from "./runner.mjs";

describe("sanitize", () => {
  it("passes through normal text", () => {
    expect(sanitize("hello world")).toBe("hello world");
  });

  it("masks API keys in key=value format", () => {
    const result = sanitize("Using DEEPSEEK_API_KEY=sk-abc123def456");
    expect(result).not.toContain("sk-abc123def456");
    expect(result).toContain("DEEPSEEK_API_KEY=***");
  });

  it("masks Authorization headers", () => {
    const result = sanitize('Authorization: Bearer sk-xxxxx');
    expect(result).not.toContain("sk-xxxxx");
  });

  it("handles undefined input", () => {
    expect(sanitize(null)).toBe("");
    expect(sanitize(undefined)).toBe("");
  });

  it("masks password in JSON-like format", () => {
    const result = sanitize('"password": "super-secret-123"');
    expect(result).not.toContain("super-secret-123");
  });
});

describe("runString", () => {
  it("executes a command and returns output", async () => {
    const r = await runString("echo", ["hello"], { timeout: 3000 });
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toBe("hello");
  });

  it("captures non-zero exit codes", async () => {
    const r = await runString("sh", ["-c", "exit 42"], { timeout: 3000 });
    expect(r.exitCode).toBe(42);
  });

  it("times out hung commands", async () => {
    const r = await runString("sleep", ["10"], { timeout: 100 });
    expect(r.timedOut).toBe(true);
    expect(r.exitCode).not.toBe(0);
  }, 5000);

  it("captures stderr output", async () => {
    const r = await runString("sh", ["-c", 'echo "error" >&2 && exit 1'], { timeout: 3000 });
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain("error");
  });

  it("handles command not found", async () => {
    const r = await runString("command-that-does-not-exist-xyz", [], { timeout: 3000 });
    expect(r.exitCode).toBe(-1);
  });
});
