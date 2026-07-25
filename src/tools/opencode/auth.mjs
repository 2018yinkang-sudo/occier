import { readFile, writeFile, access } from "fs/promises";
import { constants } from "fs";
import { join } from "path";
import { homedir } from "os";

const OC_DIR = join(
  process.env.XDG_CONFIG_HOME || join(homedir(), ".config"),
  "opencode",
);
const AUTH_FILE = join(OC_DIR, "auth.json");

export async function detectOpenCodeProviders() {
  try {
    await access(AUTH_FILE, constants.R_OK);
    const raw = await readFile(AUTH_FILE, "utf-8");
    const data = JSON.parse(raw);
    return Object.keys(data).filter((k) => data[k]?.key);
  } catch {
    return [];
  }
}

export async function syncToOpenCodeAuth(providerId, apiKey) {
  const { mkdir } = await import("fs/promises");
  await mkdir(OC_DIR, { recursive: true, mode: 0o700 });

  let data = {};
  try {
    await access(AUTH_FILE, constants.R_OK);
    data = JSON.parse(await readFile(AUTH_FILE, "utf-8"));
  } catch { /* file not found, use fresh object */ }

  data[providerId] = { type: "api", key: apiKey };
  await writeFile(AUTH_FILE, JSON.stringify(data, null, 2), { mode: 0o600 });
  return true;
}

export async function removeFromOpenCodeAuth(providerId) {
  try {
    await access(AUTH_FILE, constants.R_OK);
    const data = JSON.parse(await readFile(AUTH_FILE, "utf-8"));
    delete data[providerId];
    await writeFile(AUTH_FILE, JSON.stringify(data, null, 2), { mode: 0o600 });
  } catch { /* file not found, nothing to remove */ }
}
