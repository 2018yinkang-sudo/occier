import { readFileSync, existsSync } from "fs";

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

// Translate a Windows path (C:\Users\x) to its WSL mount path (/mnt/c/Users/x).
export function winPathToWsl(winPath) {
  if (!winPath) return null;
  const m = winPath.replace(/\\/g, "/").match(/^([A-Za-z]):\/(.+)$/);
  if (!m) return null;
  return `/mnt/${m[1].toLowerCase()}/${m[2]}`;
}

export function detectWslNetworkMode() {
  if (!isWSL()) return null;
  try {
    const content = readFileSync("/etc/wsl.conf", "utf-8");
    const match = content.match(/networkingMode\s*=\s*(\w+)/);
    if (match) return match[1];
  } catch { /* cannot read wsl.conf */ }
  try {
    const winHome = winPathToWsl(process.env.USERPROFILE);
    if (winHome) {
      const p = `${winHome}/.wslconfig`;
      if (existsSync(p)) {
        const content = readFileSync(p, "utf-8");
        const match = content.match(/networkingMode\s*=\s*(\w+)/);
        if (match) return match[1];
      }
    }
  } catch { /* cannot read .wslconfig */ }
  // No .wslconfig — WSL defaults to NAT networking.
  return "nat";
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
