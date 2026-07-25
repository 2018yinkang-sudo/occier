import { describe, it, expect } from "vitest";

function makeInputCtx(overrides = {}) {
  const state = { mode: "input", cursor: {}, input: null };
  const calls = [];
  return {
    state,
    calls,
    submitInput() { calls.push(["submitInput"]); },
    cancelInput() { calls.push(["cancelInput"]); },
    renderScreen() { calls.push(["renderScreen"]); },
    ...overrides,
  };
}

describe("TUI v3 modes — input", () => {
  describe("onEnter", () => {
    it("onEnter initializes empty buffer and renders", async () => {
      const { inputMode } = await import("./input.mjs");
      const ctx = makeInputCtx();
      inputMode.onEnter(ctx);
      expect(ctx.state.input).toEqual({ buffer: "", cursor: 0, error: null });
      expect(ctx.calls).toContainEqual(["renderScreen"]);
    });

    it("onEnter preserves existing input spec", async () => {
      const { inputMode } = await import("./input.mjs");
      const ctx = makeInputCtx();
      ctx.state.input = { spec: { title: "Test" }, buffer: "hello", cursor: 5, error: null };
      inputMode.onEnter(ctx);
      expect(ctx.state.input.buffer).toBe("hello");
      expect(ctx.state.input.cursor).toBe(5);
    });
  });

  describe("submit and cancel", () => {
    it("ENTER submits input", async () => {
      const { inputMode } = await import("./input.mjs");
      const ctx = makeInputCtx();
      ctx.state.input = { buffer: "hello", cursor: 5 };
      inputMode.onKey(ctx, "ENTER");
      expect(ctx.calls).toContainEqual(["submitInput"]);
    });

    it("ESCAPE cancels input", async () => {
      const { inputMode } = await import("./input.mjs");
      const ctx = makeInputCtx();
      ctx.state.input = { buffer: "hello", cursor: 5 };
      inputMode.onKey(ctx, "ESCAPE");
      expect(ctx.calls).toContainEqual(["cancelInput"]);
    });
  });

  describe("BACKSPACE", () => {
    it("BACKSPACE removes char before cursor", async () => {
      const { inputMode } = await import("./input.mjs");
      const ctx = makeInputCtx();
      ctx.state.input = { buffer: "hello", cursor: 2 };
      inputMode.onKey(ctx, "BACKSPACE");
      expect(ctx.state.input.buffer).toBe("hllo");
      expect(ctx.state.input.cursor).toBe(1);
    });

    it("BACKSPACE at position 0 does nothing", async () => {
      const { inputMode } = await import("./input.mjs");
      const ctx = makeInputCtx();
      ctx.state.input = { buffer: "hello", cursor: 0 };
      inputMode.onKey(ctx, "BACKSPACE");
      expect(ctx.state.input.buffer).toBe("hello");
      expect(ctx.state.input.cursor).toBe(0);
    });
  });

  describe("DELETE", () => {
    it("DELETE removes char at cursor", async () => {
      const { inputMode } = await import("./input.mjs");
      const ctx = makeInputCtx();
      ctx.state.input = { buffer: "hello", cursor: 2 };
      inputMode.onKey(ctx, "DELETE");
      expect(ctx.state.input.buffer).toBe("helo");
      expect(ctx.state.input.cursor).toBe(2);
    });

    it("DELETE at end does nothing", async () => {
      const { inputMode } = await import("./input.mjs");
      const ctx = makeInputCtx();
      ctx.state.input = { buffer: "hello", cursor: 5 };
      inputMode.onKey(ctx, "DELETE");
      expect(ctx.state.input.buffer).toBe("hello");
    });
  });

  describe("cursor movement", () => {
    it("LEFT decrements cursor", async () => {
      const { inputMode } = await import("./input.mjs");
      const ctx = makeInputCtx();
      ctx.state.input = { buffer: "hello", cursor: 3 };
      inputMode.onKey(ctx, "LEFT");
      expect(ctx.state.input.cursor).toBe(2);
    });

    it("LEFT clamps to 0", async () => {
      const { inputMode } = await import("./input.mjs");
      const ctx = makeInputCtx();
      ctx.state.input = { buffer: "hello", cursor: 0 };
      inputMode.onKey(ctx, "LEFT");
      expect(ctx.state.input.cursor).toBe(0);
    });

    it("RIGHT increments cursor", async () => {
      const { inputMode } = await import("./input.mjs");
      const ctx = makeInputCtx();
      ctx.state.input = { buffer: "hello", cursor: 2 };
      inputMode.onKey(ctx, "RIGHT");
      expect(ctx.state.input.cursor).toBe(3);
    });

    it("RIGHT clamps to buffer length", async () => {
      const { inputMode } = await import("./input.mjs");
      const ctx = makeInputCtx();
      ctx.state.input = { buffer: "hello", cursor: 5 };
      inputMode.onKey(ctx, "RIGHT");
      expect(ctx.state.input.cursor).toBe(5);
    });

    it("HOME moves cursor to start", async () => {
      const { inputMode } = await import("./input.mjs");
      const ctx = makeInputCtx();
      ctx.state.input = { buffer: "hello", cursor: 3 };
      inputMode.onKey(ctx, "HOME");
      expect(ctx.state.input.cursor).toBe(0);
    });

    it("CTRL_A moves cursor to start", async () => {
      const { inputMode } = await import("./input.mjs");
      const ctx = makeInputCtx();
      ctx.state.input = { buffer: "hello", cursor: 3 };
      inputMode.onKey(ctx, "CTRL_A");
      expect(ctx.state.input.cursor).toBe(0);
    });

    it("END moves cursor to end", async () => {
      const { inputMode } = await import("./input.mjs");
      const ctx = makeInputCtx();
      ctx.state.input = { buffer: "hello", cursor: 2 };
      inputMode.onKey(ctx, "END");
      expect(ctx.state.input.cursor).toBe(5);
    });

    it("CTRL_E moves cursor to end", async () => {
      const { inputMode } = await import("./input.mjs");
      const ctx = makeInputCtx();
      ctx.state.input = { buffer: "hello", cursor: 2 };
      inputMode.onKey(ctx, "CTRL_E");
      expect(ctx.state.input.cursor).toBe(5);
    });
  });

  describe("typing", () => {
    it("typeable character inserts at cursor", async () => {
      const { inputMode } = await import("./input.mjs");
      const ctx = makeInputCtx();
      ctx.state.input = { buffer: "hello", cursor: 2 };
      inputMode.onKey(ctx, "X");
      expect(ctx.state.input.buffer).toBe("heXllo");
      expect(ctx.state.input.cursor).toBe(3);
    });

    it("space is a printable char", async () => {
      const { inputMode } = await import("./input.mjs");
      const ctx = makeInputCtx();
      ctx.state.input = { buffer: "hello", cursor: 5 };
      inputMode.onKey(ctx, " ");
      expect(ctx.state.input.buffer).toBe("hello ");
    });

    it("non-printable key is ignored", async () => {
      const { inputMode } = await import("./input.mjs");
      const ctx = makeInputCtx();
      ctx.state.input = { buffer: "hello", cursor: 2 };
      inputMode.onKey(ctx, "CTRL_C");
      expect(ctx.state.input.buffer).toBe("hello");
    });

    it("insert at start", async () => {
      const { inputMode } = await import("./input.mjs");
      const ctx = makeInputCtx();
      ctx.state.input = { buffer: "world", cursor: 0 };
      inputMode.onKey(ctx, "H");
      expect(ctx.state.input.buffer).toBe("Hworld");
      expect(ctx.state.input.cursor).toBe(1);
    });

    it("insert at end", async () => {
      const { inputMode } = await import("./input.mjs");
      const ctx = makeInputCtx();
      ctx.state.input = { buffer: "hello", cursor: 5 };
      inputMode.onKey(ctx, "!");
      expect(ctx.state.input.buffer).toBe("hello!");
      expect(ctx.state.input.cursor).toBe(6);
    });
  });

  describe("rendering", () => {
    it("mutation triggers renderScreen", async () => {
      const { inputMode } = await import("./input.mjs");
      const ctx = makeInputCtx();
      ctx.state.input = { buffer: "", cursor: 0 };
      ctx.calls.length = 0;
      inputMode.onKey(ctx, "a");
      expect(ctx.calls).toContainEqual(["renderScreen"]);
    });

    it("unrecognized key does not render", async () => {
      const { inputMode } = await import("./input.mjs");
      const ctx = makeInputCtx();
      ctx.state.input = { buffer: "hello", cursor: 0 };
      ctx.calls.length = 0;
      inputMode.onKey(ctx, "F1");
      expect(ctx.calls.find((c) => c[0] === "renderScreen")).toBeUndefined();
    });
  });

  describe("null input guard", () => {
    it("returns early when input is null", async () => {
      const { inputMode } = await import("./input.mjs");
      const ctx = makeInputCtx();
      ctx.state.input = null;
      expect(() => inputMode.onKey(ctx, "a")).not.toThrow();
    });
  });
});
