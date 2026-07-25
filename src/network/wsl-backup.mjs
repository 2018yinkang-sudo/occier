import { readFileSync } from "fs";
import { writeFile, copyFile } from "fs/promises";
import { runString } from "../exec/runner.mjs";
import { winPathToWsl } from "./wsl.mjs";

function wslConfigPath() {
  const winHome = winPathToWsl(process.env.USERPROFILE);
  return winHome ? `${winHome}/.wslconfig` : null;
}

export function readWindowsWslConfig() {
  const p = wslConfigPath();
  if (!p) return null;
  try {
    return { path: p, content: readFileSync(p, "utf-8") };
  } catch { return null; }
}

export function buildRecommendedWslConfig(networkingMode = "mirrored", autoProxy = true, dnsTunneling = true, experimental = true) {
  return [
    "[wsl2]",
    `networkingMode=${networkingMode}`,
    `autoProxy=${autoProxy}`,
    `dnsTunneling=${dnsTunneling}`,
    ...(experimental ? [`[experimental]`, `autoMemoryReclaim=gradual`] : []),
    "",
  ].join("\n");
}

export async function diffWslConfig(current, recommended) {
  if (!current) return { hasDiff: true, lines: [{ type: "add", text: recommended }] };

  // diff(1) needs two file operands — write both sides to temp files.
  const { writeFile, rm } = await import("fs/promises");
  const { join } = await import("path");
  const { tmpdir } = await import("os");
  const tmpA = join(tmpdir(), `occier-wsldiff-a-${process.pid}`);
  const tmpB = join(tmpdir(), `occier-wsldiff-b-${process.pid}`);
  try {
    await writeFile(tmpA, current, { mode: 0o600 });
    await writeFile(tmpB, recommended, { mode: 0o600 });
    const r = await runString("diff", ["-u", "--label", "current", "--label", "recommended", tmpA, tmpB], {
      timeout: 5000,
    });
    const lines = r.stdout ? r.stdout.split("\n") : [];
    return { hasDiff: current.trim() !== recommended.trim(), lines };
  } finally {
    await rm(tmpA, { force: true }).catch(() => {});
    await rm(tmpB, { force: true }).catch(() => {});
  }
}

export async function safeWriteWslConfig(content) {
  const result = { written: false, backupPath: null, needsRestart: false };

  const targetPath = wslConfigPath();
  const current = readWindowsWslConfig();
  if (current) {
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    result.backupPath = `${current.path}.bak.${ts}`;
    await copyFile(current.path, result.backupPath).catch(() => null);
  }

  if (targetPath) {
    await writeFile(targetPath, content, { mode: 0o600 });
    result.written = true;
    result.needsRestart = true;
  }

  return result;
}

export async function rollbackWslConfig(backupPath) {
  try {
    const targetPath = wslConfigPath();
    if (targetPath) {
      await copyFile(backupPath, targetPath);
      return true;
    }
  } catch { /* rollback failed */ }
  return false;
}

export async function checkWslNeedsRestart() {
  try {
    const r = await runString("wsl.exe", ["--status"], { timeout: 5000 });
    return r.exitCode === 0;
  } catch { return false; }
}
