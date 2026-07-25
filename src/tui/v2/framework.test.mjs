import { describe, it, expect, beforeAll, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const pkg = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "package.json"), "utf-8"),
);

// Minimal mock of terminal-kit's terminal object.
const calls = [];

const term = Object.assign(
  // Must be callable: renderScreen uses term("\n") and term("text").
  function termFn(s) {
    if (s !== undefined) {
      calls.push({ prop: "call", args: [s] });
      term._text = (term._text || "") + String(s);
    }
  },
  {
    width: 80,
    height: 24,
    on() {},
    moveTo() {},
    styleReset() {},
    fullscreen() {},
    hideCursor() {},
    grabInput() {},
    clear() {},
    eraseDisplay() {},
    eraseDisplayAfter() {},
    bold() {},
  },
);
for (const prop of [
  "white", "black", "red", "cyan", "gray",
  "brightGreen", "yellow", "green",
  "brightCyan", "brightWhite",
  "bgGray", "bgBlack", "bgBrightCyan", "bgBrightWhite",
]) {
  term[prop] = (...args) => {
    calls.push({ prop, args });
    args.forEach((a) => { if (typeof a === "string") term._text = (term._text || "") + a; });
    return term;
  };
}

vi.mock("terminal-kit", () => ({
  default: { terminal: term },
}));

let mod;

beforeAll(async () => {
  mod = await import("./framework.mjs");
});

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

async function flushSwitch() {
  // Allow the 25ms debounce timer and the async render pipeline to complete.
  await vi.advanceTimersByTimeAsync(50);
}

describe("TUI framework rendering", () => {
  it("switchTab calls renderScreen which uses term.clear", async () => {
    const clearFn = vi.fn();
    const origClear = term.clear;
    term.clear = clearFn;
    calls.length = 0;
    mod.switchTab(0);
    await flushSwitch();
    expect(clearFn).toHaveBeenCalledOnce();
    term.clear = origClear;
  });

  it("header displays the dynamic version from package.json", async () => {
    calls.length = 0;
    mod.switchTab(0);
    await flushSwitch();
    const verCalls = calls.filter((c) => c.prop === "white" && c.args[0]?.startsWith?.("v"));
    expect(verCalls.length).toBeGreaterThanOrEqual(1);
    const verText = verCalls[0].args[0];
    expect(verText).toContain(pkg.version);
  });

  it("unselected tab labels use brightWhite (not gray)", async () => {
    calls.length = 0;
    mod.switchTab(0);
    await flushSwitch();
    const grayCalls = calls.filter((c) => c.prop === "gray");
    for (const gc of grayCalls) {
      const text = gc.args[0]?.trim();
      if (!text) continue;
      const isTabLabel = ["Dashboard", "Network", "Vault", "Providers", "Tools", "Projects"].some(
        (l) => text === l || text?.startsWith?.(l),
      );
      expect(isTabLabel).toBe(false);
    }
  });

  it("renders all tab panels without crash (import check)", async () => {
    for (const id of ["dashboard", "network", "vault", "provider", "tools", "projects"]) {
      const pMod = await import(`./${id}.mjs`);
      expect(typeof pMod.renderPanel).toBe("function");
    }
  });
});
