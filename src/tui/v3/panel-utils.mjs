export const CONTENT_START = 4;

export function contentMaxLines(term) {
  const h = Number.isFinite(term.height) ? term.height : 24;
  return Math.max(1, h - 5);
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
  term.brightCyan("\u2500 ");
  term.bold(title);
  term("\n");
}

export function secondaryHeader(term, title) {
  term.styleReset();
  term.bgBlack();
  term.gray("\u00B7\u00B7 ");
  term.bold(title);
  term("\n");
}

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
      if (p.fg) { term[FG_REMAP[p.fg] || p.fg](); } else { term.black(); }
      if (p.bold) term.bold();
      term(text);
      remaining -= text.length;
    }
  }

  term("\n");
}

export function skeletonLine(term, width) {
  term.styleReset();
  term.bgBlack();
  term.gray("  ");
  const barWidth = Math.min(width || 30, (Number.isFinite(term.width) ? term.width : 80) - 4);
  if (barWidth > 0) term.gray("\u2592".repeat(barWidth));
  term("\n");
}

export function skeletonHeader(term, title) {
  term.styleReset();
  term.bgBlack();
  term.gray(`\u2500 ${title}`);
  term("\n");
}

export function makeLineBudget(term, scrollOffset = 0) {
  const max = contentMaxLines(term);
  let logical = 0;
  let drawn = 0;
  const items = [];
  let searchQuery = null;

  return {
    nextLine() {
      logical++;
      if (logical <= scrollOffset) return "skip";
      drawn++;
      if (drawn > max) return "beyond";
      return "draw";
    },
    okLine() {
      logical++;
      if (logical <= scrollOffset) return false;
      drawn++;
      return drawn > max;
    },
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
