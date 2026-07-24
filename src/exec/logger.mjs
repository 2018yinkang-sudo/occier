import { writeFile, mkdir, access } from "fs/promises";
import { constants } from "fs";
import { join } from "path";
import { homedir } from "os";

const LOG_DIR = join(
  process.env.XDG_CONFIG_HOME || join(homedir(), ".config"),
  "occier",
  "logs",
);

let _sessionId = Date.now().toString(36);

export async function ensureLogDir() {
  await mkdir(LOG_DIR, { recursive: true, mode: 0o700 });
}

export function sanitizeLog(text) {
  return String(text ?? "")
    .replace(/(api[_-]?key|auth[_-]?token|password|secret)\s*[:=]\s*['"]?[^'"\s]+['"]?/gi, "$1=***")
    .replace(/Authorization:\s*Bearer\s+\S+/gi, "Authorization: Bearer ***")
    .replace(/Bearer\s+\S{10,}/g, "Bearer ***");
}

export async function log(level, message, data = null) {
  await ensureLogDir();
  const ts = new Date().toISOString();
  const line = `[${ts}] [${level.padEnd(5)}] [${_sessionId}] ${sanitizeLog(message)}`;
  const file = join(LOG_DIR, `${new Date().toISOString().slice(0, 10)}.log`);

  try {
    await access(file, constants.R_OK);
  } catch {
    await writeFile(file, `# occier log - ${ts.slice(0, 10)}\n# level: debug|info|warn|error\n# format: [timestamp] [level] [session] message\n\n`, { mode: 0o600 });
  }

  await writeFile(file, line + (data ? " " + JSON.stringify(sanitizeLog(JSON.stringify(data))) : "") + "\n", { flag: "a" });

  if (level === "error") {
    process.stderr.write(`  ${sanitizeLog(message)}\n`);
  }
}

export async function debug(msg, data) { await log("DEBUG", msg, data); }
export async function info(msg, data) { await log("INFO", msg, data); }
export async function warn(msg, data) { await log("WARN", msg, data); }
export async function error(msg, data) { await log("ERROR", msg, data); }
