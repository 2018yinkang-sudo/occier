import { describe, it, expect } from "vitest";
import { renderPanel as dashboardPanel } from "./dashboard.mjs";
import { renderPanel as networkPanel } from "./network.mjs";
import { renderPanel as vaultPanel } from "./vault.mjs";
import { renderPanel as providerPanel, getScrollInfo as providerScrollInfo } from "./provider.mjs";
import { renderPanel as toolsPanel, getScrollInfo as toolsScrollInfo } from "./tools.mjs";
import { renderPanel as projectsPanel } from "./projects.mjs";
import { line, sectionHeader, selectedLine, makeLineBudget } from "./panel-utils.mjs";

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

  it("tools and projects panels honour scrollOffset", async () => {
    const { term: t1, lines: l1 } = createMockTerm();
    t1.height = 6; // small viewport
    await toolsPanel(t1, { scrollOffset: 2 });
    const out1 = l1.join("");
    expect(out1).toContain("GitHub"); // first 2 lines (Development Tools + Claude) skipped

    const { term: t2, lines: l2 } = createMockTerm();
    await projectsPanel(t2, { scrollOffset: 1 });
    const out2 = l2.join("");
    expect(out2).toContain("occier project open");
  });

  it("selectedLine renders text with bright white background", () => {
    const { term, lines } = createMockTerm();
    selectedLine(term, { text: "selected", fg: "gray" });
    const joined = lines.join("");
    expect(joined).toContain("selected");
  });

  it("tools panel highlights selected item in select mode", async () => {
    const { term } = createMockTerm();
    await expect(toolsPanel(term, { mode: "select", cursorItemId: "opencode" })).resolves.toBeUndefined();
  });

  it("scrollable panels export getScrollInfo", () => {
    expect(typeof toolsScrollInfo).toBe("function");
    expect(typeof providerScrollInfo).toBe("function");
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

  it("makeLineBudget skips scrollOffset lines then clamps at max", () => {
    const termLike = { width: 80, height: 10 }; // max = 6
    const budget = makeLineBudget(termLike, 2);
    const results = [];
    for (let i = 0; i < 10; i++) {
      results.push(budget.okLine());
    }
    // First 2 logical lines skipped -> false
    expect(results[0]).toBe(false);
    expect(results[1]).toBe(false);
    // Next 6 drawn -> false
    expect(results[2]).toBe(false);
    expect(results[3]).toBe(false);
    expect(results[4]).toBe(false);
    expect(results[5]).toBe(false);
    expect(results[6]).toBe(false);
    expect(results[7]).toBe(false);
    // 9th line exceeds max -> true
    expect(results[8]).toBe(true);
    expect(results[9]).toBe(true);
  });
});
