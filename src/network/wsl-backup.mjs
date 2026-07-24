import { readFileSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import { runString } from "../exec/runner.mjs";

export function detectWslVersion() {
  try {
    const content = readFileSync("/proc/version", "utf-8").toLowerCase();
    if (content.includes("wsl2")) return 2;
    if (content.includes("microsoft") || content.includes("wsl")) return 1;
    return null;
  } catch { return null; }
}

export function isWSL() {
  return detectWslVersion() !== null;
}

export function readWindowsWslConfig() {
  const winHome = process.env.USERPROFILE;
  if (!winHome) return null;
  const p = `${winHome.replace(/\\/g, "/")}/.wslconfig`;
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

  const r = await runString("diff", ["-u", "--label", "current", "--label", "recommended"], {
    input: `${current}\n${recommended}`,
    timeout: 5000,
  });
  const lines = r.stdout ? r.stdout.split("\n") : [];
  return { hasDiff: current.trim() !== recommended.trim(), lines };
}

export async function safeWriteWslConfig(content) {
  const result = { written: false, backupPath: null, needsRestart: false };

  const current = readWindowsWslConfig();
  if (current) {
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    result.backupPath = `${current.path}.bak.${ts}`;
    await writeFile(result.backupPath, current.content, { mode: 0o600 });
  }

  const targetPath = current?.path || (process.env.USERPROFILE
    ? `${process.env.USERPROFILE.replace(/\\/g, "/")}/.wslconfig`
    : null);

  if (targetPath) {
    await writeFile(targetPath, content, { mode: 0o600 });
    result.written = true;
    result.needsRestart = true;
  }

  return result;
}

export async function rollbackWslConfig(backupPath) {
  try {
    const content = await readFile(backupPath, "utf-8");
    const targetPath = process.env.USERPROFILE
      ? `${process.env.USERPROFILE.replace(/\\/g, "/")}/.wslconfig`
      : null;
    if (targetPath) {
      await writeFile(targetPath, content, { mode: 0o600 });
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
