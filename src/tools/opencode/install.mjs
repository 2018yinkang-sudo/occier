import { hasCommand, runString } from "../../exec/runner.mjs";

export async function detectOpenCode() {
  const installed = await hasCommand("opencode");
  if (!installed) return { installed: false };

  const r = await runString("opencode", ["--version"], { timeout: 5000 });
  return {
    installed: true,
    version: r.exitCode === 0 ? r.stdout.trim() || "unknown" : "unknown",
  };
}

export async function installOpenCode() {
  const detected = await detectOpenCode();
  if (detected.installed) return detected;

  console.log("  OpenCode can be installed via npm: npm install -g @opencode-ai/cli");
  console.log("  Or via the official installer at https://opencode.ai/install");

  const r = await runString("npm", ["install", "-g", "@opencode-ai/cli"], { timeout: 120000 });
  return {
    installed: r.exitCode === 0,
    version: r.exitCode === 0 ? "latest" : null,
    error: r.exitCode !== 0 ? r.stderr + r.stdout : null,
  };
}

export async function updateOpenCode() {
  const detected = await detectOpenCode();
  if (!detected.installed) return { installed: false };

  const r = await runString("npm", ["update", "-g", "@opencode-ai/cli"], { timeout: 120000 });
  return {
    installed: true,
    version: r.exitCode === 0 ? "updated" : "current",
    error: r.exitCode !== 0 ? r.stderr : null,
  };
}
