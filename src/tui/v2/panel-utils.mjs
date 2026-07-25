// Shared TUI panel helpers — explicit fg + bg per line to prevent terminal-kit
// SGR state bleed, consistent section headers, and line-count budgeting.

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

// First content row (1-based). Not used by panels directly — provided for
// reference to callers that need explicit cursor positioning.
export const CONTENT_START = 4;

// Maximum content lines before the footer row.
// Header(1) + tab bar(1) + spacer(1) + footer(1) = 4 rows.
export function contentMaxLines(term) {
  const h = Number.isFinite(term.height) ? term.height : 24;
  return Math.max(1, h - 4);
}

// Create a scroll-aware line budgeter. Panels use this exactly like the
// previous `let lines = 0; function okLine() {...}` pattern, but it also
// skips `scrollOffset` logical lines at the top and clamps at `max` drawn
// lines. Returns the budgeting object.
export function makeLineBudget(term, scrollOffset = 0) {
  const max = contentMaxLines(term);
  let logical = 0;
  let drawn = 0;
  return {
    // Returns true when the panel has filled the viewport and should stop.
    okLine() {
      logical++;
      if (logical <= scrollOffset) return false;
      drawn++;
      return drawn > max;
    },
  };
}

// Same as `line()` but renders with a bright white background and black
// foreground to indicate the currently selected interactive row.
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
