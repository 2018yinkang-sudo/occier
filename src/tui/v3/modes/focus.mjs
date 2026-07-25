// FOCUS mode — Phase 2 default mode.
// Replaces the navigate/select split. A visible cursor is always present
// when the panel has selectable items. UP/DOWN move the cursor directly;
// ENTER triggers the action on the focused item.

import { getCursorItemId } from "../state.mjs";

export const focusMode = {
  onEnter(ctx) {
    ctx.ensureCursorVisible();
    ctx.renderScreen();
  },

  onKey(ctx, key) {
    if (key === "LEFT" || key === "SHIFT_TAB") {
      ctx.switchTab(-1);
    } else if (key === "RIGHT" || key === "TAB") {
      ctx.switchTab(1);
    } else if (key === "UP") {
      ctx.moveCursor(-1);
    } else if (key === "DOWN") {
      ctx.moveCursor(1);
    } else if (key === "PAGE_UP") {
      ctx.scrollPage(-1);
    } else if (key === "PAGE_DOWN") {
      ctx.scrollPage(1);
    } else if (key === "HOME") {
      ctx.scrollTo(0);
    } else if (key === "END") {
      ctx.scrollTo(Infinity);
    } else if (key === "ENTER") {
      const items = ctx.getSelectableItems();
      const itemId = getCursorItemId(ctx.state, ctx.currentTabId(), items);
      if (itemId) ctx.invokeAction(itemId);
    } else if (key === "F5") {
      ctx.refreshTab();
    } else if (/^[1-6]$/.test(key)) {
      ctx.jumpToTab(Number(key) - 1);
    } else if (key === "/") {
      ctx.setMode("search");
    } else if (key === "l") {
      ctx.setMode("log");
    }
  },

  onExit() {},
};
