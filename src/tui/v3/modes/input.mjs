// INPUT mode — Phase 1 equivalent of v2 input modal.
// Supports full cursor editing; remains visually identical to v2 in Phase 1.

export const inputMode = {
  onEnter(ctx) {
    if (!ctx.state.input) {
      ctx.state.input = { buffer: "", cursor: 0, error: null };
    }
    ctx.renderScreen();
  },

  onKey(ctx, key) {
    const input = ctx.state.input;
    if (!input) return;

    if (key === "ENTER") {
      ctx.submitInput();
      return;
    }
    if (key === "ESCAPE") {
      ctx.cancelInput();
      return;
    }

    let changed = false;
    if (key === "BACKSPACE") {
      if (input.cursor > 0) {
        input.buffer = input.buffer.slice(0, input.cursor - 1) + input.buffer.slice(input.cursor);
        input.cursor--;
        changed = true;
      }
    } else if (key === "DELETE") {
      if (input.cursor < input.buffer.length) {
        input.buffer = input.buffer.slice(0, input.cursor) + input.buffer.slice(input.cursor + 1);
        changed = true;
      }
    } else if (key === "LEFT") {
      input.cursor = Math.max(0, input.cursor - 1);
      changed = true;
    } else if (key === "RIGHT") {
      input.cursor = Math.min(input.buffer.length, input.cursor + 1);
      changed = true;
    } else if (key === "HOME" || key === "CTRL_A") {
      input.cursor = 0;
      changed = true;
    } else if (key === "END" || key === "CTRL_E") {
      input.cursor = input.buffer.length;
      changed = true;
    } else if (key.length === 1 && key >= " " && key <= "~") {
      input.buffer = input.buffer.slice(0, input.cursor) + key + input.buffer.slice(input.cursor);
      input.cursor++;
      changed = true;
    }

    if (changed) ctx.renderScreen();
  },

  onExit() {},
};
