import { readFile, writeFile, copyFile, mkdir, access } from "fs/promises";
import { constants } from "fs";
import { join } from "path";
import { homedir } from "os";
import { runString } from "../../exec/runner.mjs";
import { getTemplate } from "./templates.mjs";

const OC_BAK_DIR = join(
  process.env.XDG_CONFIG_HOME || join(homedir(), ".config"),
  "occier",
  "backups",
);

export async function ensureBackupDir() {
  await mkdir(OC_BAK_DIR, { recursive: true, mode: 0o700 });
}

export async function backupFile(targetPath) {
  await ensureBackupDir();
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const name = targetPath.replace(/\//g, "_").replace(/^_/, "");
  const backupPath = join(OC_BAK_DIR, `${name}.${ts}`);
  try {
    await copyFile(targetPath, backupPath);
    return backupPath;
  } catch {
    return null;
  }
}

export async function diffTemplate(templateId, targetPath) {
  const t = getTemplate(templateId);
  let currentContent = "";
  try {
    await access(targetPath, constants.R_OK);
    currentContent = await readFile(targetPath, "utf-8");
  } catch { /* file not found, empty content */ }

  if (!currentContent) return { hasDiff: true, lines: [{ type: "add", text: t.content }] };

  const label = templateId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const r = await runString("diff", ["-u", "--label", "current", "--label", label], {
    input: `${currentContent}\n${t.content}`,
    timeout: 5000,
  });
  const lines = r.stdout ? r.stdout.split("\n") : [];
  return { hasDiff: currentContent.trim() !== t.content.trim(), lines };
}

export async function safeApplyTemplate(templateId, targetPath, force = false) {
  const t = getTemplate(templateId);

  const exists = await access(targetPath, constants.R_OK).then(() => true).catch(() => false);

  if (exists) {
    const backupPath = await backupFile(targetPath);
    if (!force) {
      return { applied: false, existed: true, backupPath, needConfirm: true };
    }
  }

  await writeFile(targetPath, t.content);
  return { applied: true, existed: exists, backupPath: null, needConfirm: false };
}

export async function mergeTemplate(templateId, targetPath, strategy = "overwrite") {
  const t = getTemplate(templateId);

  if (strategy === "overwrite") {
    const bak = await backupFile(targetPath);
    await writeFile(targetPath, t.content);
    return { merged: true, strategy: "overwrite", backupPath: bak };
  }

  if (strategy === "prepend") {
    const bak = await backupFile(targetPath);
    let existing = "";
    try { existing = await readFile(targetPath, "utf-8"); } catch { /* no existing file */ }
    await writeFile(targetPath, t.content + "\n" + existing);
    return { merged: true, strategy: "prepend", backupPath: bak };
  }

  if (strategy === "append") {
    const bak = await backupFile(targetPath);
    let existing = "";
    try { existing = await readFile(targetPath, "utf-8"); } catch { /* no existing file */ }
    await writeFile(targetPath, existing + "\n" + t.content);
    return { merged: true, strategy: "append", backupPath: bak };
  }

  return { merged: false, error: `Unknown strategy: ${strategy}` };
}

export async function listBackups(targetPath) {
  await ensureBackupDir();
  const { readdir } = await import("fs/promises");
  try {
    const files = await readdir(OC_BAK_DIR);
    const namePrefix = targetPath.replace(/\//g, "_").replace(/^_/, "");
    return files
      .filter((f) => f.startsWith(namePrefix))
      .sort()
      .reverse();
  } catch { return []; }
}

export async function restoreFromBackup(backupName) {
  const backupPath = join(OC_BAK_DIR, backupName);
  try {
    const content = await readFile(backupPath, "utf-8");
    return content;
  } catch { return null; }
}
