// Shared TUI v3 panel helpers.
// The key addition is makeLineBudget v2, which records selectable-item
// positions as a side effect of rendering so the framework no longer relies on
// hand-maintained getSelectableItems/getScrollInfo.

export const CONTENT_START = 4;

export function contentMaxLines(term) {
  const h = Number.isFinite(term.height) ? term.height : 24;
  return Math.max(1, h - 4);
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
      term.black(text);
      remaining -= text.length;
    }
  }

  term("\n");
}

// v2 budget: counts logical lines and clamps drawn lines to the viewport.
// v3 addition: records selectable-item positions via budget.tag().
export function makeLineBudget(term, scrollOffset = 0) {
  const max = contentMaxLines(term);
  let logical = 0;
  let drawn = 0;
  const items = [];

  return {
    okLine() {
      logical++;
      if (logical <= scrollOffset) return false;
      drawn++;
      return drawn > max;
    },
    tag(id, label) {
      items.push({ id, label, logicalLine: logical + 1, drawnLine: drawn + 1 });
    },
    get items() { return items; },
    get totalLines() { return logical; },
    get drawnLines() { return drawn; },
  };
}
