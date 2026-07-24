import { describe, it, expect } from "vitest";
import { allTemplates, templateChoices, getTemplate } from "./templates.mjs";

describe("CLAUDE.md templates", () => {
  it("has 5 built-in templates", () => {
    expect(allTemplates()).toHaveLength(5);
  });

  it("minimal template is empty", () => {
    const t = getTemplate("minimal");
    expect(t.content.trim()).toBe("# CLAUDE.md");
  });

  it("founder-mvr template exists", () => {
    const t = getTemplate("founder-mvr");
    expect(t.content).toContain("MVR");
    expect(t.content).toContain("Code Rules");
  });

  it("templateChoices returns formatted list", () => {
    const choices = templateChoices();
    expect(choices).toHaveLength(5);
    for (const c of choices) {
      expect(c).toHaveProperty("name");
      expect(c).toHaveProperty("value");
    }
  });
});
