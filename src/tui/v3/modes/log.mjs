// LOG mode — press l to view the last 20 status messages.
// Half-screen overlay. Esc, q, l, or Enter closes.

export const logMode = {
  onEnter(ctx) { ctx.renderScreen(); },

  onKey(ctx, key) {
    if (key === "ESCAPE" || key === "q" || key === "l" || key === "ENTER") {
      ctx.setMode("focus");
    }
  },

  onExit() {},
};
