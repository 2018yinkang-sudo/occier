import { describe, it, expect } from "vitest";

function makeMockCtx(overrides = {}) {
  const state = { mode: "focus", cursor: {}, search: null };
  const calls = [];
  return {
    state,
    calls,
    currentTabId() { return overrides.currentTabId || "test-tab"; },
    setMode(mode) { state.mode = mode; calls.push(["setMode", mode]); },
    switchTab(delta) { calls.push(["switchTab", delta]); },
    jumpToTab(index) { calls.push(["jumpToTab", index]); },
    moveCursor(delta) { calls.push(["moveCursor", delta]); },
    scrollPage(deltaPages) { calls.push(["scrollPage", deltaPages]); },
    scrollTo(offset) { calls.push(["scrollTo", offset]); },
    renderScreen() { calls.push(["renderScreen"]); },
    ensureCursorVisible() { calls.push(["ensureCursorVisible"]); },
    getSelectableItems() {
      return [
        { id: "claude", label: "Claude Code" },
        { id: "opencode", label: "OpenCode" },
      ];
    },
    invokeAction(itemId) { calls.push(["invokeAction", itemId]); },
    refreshTab() { calls.push(["refreshTab"]); },
    showStatus(msg, kind) { calls.push(["showStatus", msg, kind]); },
    ...overrides,
  };
}

describe("TUI v3 modes — focus", () => {
  it("onEnter ensures cursor visible and renders screen", async () => {
    const { focusMode } = await import("./focus.mjs");
    const ctx = makeMockCtx();
    focusMode.onEnter(ctx);
    expect(ctx.calls).toContainEqual(["ensureCursorVisible"]);
    expect(ctx.calls).toContainEqual(["renderScreen"]);
  });

  describe("cursor movement", () => {
    it("UP moves cursor up", async () => {
      const { focusMode } = await import("./focus.mjs");
      const ctx = makeMockCtx();
      focusMode.onKey(ctx, "UP");
      expect(ctx.calls).toContainEqual(["moveCursor", -1]);
    });

    it("DOWN moves cursor down", async () => {
      const { focusMode } = await import("./focus.mjs");
      const ctx = makeMockCtx();
      focusMode.onKey(ctx, "DOWN");
      expect(ctx.calls).toContainEqual(["moveCursor", 1]);
    });
  });

  describe("tab switching", () => {
    it("LEFT switches to previous tab", async () => {
      const { focusMode } = await import("./focus.mjs");
      const ctx = makeMockCtx();
      focusMode.onKey(ctx, "LEFT");
      expect(ctx.calls).toContainEqual(["switchTab", -1]);
    });

    it("SHIFT_TAB switches to previous tab", async () => {
      const { focusMode } = await import("./focus.mjs");
      const ctx = makeMockCtx();
      focusMode.onKey(ctx, "SHIFT_TAB");
      expect(ctx.calls).toContainEqual(["switchTab", -1]);
    });

    it("RIGHT switches to next tab", async () => {
      const { focusMode } = await import("./focus.mjs");
      const ctx = makeMockCtx();
      focusMode.onKey(ctx, "RIGHT");
      expect(ctx.calls).toContainEqual(["switchTab", 1]);
    });

    it("TAB switches to next tab", async () => {
      const { focusMode } = await import("./focus.mjs");
      const ctx = makeMockCtx();
      focusMode.onKey(ctx, "TAB");
      expect(ctx.calls).toContainEqual(["switchTab", 1]);
    });
  });

  describe("ENTER action", () => {
    it("ENTER invokes action on focused item", async () => {
      const { focusMode } = await import("./focus.mjs");
      const ctx = makeMockCtx();
      ctx.state.cursor["test-tab"] = "claude";
      focusMode.onKey(ctx, "ENTER");
      expect(ctx.calls).toContainEqual(["invokeAction", "claude"]);
    });

    it("ENTER with no items does nothing", async () => {
      const { focusMode } = await import("./focus.mjs");
      const ctx = makeMockCtx({
        getSelectableItems() { return []; },
      });
      focusMode.onKey(ctx, "ENTER");
      expect(ctx.calls.find((c) => c[0] === "invokeAction")).toBeUndefined();
    });
  });

  describe("scrolling", () => {
    it("PAGE_UP scrolls up one page", async () => {
      const { focusMode } = await import("./focus.mjs");
      const ctx = makeMockCtx();
      focusMode.onKey(ctx, "PAGE_UP");
      expect(ctx.calls).toContainEqual(["scrollPage", -1]);
    });

    it("PAGE_DOWN scrolls down one page", async () => {
      const { focusMode } = await import("./focus.mjs");
      const ctx = makeMockCtx();
      focusMode.onKey(ctx, "PAGE_DOWN");
      expect(ctx.calls).toContainEqual(["scrollPage", 1]);
    });

    it("HOME scrolls to top", async () => {
      const { focusMode } = await import("./focus.mjs");
      const ctx = makeMockCtx();
      focusMode.onKey(ctx, "HOME");
      expect(ctx.calls).toContainEqual(["scrollTo", 0]);
    });

    it("END scrolls to bottom", async () => {
      const { focusMode } = await import("./focus.mjs");
      const ctx = makeMockCtx();
      focusMode.onKey(ctx, "END");
      expect(ctx.calls).toContainEqual(["scrollTo", Infinity]);
    });
  });

  describe("F5 refresh", () => {
    it("F5 refreshes current tab", async () => {
      const { focusMode } = await import("./focus.mjs");
      const ctx = makeMockCtx();
      focusMode.onKey(ctx, "F5");
      expect(ctx.calls).toContainEqual(["refreshTab"]);
    });
  });

  describe("digit-key tab jumps", () => {
    it("1 jumps to tab 0", async () => {
      const { focusMode } = await import("./focus.mjs");
      const ctx = makeMockCtx();
      focusMode.onKey(ctx, "1");
      expect(ctx.calls).toContainEqual(["jumpToTab", 0]);
    });

    it("6 jumps to tab 5", async () => {
      const { focusMode } = await import("./focus.mjs");
      const ctx = makeMockCtx();
      focusMode.onKey(ctx, "6");
      expect(ctx.calls).toContainEqual(["jumpToTab", 5]);
    });

    it("7 is ignored (only 1-6)", async () => {
      const { focusMode } = await import("./focus.mjs");
      const ctx = makeMockCtx();
      focusMode.onKey(ctx, "7");
      expect(ctx.calls.length).toBe(0);
    });
  });

  describe("mode transitions", () => {
    it("/ enters search mode", async () => {
      const { focusMode } = await import("./focus.mjs");
      const ctx = makeMockCtx();
      focusMode.onKey(ctx, "/");
      expect(ctx.calls).toContainEqual(["setMode", "search"]);
    });

    it("l opens log mode", async () => {
      const { focusMode } = await import("./focus.mjs");
      const ctx = makeMockCtx();
      focusMode.onKey(ctx, "l");
      expect(ctx.calls).toContainEqual(["setMode", "log"]);
    });
  });

  describe("onExit", () => {
    it("onExit is a no-op", async () => {
      const { focusMode } = await import("./focus.mjs");
      const ctx = makeMockCtx();
      expect(() => focusMode.onExit(ctx)).not.toThrow();
    });
  });
});
