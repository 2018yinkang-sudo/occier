// NAVIGATE mode — Phase 1 equivalent of v2 navigate.
// UP/DOWN scroll, ENTER enters select mode, LEFT/RIGHT/TAB switch tabs.

export const navigateMode = {
  onEnter(ctx) { ctx.renderScreen(); },

  onKey(ctx, key) {
    if (key === "LEFT" || key === "SHIFT_TAB") {
      ctx.switchTab(-1);
    } else if (key === "RIGHT" || key === "TAB") {
      ctx.switchTab(1);
    } else if (key === "F5") {
      ctx.refreshTab();
    } else if (key === "UP") {
      ctx.scrollContent(-1);
    } else if (key === "DOWN") {
      ctx.scrollContent(1);
    } else if (key === "ENTER") {
      const items = ctx.getSelectableItems();
      if (items.length > 0) {
        const tabId = ctx.currentTabId();
        if (ctx.state.cursor[tabId] === undefined) {
          ctx.state.cursor[tabId] = items[0].id;
        }
        ctx.setMode("select");
      }
    }
  },

  onExit() {},
};
