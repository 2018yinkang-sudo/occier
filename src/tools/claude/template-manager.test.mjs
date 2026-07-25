import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { diffTemplate, safeApplyTemplate, backupFile } from "./template-manager.mjs";

let tmpDir;

function setup() {
  tmpDir = mkdtempSync(join(tmpdir(), "occier-tpl-"));
  return join(tmpDir, "CLAUDE.md");
}

afterEach(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
  tmpDir = null;
});

describe("diffTemplate", () => {
  it("returns an empty diff when contents match", async () => {
    const target = setup();
    const { getTemplate } = await import("./templates.mjs");
    writeFileSync(target, getTemplate("minimal").content);
    const diff = await diffTemplate("minimal", target);
    expect(diff.hasDiff).toBe(false);
  });

  it("produces real diff output lines for differing content", async () => {
    const target = setup();
    writeFileSync(target, "# CLAUDE.md\n\ncompletely different content\n");
    const diff = await diffTemplate("founder-mvr", target);
    expect(diff.hasDiff).toBe(true);
    // Regression: diff used to be invoked without file operands and always
    // returned empty lines.
    expect(diff.lines.some((l) => l.startsWith("-"))).toBe(true);
    expect(diff.lines.some((l) => l.startsWith("+"))).toBe(true);
  });

  it("reports add-only diff for a missing target file", async () => {
    const target = join(mkdtempSync(join(tmpdir(), "occier-tpl-")), "nope.md");
    const diff = await diffTemplate("minimal", target);
    expect(diff.hasDiff).toBe(true);
    rmSync(join(target, ".."), { recursive: true, force: true });
  });
});

describe("safeApplyTemplate", () => {
  it("asks for confirmation and keeps a backup when file exists", async () => {
    const target = setup();
    writeFileSync(target, "existing content");
    const result = await safeApplyTemplate("minimal", target);
    expect(result.needConfirm).toBe(true);
    expect(result.backupPath).toBeTruthy();
    expect(readFileSync(target, "utf-8")).toBe("existing content");
  });

  it("applies with force=true", async () => {
    const target = setup();
    writeFileSync(target, "existing content");
    const result = await safeApplyTemplate("minimal", target, true);
    expect(result.applied).toBe(true);
    expect(readFileSync(target, "utf-8")).toContain("# CLAUDE.md");
  });
});

describe("backupFile", () => {
  it("copies the file into the backup dir", async () => {
    const target = setup();
    writeFileSync(target, "backup me");
    const backupPath = await backupFile(target);
    expect(backupPath).toBeTruthy();
    expect(existsSync(backupPath)).toBe(true);
    expect(readFileSync(backupPath, "utf-8")).toBe("backup me");
  });
});
