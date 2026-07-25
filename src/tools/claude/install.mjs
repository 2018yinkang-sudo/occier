import { hasCommand, runString } from "../../exec/runner.mjs";

export async function detectClaude() {
  const installed = await hasCommand("claude");
  if (!installed) return { installed: false };

  const r = await runString("claude", ["--version"], { timeout: 5000 });
  return {
    installed: true,
    version: r.exitCode === 0 ? r.stdout.trim() || "unknown" : "unknown",
  };
}

export async function installClaude() {
  const detected = await detectClaude();
  if (detected.installed) return detected;

  console.log("  Installing Claude Code via npm...");
  const r = await runString("npm", ["install", "-g", "@anthropic-ai/claude-code"], { timeout: 120000 });
  return {
    installed: r.exitCode === 0,
    version: r.exitCode === 0 ? "latest" : null,
    error: r.exitCode !== 0 ? r.stderr : null,
  };
}

export async function updateClaude() {
  const detected = await detectClaude();
  if (!detected.installed) return { installed: false };

  const r = await runString("npm", ["update", "-g", "@anthropic-ai/claude-code"], { timeout: 120000 });
  return {
    installed: true,
    version: r.exitCode === 0 ? "updated" : "current",
    error: r.exitCode !== 0 ? r.stderr : null,
  };
}
