import { runString } from "../exec/runner.mjs";

export async function getToolStatus() {
  const [claude, opencode, gh] = await Promise.all([
    checkTool("claude", "--version"),
    checkTool("opencode", "--version"),
    checkGhAuth(),
  ]);

  return { claude, opencode, gh };
}

async function checkTool(cmd, arg) {
  const r = await runString(cmd, [arg], { timeout: 5000 }).catch(() => null);
  if (!r || r.exitCode !== 0) return { installed: false, version: null };
  return { installed: true, version: r.stdout || "installed" };
}

async function checkGhAuth() {
  const r = await runString("gh", ["auth", "status"], { timeout: 5000 }).catch(() => null);
  if (!r) return { installed: false, loggedIn: false };
  return { installed: true, loggedIn: r.exitCode === 0 };
}

export async function installTool(tool) {
  if (tool === "claude") {
    const { installClaude } = await import("../tools/claude/install.mjs");
    return await installClaude();
  }
  if (tool === "opencode") {
    const { installOpenCode } = await import("../tools/opencode/install.mjs");
    return await installOpenCode();
  }
  return { installed: false, error: `Unknown tool: ${tool}` };
}

export async function updateTool(tool) {
  if (tool === "claude") {
    const { updateClaude } = await import("../tools/claude/install.mjs");
    return await updateClaude();
  }
  if (tool === "opencode") {
    const { updateOpenCode } = await import("../tools/opencode/install.mjs");
    return await updateOpenCode();
  }
  return { error: `Unknown tool: ${tool}` };
}
