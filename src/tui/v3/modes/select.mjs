export const selectMode = {
  onEnter(ctx) {
    if (ctx.state.select && ctx.state.select.cursor === undefined) {
      ctx.state.select.cursor = ctx.state.select.defaultCursor || 0;
    }
    ctx.renderScreen();
  },

  onKey(ctx, key) {
    const sel = ctx.state.select;
    if (!sel || !sel.choices || sel.choices.length === 0) return;

    if (key === "ENTER") {
      const chosen = sel.choices[sel.cursor];
      ctx.confirmSelect(chosen ? chosen.value : null);
      return;
    }
    if (key === "ESCAPE") {
      ctx.cancelSelect();
      return;
    }
    if (key === "UP") {
      sel.cursor = Math.max(0, sel.cursor - 1);
      ctx.renderScreen();
    } else if (key === "DOWN") {
      sel.cursor = Math.max(0, Math.min(sel.choices.length - 1, sel.cursor + 1));
      ctx.renderScreen();
    } else if (/^[1-9]$/.test(key)) {
      const idx = Number(key) - 1;
      if (idx < sel.choices.length) {
        sel.cursor = idx;
        ctx.confirmSelect(sel.choices[idx].value);
      }
    }
  },

  onExit() {},
};
