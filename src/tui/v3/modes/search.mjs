// SEARCH mode — press / to enter, type query, Enter to jump to first match.
// Esc cancels and returns to focus mode.
// A lightweight vim-style search for the current panel's selectable items.

export const searchMode = {
  onEnter(ctx) {
    ctx.state.search = { query: "" };
    ctx.renderScreen();
  },

  onKey(ctx, key) {
    if (key === "ESCAPE") {
      ctx.state.search = null;
      ctx.setMode("focus");
      return;
    }
    if (key === "ENTER") {
      const q = ctx.state.search.query.toLowerCase();
      const items = ctx.getSelectableItems();
      ctx.state.search = null;
      const match = items.find((i) => i.label.toLowerCase().includes(q));
      if (match) {
        ctx.state.cursor[ctx.currentTabId()] = match.id;
        ctx.ensureCursorVisible();
      } else if (q) {
        ctx.showStatus("No match", "info");
      }
      ctx.setMode("focus");
      return;
    }
    if (key === "BACKSPACE") {
      ctx.state.search.query = ctx.state.search.query.slice(0, -1);
    } else if (key.length === 1 && key >= " " && key <= "~") {
      ctx.state.search.query += key;
    }
    ctx.renderScreen();
  },

  onExit(ctx) {
    ctx.state.search = null;
  },
};
