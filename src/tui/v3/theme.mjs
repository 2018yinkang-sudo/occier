// Design tokens for TUI v3.
// Phase 3 evolves the color grammar: selectable markers, bordered modal, and
// differentiated status colours (green=success, red=error, cyan=info).

export const theme = {
  chrome: {
    header:      { bg: "bgBrightCyan", fg: "black" },
    tabBar:      { bg: "bgGray", fg: "brightCyan", activeBg: "bgBrightWhite", activeFg: "black" },
    statusLine:  { bg: "bgBlack" },
    footer:      { bg: "bgGray", fg: "brightCyan" },
  },
  content: {
    sectionHeader: { fg: "brightCyan", marker: "─ " },
    hint:          { fg: "gray" },
    command:       { fg: "cyan" },
  },
  item: {
    bullet:        "●",
    selectable:    { fg: "brightWhite" },
    focused:       { bg: "bgBrightWhite", fg: "black" },
  },
  status: {
    info:    { fg: "brightCyan",  icon: "ℹ", duration: 2500 },
    success: { fg: "brightGreen", icon: "✓", duration: 2500 },
    error:   { fg: "brightRed",   icon: "✗", duration: 5000 },
  },
  state: {
    ok:    { bulletFg: "brightGreen" },
    warn:  { bulletFg: "yellow" },
    error: { bulletFg: "brightRed" },
  },
  modal: {
    border: { fg: "brightCyan", h: "─", v: "│", tl: "┌", tr: "┐", bl: "└", br: "┘" },
    title:  { bg: "bgBrightCyan", fg: "black" },
    body:   { bg: "bgBlack", fg: "white" },
    hint:   { fg: "gray" },
  },
};
