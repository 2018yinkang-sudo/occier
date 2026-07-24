import { describe, it, expect } from "vitest";
import { SCHEMAS, createDefaultConfig } from "./config.mjs";

describe("SCHEMAS", () => {
  it("defines modelGroup schema", () => {
    expect(SCHEMAS.modelGroup).toBeDefined();
    expect(SCHEMAS.modelGroup.provider).toBe("string");
    expect(SCHEMAS.modelGroup.extraEnv).toBe("object");
  });

  it("defines project schema", () => {
    expect(SCHEMAS.project.path).toBe("string");
    expect(SCHEMAS.project.tool).toBe("string");
  });
});

describe("createDefaultConfig", () => {
  it("returns config with version 2", () => {
    const cfg = createDefaultConfig();
    expect(cfg.version).toBe(2);
    expect(cfg.createdAt).toBeDefined();
  });

  it("merges overrides", () => {
    const cfg = createDefaultConfig({ defaultTool: "claude" });
    expect(cfg.defaultTool).toBe("claude");
    expect(cfg.version).toBe(2);
  });
});
