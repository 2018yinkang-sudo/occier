import { describe, it, expect } from "vitest";

describe("TUI v3 state", () => {
  it("createState returns default values", async () => {
    const { createState } = await import("./state.mjs");
    const s = createState();
    expect(s.mode).toBe("focus");
    expect(s.currentTab).toBe(0);
    expect(s.scrollOffsets).toEqual({});
    expect(s.cursor).toEqual({});
    expect(s.status).toBeNull();
    expect(s.input).toBeNull();
    expect(s.actionInFlight).toBe(false);
    expect(s.forceRefresh).toBe(false);
    expect(s.search).toBeNull();
  });

  it("getCursorItemId returns cached cursor if it exists in items", async () => {
    const { createState, getCursorItemId } = await import("./state.mjs");
    const s = createState();
    s.cursor["tools"] = "claude";
    const items = [
      { id: "claude", label: "Claude Code" },
      { id: "opencode", label: "OpenCode" },
    ];
    expect(getCursorItemId(s, "tools", items)).toBe("claude");
  });

  it("getCursorItemId falls back to first item if cursor is missing", async () => {
    const { createState, getCursorItemId } = await import("./state.mjs");
    const s = createState();
    const items = [
      { id: "claude", label: "Claude Code" },
      { id: "opencode", label: "OpenCode" },
    ];
    expect(getCursorItemId(s, "tools", items)).toBe("claude");
  });

  it("getCursorItemId returns null for empty items", async () => {
    const { createState, getCursorItemId } = await import("./state.mjs");
    const s = createState();
    expect(getCursorItemId(s, "tools", [])).toBeNull();
  });

  it("getCursorItemId falls back if cursor id is not in items", async () => {
    const { createState, getCursorItemId } = await import("./state.mjs");
    const s = createState();
    s.cursor["tools"] = "nonexistent";
    const items = [
      { id: "claude", label: "Claude Code" },
    ];
    expect(getCursorItemId(s, "tools", items)).toBe("claude");
  });

  it("setCursorItem stores cursor per tab", async () => {
    const { createState, setCursorItem, getCursorItemId } = await import("./state.mjs");
    const s = createState();
    setCursorItem(s, "vault", "my-key");
    const items = [{ id: "my-key", label: "my-key" }];
    expect(getCursorItemId(s, "vault", items)).toBe("my-key");
  });

  it("getScrollOffset returns 0 for unknown tab", async () => {
    const { createState, getScrollOffset } = await import("./state.mjs");
    expect(getScrollOffset(createState(), "unknown")).toBe(0);
  });

  it("setScrollOffset clamps to 0", async () => {
    const { createState, setScrollOffset, getScrollOffset } = await import("./state.mjs");
    const s = createState();
    setScrollOffset(s, "tools", -5);
    expect(getScrollOffset(s, "tools")).toBe(0);
  });

  it("setScrollOffset stores the offset", async () => {
    const { createState, setScrollOffset, getScrollOffset } = await import("./state.mjs");
    const s = createState();
    setScrollOffset(s, "tools", 5);
    expect(getScrollOffset(s, "tools")).toBe(5);
  });
});

describe("TUI v3 panel-utils", () => {
  it("contentMaxLines returns h - 5", async () => {
    const { contentMaxLines } = await import("./panel-utils.mjs");
    expect(contentMaxLines({ height: 24 })).toBe(19);
    expect(contentMaxLines({ height: 10 })).toBe(5);
  });

  it("makeLineBudget tracks logical lines and items", async () => {
    const { makeLineBudget } = await import("./panel-utils.mjs");
    const term = { width: 80, height: 10 }; // max = 5
    const budget = makeLineBudget(term, 0);
    expect(budget.totalLines).toBe(0);
    expect(budget.items).toEqual([]);

    budget.nextLine(); // line 1 (skip check)
    budget.nextLine(); // line 2
    budget.tag("a", "Item A");
    budget.nextLine(); // line 3
    budget.tag("b", "Item B");
    budget.nextLine(); // line 4

    expect(budget.totalLines).toBe(4);
    expect(budget.items).toHaveLength(2);
    expect(budget.items[0]).toMatchObject({ id: "a", label: "Item A", logicalLine: 2 });
    expect(budget.items[1]).toMatchObject({ id: "b", label: "Item B", logicalLine: 3 });
  });

  it("makeLineBudget okLine returns true when viewport is full", async () => {
    const { makeLineBudget } = await import("./panel-utils.mjs");
    const term = { width: 80, height: 7 }; // max = 2
    const budget = makeLineBudget(term, 0);
    expect(budget.okLine()).toBe(false); // line 1, drawn=1
    expect(budget.okLine()).toBe(false); // line 2, drawn=2
    expect(budget.okLine()).toBe(true);  // line 3, drawn=3 > max=2
  });

  it("makeLineBudget scrollOffset skips lines", async () => {
    const { makeLineBudget } = await import("./panel-utils.mjs");
    const term = { width: 80, height: 10 }; // max = 5
    const budget = makeLineBudget(term, 2);
    // skip first 2 logical lines
    budget.okLine(); // logical=1, <=2, return false (skip)
    budget.okLine(); // logical=2, <=2, return false (skip)
    // drawn starts counting from here
    budget.okLine(); // logical=3, drawn=1, return false
    expect(budget.totalLines).toBe(3);
    expect(budget.drawnLines).toBe(1);
  });

  it("sectionHeader writes brightCyan header", async () => {
    const { sectionHeader } = await import("./panel-utils.mjs");
    const out = [];
    const term = Object.assign(
      (s) => out.push(String(s)),
      {
        width: 80,
        brightCyan(s) { out.push("brightCyan:" + s); return this; },
        bold(s) { out.push("bold:" + s); return this; },
        styleReset() { return this; },
        bgBlack() { return this; },
      },
    );
    sectionHeader(term, "Test");
    expect(out.join("")).toContain("Test");
  });
});

