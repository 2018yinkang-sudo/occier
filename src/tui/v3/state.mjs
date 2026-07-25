// Central, immutable-friendly state object for TUI v3.
// The framework owns the mutable reference; tests can create their own.

export function createState() {
  return {
    currentTab: 0,
    mode: "focus", // "focus" | "input" | "search" | "log" | "select"
    scrollOffsets: {}, // tabId -> integer
    cursor: {},        // tabId -> itemId
    status: null,      // { message, kind, ts }  (kind: info|success|error)
    statusHistory: [], // array of status objects
    input: null,       // { spec, buffer, cursor, error }
    actionInFlight: false,
    forceRefresh: false,
    search: null,      // { query } | null
    select: null,      // { choices: [{label,value}], cursor, prompt, continue } | null
  };
}

export function getCursorItemId(state, tabId, items) {
  const id = state.cursor[tabId];
  if (id && items.some((i) => i.id === id)) return id;
  return items[0]?.id ?? null;
}

export function setCursorItem(state, tabId, itemId) {
  state.cursor[tabId] = itemId;
}

export function getScrollOffset(state, tabId) {
  return state.scrollOffsets[tabId] ?? 0;
}

export function setScrollOffset(state, tabId, offset) {
  state.scrollOffsets[tabId] = Math.max(0, offset);
}
