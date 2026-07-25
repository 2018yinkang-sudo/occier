export async function renderPanel(term, refreshFn) {
  const w = Math.min(64, term.width - 4);
  const pad = "  ";

  drawSectionHeader(term, pad, w, "Projects");

  term.gray(`${pad}Use `);
  term.cyan("occier project create");
  term.gray(" to create a new project\n");
  term.gray(`${pad}Use `);
  term.cyan("occier project open");
  term.gray(" to open an existing project\n");
  term.gray(`${pad}Use `);
  term.cyan("occier launch");
  term.gray(" to launch Claude Code or OpenCode\n");

  if (refreshFn) refreshFn();
}

function drawSectionHeader(term, pad, w, title) {
  term(`${pad}`);
  term.brightCyan("─ ");
  term.bold(title);
  term.gray(` ${"─".repeat(Math.max(0, w - title.length - 4))}\n`);
}
