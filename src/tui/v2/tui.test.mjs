import { describe, it, expect } from "vitest";
import { renderPanel as dashboardPanel } from "./dashboard.mjs";
import { renderPanel as networkPanel } from "./network.mjs";
import { renderPanel as vaultPanel } from "./vault.mjs";
import { renderPanel as providerPanel } from "./provider.mjs";
import { renderPanel as toolsPanel } from "./tools.mjs";
import { renderPanel as projectsPanel } from "./projects.mjs";

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

  const props = [
    "bold", "italic", "underline", "dim", "brightCyan", "brightGreen", "brightYellow", "brightRed", "brightBlue",
    "gray", "cyan", "green", "yellow", "red", "blue", "white", "black", "bgGray", "bgBlack", "bgBrightCyan",
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
    await dashboardPanel(term, null);
    const output = lines.join("");
    expect(output).toContain("System Status");
    expect(output).toContain("Providers");
    expect(output).toContain("credentials");
  });

  it("network panel renders without error", async () => {
    const { term, lines } = createMockTerm();
    await networkPanel(term, null);
    const output = lines.join("");
    expect(output).toContain("Platform");
    expect(output).toContain("Proxy");
    expect(output).toContain("Mirrors");
  });

  it("vault panel renders without error", async () => {
    const { term, lines } = createMockTerm();
    await vaultPanel(term, null);
    const output = lines.join("");
    expect(output).toContain("Credential Vault");
    expect(output).toContain("credentials");
  });

  it("provider panel renders without error", async () => {
    const { term, lines } = createMockTerm();
    await providerPanel(term, null);
    const output = lines.join("");
    expect(output).toContain("Providers");
    expect(output).toContain("Available");
  });

  it("tools panel renders without error", async () => {
    const { term, lines } = createMockTerm();
    await toolsPanel(term, null);
    const output = lines.join("");
    expect(output).toContain("Development Tools");
    expect(output).toContain("Claude Code");
    expect(output).toContain("OpenCode");
  });

  it("projects panel renders without error", async () => {
    const { term, lines } = createMockTerm();
    await projectsPanel(term, null);
    const output = lines.join("");
    expect(output).toContain("Projects");
  });
});
