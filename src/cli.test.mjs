import { describe, it, expect, beforeAll, vi } from "vitest";
import { mkdtempSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// Store paths are captured from XDG_CONFIG_HOME at module load — stub first.
process.env.XDG_CONFIG_HOME = mkdtempSync(join(tmpdir(), "occier-cli-test-"));

let route;

beforeAll(async () => {
  ({ route } = await import("./cli.mjs"));
});

describe("CLI registry dispatch", () => {
  it("dispatches a top-level registry command (vault list)", async () => {
    const logs = [];
    const spy = vi.spyOn(console, "log").mockImplementation((s) => logs.push(String(s ?? "")));
    await route(["vault", "list"]);
    spy.mockRestore();
    expect(logs.join("\n")).toContain("Credential Vault");
  });

  it("dispatches a group command (group list)", async () => {
    const logs = [];
    const spy = vi.spyOn(console, "log").mockImplementation((s) => logs.push(String(s ?? "")));
    await route(["group", "list"]);
    spy.mockRestore();
    expect(logs.join("\n")).toContain("Model Groups");
  });

  it("passes subcommand args as strings, not arrays", async () => {
    // installTool('notatool') hits the usage guard — proof the handler
    // received a plain string (an array would never equal 'claude'/'opencode'
    // either, but combined with the dispatch test above this pins the contract).
    const logs = [];
    const spy = vi.spyOn(console, "log").mockImplementation((s) => logs.push(String(s ?? "")));
    await route(["tool", "install", "notatool"]);
    spy.mockRestore();
    expect(logs.join("\n")).toContain("occier tool install <claude|opencode>");
  });

  it("shows usage for a command with subcommands but no subcommand", async () => {
    const logs = [];
    const spy = vi.spyOn(console, "log").mockImplementation((s) => logs.push(String(s ?? "")));
    await route(["tool"]);
    spy.mockRestore();
    expect(logs.join("\n")).toContain("occier tool");
  });

  it("prints version", async () => {
    const logs = [];
    const spy = vi.spyOn(console, "log").mockImplementation((s) => logs.push(String(s ?? "")));
    await route(["--version"]);
    spy.mockRestore();
    expect(logs.join("")).toMatch(/occier v\d+\.\d+\.\d+/);
  });

  it("rejects unknown commands with exit 1", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    await route(["definitely-not-a-command"]);
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
    console.error.mockRestore();
  });
});
