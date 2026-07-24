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

export function buildClaudeEnv(providerEnvVars) {
  const env = { ...process.env };

  const clearKeys = [
    "ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_BASE_URL",
    "ANTHROPIC_MODEL", "ANTHROPIC_DEFAULT_OPUS_MODEL", "ANTHROPIC_DEFAULT_SONNET_MODEL",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL", "ANTHROPIC_DEFAULT_FABLE_MODEL",
    "CLAUDE_CODE_SUBAGENT_MODEL", "CLAUDE_CODE_EFFORT_LEVEL",
    "CLAUDE_CODE_AUTO_COMPACT_WINDOW", "ENABLE_TOOL_SEARCH",
  ];

  for (const k of clearKeys) {
    delete env[k];
  }

  for (const [k, v] of Object.entries(providerEnvVars)) {
    if (v !== undefined && v !== null) {
      env[k] = v;
    }
  }

  return env;
}
