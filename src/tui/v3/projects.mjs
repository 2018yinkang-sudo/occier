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

  sectionHeader(term, "Projects");
  if (budget.okLine()) return;

  budget.tag("create", "Create project");
  draw("create",
    { text: `${pad}`, fg: "white" },
    { text: "occier project create", fg: "cyan" },
    { text: " — create a new project", fg: "gray" },
  );
  if (budget.okLine()) return;

  budget.tag("open", "Open project");
  draw("open",
    { text: `${pad}`, fg: "white" },
    { text: "occier project open", fg: "cyan" },
    { text: " — open an existing project", fg: "gray" },
  );
  if (budget.okLine()) return;

  budget.tag("launch", "Launch IDE");
  draw("launch",
    { text: `${pad}`, fg: "white" },
    { text: "occier launch", fg: "cyan" },
    { text: " — launch Claude Code or OpenCode", fg: "gray" },
  );
  if (budget.okLine()) return;

  line(term, { text: "", fg: "white" });
  if (budget.okLine()) return;

  line(term,
    { text: `${pad}Press Enter on an item to run the command`, fg: "gray" },
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
