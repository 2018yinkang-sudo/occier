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
  return Math.max(1, term.height - 4);
}
