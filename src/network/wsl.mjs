import { readFileSync, existsSync } from "fs";
import { runString } from "../exec/runner.mjs";

export function detectWslVersion() {
  try {
    const content = readFileSync("/proc/version", "utf-8").toLowerCase();
    if (content.includes("wsl2")) return 2;
    if (content.includes("microsoft") || content.includes("wsl")) return 1;
    return null;
  } catch {
    return null;
  }
}

export function isWSL() {
  return detectWslVersion() !== null;
}

export function detectWslNetworkMode() {
  if (!isWSL()) return null;
  try {
    const content = readFileSync("/etc/wsl.conf", "utf-8");
    const match = content.match(/networkingMode\s*=\s*(\w+)/);
    if (match) return match[1];
  } catch { /* cannot read wsl.conf */ }
  try {
    const winHome = process.env.USERPROFILE;
    if (winHome) {
      const p = `${winHome.replace(/\\/g, "/")}/.wslconfig`;
      if (existsSync(p)) {
        const content = readFileSync(p, "utf-8");
        const match = content.match(/networkingMode\s*=\s*(\w+)/);
        if (match) return match[1];
      }
    }
  } catch { /* cannot read .wslconfig */ }
  return "nat";
}

export function getWslConfigPath() {
  const winHome = process.env.USERPROFILE;
  if (!winHome) return null;
  return `${winHome.replace(/\\/g, "/")}/.wslconfig`;
}

export function buildWslConfig(networkingMode = "mirrored", autoProxy = true, dnsTunneling = true) {
  const lines = [
    "[wsl2]",
    `networkingMode=${networkingMode}`,
    `autoProxy=${autoProxy}`,
    `dnsTunneling=${dnsTunneling}`,
    "",
  ];
  return lines.join("\n");
}

export async function wslNeedsRestart() {
  if (!isWSL()) return false;
  try {
    await runString("wsl.exe", ["--status"], { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}
