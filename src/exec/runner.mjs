import { spawn } from "child_process";

const SENSITIVE_PATTERNS = [
  /(?:api[_-]?key|auth[_-]?token|password|secret)\s*[:=]\s*['"]?[^'"\s]+['"]?/gi,
  /"password"\s*:\s*"[^"]+"/gi,
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
  return run("which", [cmd], { timeout: 3000 }).then(
    (r) => r.exitCode === 0,
  );
}
