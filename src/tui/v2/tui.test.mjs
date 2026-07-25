import { describe, it, expect } from "vitest";
import { renderPanel as dashboardPanel } from "./dashboard.mjs";
import { renderPanel as networkPanel } from "./network.mjs";
import { renderPanel as vaultPanel } from "./vault.mjs";
import { renderPanel as providerPanel } from "./provider.mjs";
import { renderPanel as toolsPanel } from "./tools.mjs";
import { renderPanel as projectsPanel } from "./projects.mjs";
import { line, sectionHeader } from "./panel-utils.mjs";

function createMockTerm() {
  const lines = [];

  function term(s) {
    if (s !== undefined) lines.push(String(s));
    return term;
  }

  term.write = (s) => lines.push(String(s));
  term.moveTo = () => {};
  term.clear = () => { lines.length = 0; };
  term.height = 24;
  term.width = 80;
  term.eraseDisplayAfter = () => {};

  const props = [
    "bold", "italic", "underline", "dim", "brightCyan", "brightGreen", "brightYellow", "brightRed", "brightBlue",
    "gray", "cyan", "green", "yellow", "red", "blue", "white", "black", "brightWhite",
    "bgGray", "bgBlack", "bgBrightCyan",
    "bgBrightWhite", "bgBrightRed", "styleReset", "noFormat",
  ];

  for (const prop of props) {
    term[prop] = (...args) => {
      if (args.length > 0) lines.push(String(args.join("")));
      return term;
    };
  }

  return { term, lines };
}

describe("TUI panels", () => {
  it("dashboard panel renders without error", async () => {
    const { term, lines } = createMockTerm();
    await dashboardPanel(term);
    const output = lines.join("");
    expect(output).toContain("System Status");
    expect(output).toContain("Providers");
    expect(output).toContain("credentials");
  });

  it("network panel renders without error", async () => {
    const { term, lines } = createMockTerm();
    await networkPanel(term);
    const output = lines.join("");
    expect(output).toContain("Platform");
    expect(output).toContain("Proxy");
    expect(output).toContain("Mirrors");
  });

  it("vault panel renders without error", async () => {
    const { term, lines } = createMockTerm();
    await vaultPanel(term);
    const output = lines.join("");
    expect(output).toContain("Credential Vault");
    expect(output).toContain("credentials");
  });

  it("provider panel renders without error", async () => {
    const { term, lines } = createMockTerm();
    await providerPanel(term);
    const output = lines.join("");
    expect(output).toContain("Providers");
    expect(output).toContain("Available");
  });

  it("tools panel renders without error", async () => {
    const { term, lines } = createMockTerm();
    await toolsPanel(term);
    const output = lines.join("");
    expect(output).toContain("Development Tools");
    expect(output).toContain("Claude Code");
    expect(output).toContain("OpenCode");
  });

  it("projects panel renders without error", async () => {
    const { term, lines } = createMockTerm();
    await projectsPanel(term);
    const output = lines.join("");
    expect(output).toContain("Projects");
  });

  it("panels take exactly one argument (no refreshFn)", () => {
    for (const panel of [dashboardPanel, networkPanel, vaultPanel, providerPanel, toolsPanel, projectsPanel]) {
      expect(panel.length).toBe(1);
    }
  });
});

describe("panel-utils", () => {
  it("line() resets style and writes segments", () => {
    const { term, lines } = createMockTerm();
    line(term,
      { text: "  ", fg: "white" },
      { text: "●", fg: "brightGreen", bold: true },
      { text: "  label", fg: "brightWhite" },
    );
    const joined = lines.join("");
    expect(joined).toContain("label");
  });

  it("sectionHeader writes a cyan line with title", () => {
    const { term, lines } = createMockTerm();
    sectionHeader(term, "Test Section");
    const joined = lines.join("");
    expect(joined).toContain("─");
    expect(joined).toContain("Test Section");
  });
});
