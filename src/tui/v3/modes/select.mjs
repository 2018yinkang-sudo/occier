// SELECT mode — Phase 1 equivalent of v2 select.
// UP/DOWN move cursor, ENTER invokes action, ESC returns to navigate.

export const selectMode = {
  onEnter(ctx) { ctx.ensureCursorVisible(); ctx.renderScreen(); },

  onKey(ctx, key) {
    const items = ctx.getSelectableItems();
    if (items.length === 0) {
      ctx.setMode("navigate");
      return;
    }

    const tabId = ctx.currentTabId();
    let idx = items.findIndex((i) => i.id === ctx.state.cursor[tabId]);
    if (idx < 0) idx = 0;

    if (key === "UP") {
      idx = Math.max(0, idx - 1);
    } else if (key === "DOWN") {
      idx = Math.min(items.length - 1, idx + 1);
    } else if (key === "ENTER") {
      ctx.invokeAction(items[idx].id);
      return;
    } else if (key === "ESCAPE") {
      ctx.setMode("navigate");
      return;
    } else {
      return;
    }

    ctx.state.cursor[tabId] = items[idx].id;
    ctx.ensureCursorVisible();
    ctx.renderScreen();
  },

  onExit() {},
};
