import { readFile, writeFile, copyFile, mkdir, access, rm } from "fs/promises";
import { constants } from "fs";
import { join } from "path";
import { homedir, tmpdir } from "os";
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

  // diff(1) needs two file operands — stdin alone is not a file.
  // Write both sides to temp files, diff them, then clean up.
  const label = templateId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const tmpA = join(tmpdir(), `occier-diff-a-${process.pid}`);
  const tmpB = join(tmpdir(), `occier-diff-b-${process.pid}`);
  try {
    await writeFile(tmpA, currentContent, { mode: 0o600 });
    await writeFile(tmpB, t.content, { mode: 0o600 });
    const r = await runString("diff", ["-u", "--label", "current", "--label", label, tmpA, tmpB], {
      timeout: 5000,
    });
    const lines = r.stdout ? r.stdout.split("\n") : [];
    return { hasDiff: currentContent.trim() !== t.content.trim(), lines };
  } finally {
    await rm(tmpA, { force: true }).catch(() => {});
    await rm(tmpB, { force: true }).catch(() => {});
  }
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
