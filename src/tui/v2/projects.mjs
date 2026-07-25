import { line, sectionHeader } from "./panel-utils.mjs";

export async function renderPanel(term) {
  const pad = "  ";

  sectionHeader(term, "Projects");

  line(term,
    { text: `${pad}Use `, fg: "gray" },
    { text: "occier project create", fg: "cyan" },
    { text: " to create a new project", fg: "gray" },
  );
  line(term,
    { text: `${pad}Use `, fg: "gray" },
    { text: "occier project open", fg: "cyan" },
    { text: " to open an existing project", fg: "gray" },
  );
  line(term,
    { text: `${pad}Use `, fg: "gray" },
    { text: "occier launch", fg: "cyan" },
    { text: " to launch Claude Code or OpenCode", fg: "gray" },
  );
}
