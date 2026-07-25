import { line, selectedLine, sectionHeader } from "../v3/panel-utils.mjs";

export async function renderPanel(term, state, budget) {
  const pad = "  ";
  const selectedId = state.cursorItemId ?? null;
  const draw = (id, ...parts) => {
    if (id && selectedId === id) {
      selectedLine(term, { text: "▸ " }, ...parts);
    } else {
      line(term, { text: "› ", fg: "brightWhite" }, ...parts);
    }
  };

  const emitLine = (...parts) => {
    const st = budget.nextLine();
    if (st === "beyond") return true;
    if (st === "draw") line(term, ...parts);
    return false;
  };
  const emitHeader = (title) => {
    const st = budget.nextLine();
    if (st === "beyond") return true;
    if (st === "draw") sectionHeader(term, title);
    return false;
  };
  const emitItem = (id, label, ...parts) => {
    const st = budget.nextLine();
    if (st === "draw") { budget.tag(id, label); draw(id, ...parts); }
    else if (st === "beyond") { budget.tag(id, label); }
    return false;
  };

  if (emitHeader("Projects")) return;

  if (budget.shouldShow("Create project")) {
    if (emitItem("create", "Create project",
      { text: `${pad}`, fg: "white" },
      { text: "occier project create", fg: "cyan" },
      { text: " — create a new project", fg: "gray" },
    )) return;
  }

  if (budget.shouldShow("Open project")) {
    if (emitItem("open", "Open project",
      { text: `${pad}`, fg: "white" },
      { text: "occier project open", fg: "cyan" },
      { text: " — open an existing project", fg: "gray" },
    )) return;
  }

  if (budget.shouldShow("Launch IDE")) {
    if (emitItem("launch", "Launch IDE",
      { text: `${pad}`, fg: "white" },
      { text: "occier launch", fg: "cyan" },
      { text: " — launch Claude Code or OpenCode", fg: "gray" },
    )) return;
  }

  if (emitLine({ text: "", fg: "white" })) return;

  emitLine(
    { text: `${pad}Press `, fg: "gray" },
    { text: "Enter", fg: "cyan" },
    { text: " on an item to see the command to run.", fg: "gray" },
  );
  term.styleReset();
}

export async function handleAction(_term, itemId) {
  if (itemId === "create") {
    return "Run: occier project create";
  }
  if (itemId === "open") {
    return "Run: occier project open";
  }
  if (itemId === "launch") {
    return "Run: occier launch";
  }
  return null;
}

export function getTabSummary() {
  return { count: 3 };
}
