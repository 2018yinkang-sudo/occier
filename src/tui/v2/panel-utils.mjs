// Shared TUI panel helpers — explicit fg + bg per line to prevent terminal-kit
// SGR state bleed, consistent section headers, and line-count budgeting.

export function line(term, ...parts) {
  term.styleReset();
  term.bgBlack();
  for (const p of parts) {
    if (typeof p === "string") {
      term(p);
    } else {
      if (p.fg) term[p.fg]();
      if (p.bold) term.bold();
      term(p.text);
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
