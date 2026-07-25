// Shared TUI v3 panel helpers.
// The key addition is makeLineBudget v2, which records selectable-item
// positions as a side effect of rendering so the framework no longer relies on
// hand-maintained getSelectableItems/getScrollInfo.

export const CONTENT_START = 4;

export function contentMaxLines(term) {
  const h = Number.isFinite(term.height) ? term.height : 24;
  return Math.max(1, h - 5); // header + tabbar + spacer + statusline + footer
}

export function line(term, ...parts) {
  term.styleReset();
  term.bgBlack();

  const w = Number.isFinite(term.width) ? term.width : 80;
  let remaining = w;

  for (const p of parts) {
    if (remaining <= 0) break;
    if (typeof p === "string") {
      const text = p.length > remaining ? p.slice(0, remaining) : p;
      term(text);
      remaining -= text.length;
    } else {
      const text = (p.text ?? "").length > remaining
        ? (p.text ?? "").slice(0, remaining)
        : (p.text ?? "");
      if (p.fg) term[p.fg]();
      if (p.bold) term.bold();
      term(text);
      remaining -= text.length;
    }
  }

  term("\n");
}

export function sectionHeader(term, title) {
  term.styleReset();
  term.bgBlack();
  term.brightCyan("─ ");
  term.bold(title);
  term("\n");
}

// When drawing a focused/inverted row (bgBrightWhite), map bright foreground
// colors to their dark variants so text remains readable.
const FG_REMAP = {
  brightWhite: "black",
  white: "black",
  brightGreen: "green",
  brightCyan: "cyan",
  brightRed: "red",
  brightBlue: "blue",
  brightMagenta: "magenta",
  brightYellow: "yellow",
  brightBlack: "gray",
};

export function selectedLine(term, ...parts) {
  term.styleReset();
  term.bgBrightWhite();

  const w = Number.isFinite(term.width) ? term.width : 80;
  let remaining = w;

  for (const p of parts) {
    if (remaining <= 0) break;
    if (typeof p === "string") {
      const text = p.length > remaining ? p.slice(0, remaining) : p;
      term.black(text);
      remaining -= text.length;
    } else {
      const text = (p.text ?? "").length > remaining
        ? (p.text ?? "").slice(0, remaining)
        : (p.text ?? "");
      // Remap bright colors to dark variants on the inverted background.
      if (p.fg) { term[FG_REMAP[p.fg] || p.fg](); } else { term.black(); }
      if (p.bold) term.bold();
      term(text);
      remaining -= text.length;
    }
  }

  term("\n");
}

// v2 budget: counts logical lines and clamps drawn lines to the viewport.
// v3 addition: records selectable-item positions via budget.tag().
//
// Scrolling contract: panels MUST call nextLine() BEFORE drawing each row.
// nextLine() returns one of:
//   "skip" — this logical line is above the scroll offset; do NOT draw it
//   "draw" — this line is within the viewport; draw it
//   "full" — the viewport is full; stop drawing (return/break)
// This ensures scrollOffset actually hides rows instead of drawing them.
export function makeLineBudget(term, scrollOffset = 0) {
  const max = contentMaxLines(term);
  let logical = 0;
  let drawn = 0;
  const items = [];
  let searchQuery = null;

  return {
    // Call BEFORE drawing a line. Returns "skip" | "draw" | "beyond".
    //   "skip"   — above scroll offset; do NOT draw, do NOT tag
    //   "draw"   — within viewport; draw and tag
    //   "beyond" — past viewport; do NOT draw, but DO tag (so cursor
    //              can reach items below the fold and ensureCursorVisible
    //              can scroll to them)
    nextLine() {
      logical++;
      if (logical <= scrollOffset) return "skip";
      drawn++;
      if (drawn > max) return "beyond";
      return "draw";
    },
    // Legacy alias: returns true when the viewport is full (stop signal).
    // Kept for backward-compat with panels not yet migrated to nextLine().
    okLine() {
      logical++;
      if (logical <= scrollOffset) return false;
      drawn++;
      return drawn > max;
    },
    // Call AFTER nextLine() returns "draw", BEFORE drawing, to register a
    // selectable item at the current logical position.
    tag(id, label) {
      items.push({ id, label, logicalLine: logical, drawnLine: drawn });
    },
    setSearchQuery(q) {
      searchQuery = q ? q.toLowerCase() : null;
    },
    shouldShow(label) {
      if (!searchQuery) return true;
      return (label || "").toLowerCase().includes(searchQuery);
    },
    get items() { return items; },
    get totalLines() { return logical; },
    get drawnLines() { return drawn; },
  };
}
