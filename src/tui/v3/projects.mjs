import { line, sectionHeader } from "../v3/panel-utils.mjs";

export async function renderPanel(term, _state, budget) {
  const pad = "  ";

  sectionHeader(term, "Projects");
  if (budget.okLine()) return;

  line(term,
    { text: `${pad}Use `, fg: "gray" },
    { text: "occier project create", fg: "cyan" },
    { text: " to create a new project", fg: "gray" },
  );
  if (budget.okLine()) return;

  line(term,
    { text: `${pad}Use `, fg: "gray" },
    { text: "occier project open", fg: "cyan" },
    { text: " to open an existing project", fg: "gray" },
  );
  if (budget.okLine()) return;

  line(term,
    { text: `${pad}Use `, fg: "gray" },
    { text: "occier launch", fg: "cyan" },
    { text: " to launch Claude Code or OpenCode", fg: "gray" },
  );
  term.styleReset();
}
