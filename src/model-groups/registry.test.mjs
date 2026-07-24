import { describe, it, expect } from "vitest";
import { getGroup, getGroupSafe, allGroups, groupChoices } from "./registry.mjs";

describe("model groups", () => {
  it("has 5 built-in groups", () => {
    expect(allGroups()).toHaveLength(5);
  });

  it("balanced uses deepseek", () => {
    const g = getGroup("balanced");
    expect(g.provider).toBe("deepseek");
    expect(g.models.primary).toBe("deepseek-v4-pro[1m]");
    expect(g.models.fast).toBe("deepseek-v4-flash");
  });

  it("frontend uses kimi", () => {
    const g = getGroup("frontend");
    expect(g.provider).toBe("kimi");
    expect(g.models.primary).toBe("kimi-k3[1m]");
  });

  it("economy uses flash only", () => {
    const g = getGroup("economy");
    expect(g.models.primary).toBe("deepseek-v4-flash");
    expect(g.models.reasoning).toBe("deepseek-v4-flash");
  });

  it("getGroupSafe returns null for unknown", () => {
    expect(getGroupSafe("nonexistent")).toBeNull();
  });

  it("groupChoices returns formatted choices", () => {
    const choices = groupChoices();
    expect(choices).toHaveLength(5);
    for (const c of choices) {
      expect(c).toHaveProperty("name");
      expect(c).toHaveProperty("value");
    }
  });
});
