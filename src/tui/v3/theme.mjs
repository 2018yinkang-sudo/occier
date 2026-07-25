// Design tokens for TUI v3.
// Phase 1 intentionally keeps the v2 color palette so the visible UI does not
// change while we refactor the architecture. Later phases will evolve the
// grammar (selectable markers, bordered modal, etc.).

export const theme = {
  chrome: {
    header:     { bg: "bgBrightCyan", fg: "black" },
    tabBar:     { bg: "bgGray",       fg: "brightCyan", activeBg: "bgBrightWhite", activeFg: "black" },
    footer:     { bg: "bgGray",       fg: "brightCyan" },
  },
  content: {
    sectionHeader: { fg: "brightCyan", marker: "─ " },
    hint:          { fg: "gray" },
    command:       { fg: "cyan" },
  },
  item: {
    bullet:        "●",
    // Phase 1: selectable rows are visually identical to non-selectable rows,
    // matching v2 behavior. Phase 2 will introduce visible markers.
    selectable:    { fg: "brightWhite" },
    focused:       { bg: "bgBrightWhite", fg: "black" },
  },
  status: {
    // Phase 1: keep v2 single brightCyan footer.
    info:    { fg: "brightCyan", duration: 2000 },
    success: { fg: "brightCyan", duration: 2000 },
    error:   { fg: "brightCyan", duration: 2000 },
  },
  state: {
    ok:    { bulletFg: "brightGreen" },
    warn:  { bulletFg: "yellow" },
    error: { bulletFg: "brightRed" },
  },
};
