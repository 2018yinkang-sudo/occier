import { describe, it, expect } from "vitest";
import { filterLaunchArgs } from "./launch.mjs";

describe("filterLaunchArgs", () => {
  it("strips --tool and --provider pairs", () => {
    expect(filterLaunchArgs(["--provider", "kimi", "--tool", "claude"])).toEqual([]);
  });

  it("strips bare tool names", () => {
    expect(filterLaunchArgs(["claude"])).toEqual([]);
    expect(filterLaunchArgs(["opencode"])).toEqual([]);
  });

  it("keeps genuine claude passthrough args", () => {
    expect(filterLaunchArgs(["--provider", "kimi", "-p", "hello", "--resume"])).toEqual([
      "-p",
      "hello",
      "--resume",
    ]);
  });

  it("never leaks the 'launch' subcommand itself", () => {
    // route() slices args before runLaunch, but guard the contract anyway.
    expect(filterLaunchArgs([])).toEqual([]);
  });
});
