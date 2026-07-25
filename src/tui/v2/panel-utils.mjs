// Shared TUI panel helpers — explicit fg per line to prevent terminal-kit SGR
// state bleed, consistent section headers, and line-count budgeting.

export function line(term, ...parts) {
  term.styleReset();
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
  term.brightCyan("─ ");
  term.bold(title);
  term("\n");
}

// First line a panel may write to (row 4: header + tab bar + blank).
export const CONTENT_START = 4;

// Maximum lines before the footer row.
export function contentMaxLines(term) {
  return Math.max(1, term.height - 5);
}