describe("TUI v3 framework", () => {
  it("exports public API", async () => {
    const mod = await import("./framework.mjs");
    expect(typeof mod.startDashboard).toBe("function");
    expect(typeof mod.exitDashboard).toBe("function");
    expect(typeof mod.switchTab).toBe("function");
    expect(typeof mod.getCurrentTab).toBe("function");
  });
});

function makeMockCtx() {
  const state = { mode: "focus", cursor: {}, search: null };
  const calls = [];
  return {
    state,
    calls,
    currentTabId() { return "test-tab"; },
    setMode(mode) { state.mode = mode; calls.push(["setMode", mode]); },
    switchTab() {},
    renderScreen() { calls.push(["renderScreen"]); },
    ensureCursorVisible() { calls.push(["ensureCursorVisible"]); },
    getSelectableItems() {
      return [
        { id: "claude", label: "Claude Code" },
        { id: "opencode", label: "OpenCode" },
      ];
    },
    showStatus(msg, kind) { calls.push(["showStatus", msg, kind]); },
  };
}

describe("TUI v3 modes — search", () => {
  it("onEnter creates search state", async () => {
    const { searchMode } = await import("./modes/search.mjs");
    const ctx = makeMockCtx();
    searchMode.onEnter(ctx);
    expect(ctx.state.search).toEqual({ query: "" });
    expect(ctx.calls).toContainEqual(["renderScreen"]);
  });

  it("typing builds query", async () => {
    const { searchMode } = await import("./modes/search.mjs");
    const ctx = makeMockCtx();
    searchMode.onEnter(ctx);
    ctx.calls.length = 0;
    searchMode.onKey(ctx, "o");
    searchMode.onKey(ctx, "p");
    searchMode.onKey(ctx, "e");
    expect(ctx.state.search.query).toBe("ope");
  });

  it("BACKSPACE removes last char", async () => {
    const { searchMode } = await import("./modes/search.mjs");
    const ctx = makeMockCtx();
    ctx.state.search = { query: "open" };
    searchMode.onKey(ctx, "BACKSPACE");
    expect(ctx.state.search.query).toBe("ope");
  });

  it("ESCAPE cancels and returns to focus", async () => {
    const { searchMode } = await import("./modes/search.mjs");
    const ctx = makeMockCtx();
    ctx.state.search = { query: "open" };
    searchMode.onKey(ctx, "ESCAPE");
    expect(ctx.state.search).toBeNull();
    expect(ctx.calls).toContainEqual(["setMode", "focus"]);
  });

  it("ENTER with match moves cursor", async () => {
    const { searchMode } = await import("./modes/search.mjs");
    const ctx = makeMockCtx();
    ctx.state.search = { query: "open" };
    searchMode.onKey(ctx, "ENTER");
    expect(ctx.state.cursor["test-tab"]).toBe("opencode");
    expect(ctx.state.search).toBeNull();
    expect(ctx.calls).toContainEqual(["ensureCursorVisible"]);
    expect(ctx.calls).toContainEqual(["setMode", "focus"]);
  });

  it("ENTER with no match shows status", async () => {
    const { searchMode } = await import("./modes/search.mjs");
    const ctx = makeMockCtx();
    ctx.state.search = { query: "zzz" };
    searchMode.onKey(ctx, "ENTER");
    expect(ctx.state.search).toBeNull();
    expect(ctx.calls.some((c) => c[0] === "showStatus" && c[1] === "No match")).toBe(true);
  });
});

describe("TUI v3 modes — log", () => {
  it("onEnter renders screen", async () => {
    const { logMode } = await import("./modes/log.mjs");
    const ctx = makeMockCtx();
    logMode.onEnter(ctx);
    expect(ctx.calls).toContainEqual(["renderScreen"]);
  });

  it("q closes log and returns to focus", async () => {
    const { logMode } = await import("./modes/log.mjs");
    const ctx = makeMockCtx();
    ctx.state.mode = "log";
    logMode.onKey(ctx, "q");
    expect(ctx.calls).toContainEqual(["setMode", "focus"]);
  });

  it("Esc closes log and returns to focus", async () => {
    const { logMode } = await import("./modes/log.mjs");
    const ctx = makeMockCtx();
    ctx.state.mode = "log";
    logMode.onKey(ctx, "ESCAPE");
    expect(ctx.calls).toContainEqual(["setMode", "focus"]);
  });
});
