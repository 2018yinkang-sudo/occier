import { spawn } from "child_process";

const SENSITIVE_PATTERNS = [
  /(?:api[_-]?key|auth[_-]?token|password|secret|token)\s*[:=]\s*['"]?[^'"\s]+['"]?/gi,
  /["'](?:api[_-]?key|auth[_-]?token|password|secret|token)["']\s*:\s*"[^"]+"/gi,
  /Authorization:\s*Bearer\s+\S+/gi,
  /Bearer\s+\S{10,}/g,
];

export function sanitize(text) {
  let result = String(text ?? "");
  for (const pattern of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, (match) => {
      const eqIdx = match.indexOf("=");
      if (eqIdx === -1) {
        const colonIdx = match.indexOf(":");
        if (colonIdx === -1) return match;
        return match.slice(0, colonIdx + 1) + " ***";
      }
      return match.slice(0, eqIdx + 1) + "***";
    });
  }
  return result;
}

export function run(cmd, args = [], opts = {}) {
  const { timeout = 30000, env = process.env, cwd, input } = opts;

  return new Promise((resolve) => {
    const start = Date.now();
    const child = spawn(cmd, args, {
      env,
      cwd,
      stdio: input ? ["pipe", "pipe", "pipe"] : ["ignore", "pipe", "pipe"],
      timeout,
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (d) => { stdout += d; });
    child.stderr?.on("data", (d) => { stderr += d; });

    if (input && child.stdin) {
      child.stdin.write(input);
      child.stdin.end();
    }

    child.on("error", (err) => {
      resolve({
        exitCode: -1,
        stdout,
        stderr: err.message,
        duration: Date.now() - start,
        timedOut: false,
      });
    });

    child.on("exit", (code, signal) => {
      resolve({
        exitCode: code ?? (signal ? -2 : -1),
        stdout,
        stderr,
        duration: Date.now() - start,
        timedOut: signal === "SIGTERM",
      });
    });
  });
}

export function runString(cmd, args = [], opts = {}) {
  return run(cmd, args, opts).then((r) => ({
    ...r,
    stdout: r.stdout.toString().trimEnd(),
    stderr: r.stderr.toString().trimEnd(),
  }));
}

export function hasCommand(cmd) {
  if (process.platform === "win32") {
    return run("where", [cmd], { timeout: 3000 }).then(
      (r) => r.exitCode === 0,
    );
  }
  // `command -v` is a shell builtin — it must run inside a shell, not via spawn directly.
  return run("sh", ["-c", 'command -v "$1" >/dev/null 2>&1', "sh", cmd], {
    timeout: 3000,
  }).then((r) => r.exitCode === 0);
}

// Run a command with sudo, reading the system password from the vault.
// The password is injected via stdin pipe — NEVER as a command argument,
// never in env vars, never in log output.
// Throws if no sudo_password is stored in the vault.
export async function runWithSudo(cmd, args = [], opts = {}) {
  const { createStore } = await import("../store/credential-store.mjs");
  const store = createStore();
  const data = await store.get("sudo_password");
  if (!data?.value) {
    throw new Error(
      "sudo_password not found in vault. Store it with: occier vault set",
    );
  }

  const password = data.value;
  const { timeout = 30000, env = process.env, cwd } = opts;

  return new Promise((resolve) => {
    const start = Date.now();
    const child = spawn("sudo", ["-S", "--", cmd, ...args], {
      env,
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
      timeout,
    });

    let stdout = "";
    let stderr = "";

    // Write password to stdin and close immediately — sudo reads it once.
    child.stdin.write(password + "\n");
    child.stdin.end();

    child.stdout?.on("data", (d) => { stdout += d; });
    child.stderr?.on("data", (d) => { stderr += d; });

    child.on("error", (err) => {
      resolve({
        exitCode: -1,
        stdout,
        stderr: err.message,
        duration: Date.now() - start,
        timedOut: false,
      });
    });

    child.on("exit", (code, signal) => {
      resolve({
        exitCode: code ?? (signal ? -2 : -1),
        stdout,
        stderr,
        duration: Date.now() - start,
        timedOut: signal === "SIGTERM",
      });
    });
  });
}
