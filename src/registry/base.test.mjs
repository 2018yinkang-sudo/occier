import { describe, it, expect } from "vitest";
import { Registry } from "./base.mjs";

describe("Registry", () => {
  it("registers and retrieves items", () => {
    const r = new Registry();
    r.register("a", { name: "Item A" });
    expect(r.get("a").name).toBe("Item A");
  });

  it("returns frozen items", () => {
    const r = new Registry();
    r.register("a", { name: "Item A" });
    const item = r.get("a");
    expect(Object.isFrozen(item)).toBe(true);
  });

  it("adds id to registered item", () => {
    const r = new Registry();
    r.register("test-id", { value: 42 });
    expect(r.get("test-id").id).toBe("test-id");
  });

  it("throws for duplicate registration", () => {
    const r = new Registry();
    r.register("a", {});
    expect(() => r.register("a", {})).toThrow("already registered");
  });

  it("throws for unknown item", () => {
    const r = new Registry();
    expect(() => r.get("nonexistent")).toThrow("Unknown item");
  });

  it("tryGet returns null for unknown item", () => {
    const r = new Registry();
    expect(r.tryGet("nonexistent")).toBeNull();
  });

  it("lists all registered items", () => {
    const r = new Registry();
    r.register("a", { v: 1 });
    r.register("b", { v: 2 });
    expect(r.list()).toHaveLength(2);
  });

  it("checks if item exists", () => {
    const r = new Registry();
    r.register("a", {});
    expect(r.has("a")).toBe(true);
    expect(r.has("b")).toBe(false);
  });

  it("clears all items", () => {
    const r = new Registry();
    r.register("a", {});
    r.clear();
    expect(r.size).toBe(0);
  });

  it("tracks size correctly", () => {
    const r = new Registry();
    expect(r.size).toBe(0);
    r.register("a", {});
    expect(r.size).toBe(1);
    r.register("b", {});
    expect(r.size).toBe(2);
  });
});
