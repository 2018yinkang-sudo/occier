import { describe, it, expect, vi } from "vitest";

vi.mock("@inquirer/prompts", () => ({
  select: vi.fn(() => "anthropic"),
  password: vi.fn(() => "sk-test-key-1234"),
}));

describe("v2 command imports", () => {
  it("launch.mjs imports correctly", async () => {
    const m = await import("./launch.mjs");
    expect(m.runLaunch).toBeDefined();
  });

  it("init.mjs imports correctly", async () => {
    const m = await import("./init.mjs");
    expect(m.runInit).toBeDefined();
  });

  it("vault.mjs imports correctly", async () => {
    const m = await import("./vault.mjs");
    expect(m.vaultList).toBeDefined();
    expect(m.vaultSet).toBeDefined();
    expect(m.vaultRemove).toBeDefined();
  });

  it("tools.mjs imports correctly", async () => {
    const m = await import("./tools.mjs");
    expect(m.installTool).toBeDefined();
    expect(m.updateTool).toBeDefined();
  });

  it("provider.mjs imports correctly", async () => {
    const m = await import("./provider.mjs");
    expect(m.providerList).toBeDefined();
    expect(m.providerConnect).toBeDefined();
    expect(m.providerTest).toBeDefined();
  });

  it("group.mjs imports correctly", async () => {
    const m = await import("./group.mjs");
    expect(m.groupList).toBeDefined();
    expect(m.groupUse).toBeDefined();
    expect(m.modelList).toBeDefined();
  });

  it("doctor.mjs imports correctly", async () => {
    const m = await import("./doctor.mjs");
    expect(m.runDoctor).toBeDefined();
  });

  it("project.mjs imports correctly", async () => {
    const m = await import("./project.mjs");
    expect(m.projectCreate).toBeDefined();
    expect(m.projectOpen).toBeDefined();
  });

  it("network.mjs imports correctly", async () => {
    const m = await import("./network.mjs");
    expect(m.showNetworkStatus).toBeDefined();
    expect(m.configureNetwork).toBeDefined();
  });
});
