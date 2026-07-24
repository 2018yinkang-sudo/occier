import { describe, it, expect, vi } from "vitest";
import { c, header, ok, warn, fail } from "./tui.mjs";

describe("color functions", () => {
  it("c.dim wraps text with dim codes", () => {
    const r = c.dim("hello");
    expect(r).toContain("\x1b[2m");
    expect(r).toContain("hello");
    expect(r).toContain("\x1b[0m");
  });

  it("c.bold wraps text with bold codes", () => {
    const r = c.bold("hello");
    expect(r).toContain("\x1b[1m");
  });

  it("c.red wraps text with red codes", () => {
    const r = c.red("error");
    expect(r).toContain("\x1b[31m");
  });

  it("c.green wraps text with green codes", () => {
    const r = c.green("ok");
    expect(r).toContain("\x1b[32m");
  });

  it("c.yellow wraps text with yellow codes", () => {
    const r = c.yellow("warn");
    expect(r).toContain("\x1b[33m");
  });

  it("c.cyan wraps text with cyan codes", () => {
    const r = c.cyan("info");
    expect(r).toContain("\x1b[36m");
  });

  it("c.gray wraps text with gray codes", () => {
    const r = c.gray("dim");
    expect(r).toContain("\x1b[90m");
  });

  it("c.boldCyan wraps text with bold cyan", () => {
    const r = c.boldCyan("title");
    expect(r).toContain("\x1b[1;36m");
  });

  it("c.boldWhite wraps text with bold white", () => {
    const r = c.boldWhite("label");
    expect(r).toContain("\x1b[1;37m");
  });
});

describe("output functions", () => {
  it("header outputs formatted separator", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    header("Test");
    const calls = spy.mock.calls.map((c) => c[0]);
    expect(calls.some((s) => s.includes("Test"))).toBe(true);
    spy.mockRestore();
  });

  it("ok outputs checkmark", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    ok("done");
    expect(spy.mock.calls[0][0]).toContain("done");
    spy.mockRestore();
  });

  it("fail outputs cross", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    fail("bad");
    expect(spy.mock.calls[0][0]).toContain("bad");
    spy.mockRestore();
  });

  it("warn outputs exclamation", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    warn("warning");
    expect(spy.mock.calls[0][0]).toContain("warning");
    spy.mockRestore();
  });
});
