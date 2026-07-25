import { runString } from "../exec/runner.mjs";
import { createStore } from "../store/credential-store.mjs";

export async function getToolStatus() {
  const [claude, opencode, gh] = await Promise.all([
    checkTool("claude", "--version"),
    checkTool("opencode", "--version"),
    checkGhFromVault(),
  ]);

  return { claude, opencode, gh };
}

async function checkTool(cmd, arg) {
  const r = await runString(cmd, [arg], { timeout: 5000 }).catch(() => null);
  if (!r || r.exitCode !== 0) return { installed: false, version: null };
  return { installed: true, version: r.stdout || "installed" };
}

async function checkGhFromVault() {
  const r = await runString("gh", ["--version"], { timeout: 5000 }).catch(() => null);
  if (!r || r.exitCode !== 0) return { installed: false, loggedIn: false };
  // Check vault for a stored github_token instead of spawning `gh auth status`.
  const store = createStore();
  const data = await store.get("github_token");
  return { installed: true, loggedIn: !!(data && data.value) };
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
