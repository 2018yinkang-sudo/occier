import { readFile, writeFile, mkdir, access } from "fs/promises";
import { constants } from "fs";
import { homedir } from "os";
import { join } from "path";

const OC_DIR = join(
  process.env.XDG_CONFIG_HOME || join(homedir(), ".config"),
  "occier",
);

const CONFIG_FILE = join(OC_DIR, "config.json");

const DEFAULT_CONFIG = {
  version: 2,
  createdAt: null,
  updatedAt: null,
  defaultTool: null,
  defaultModelGroup: null,
  providerOrder: [],
  installedClaude: false,
  installedOpenCode: false,
  networkConfigured: false,
  vaultType: "file",
  telemetry: false,
};

export const SCHEMAS = {
  modelGroup: {
    id: "string",
    provider: "string",
    label: "string",
    description: "string",
    primary: "string",
    reasoning: "string",
    fast: "string",
    subagent: "string",
    extraEnv: "object",
  },
  project: {
    path: "string",
    name: "string",
    tool: "string",
    modelGroup: "string",
    template: "string",
    createdAt: "string",
    updatedAt: "string",
  },
  provider: {
    id: "string",
    label: "string",
    protocol: "string",
    baseURL: "string",
    authType: "string",
    healthUrl: "string",
  },
  networkProxy: {
    protocol: "string",
    host: "string",
    port: "number",
    username: "string",
    passwordRef: "string",
    scope: "string",
  },
  mirror: {
    id: "string",
    scope: "string",
    baseUrl: "string",
    region: "string",
    official: "boolean",
    enabled: "boolean",
  },
};

export async function readConfig() {
  try {
    await access(CONFIG_FILE, constants.R_OK);
    const raw = await readFile(CONFIG_FILE, "utf-8");
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function writeConfig(config) {
  await mkdir(OC_DIR, { recursive: true, mode: 0o700 });
  config.updatedAt = new Date().toISOString();
  if (!config.createdAt) config.createdAt = new Date().toISOString();
  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
}

export function createDefaultConfig(overrides = {}) {
  return { ...DEFAULT_CONFIG, ...overrides, createdAt: new Date().toISOString() };
}

export async function migrateV1() {
  const { join: pJoin } = await import("path");
  const v1Config = pJoin(
    process.env.XDG_CONFIG_HOME || join(homedir(), ".config"),
    "claude-code",
    "config.json",
  );

  try {
    await access(v1Config, constants.R_OK);
    const raw = await readFile(v1Config, "utf-8");
    const old = JSON.parse(raw);
    const v2 = createDefaultConfig({
      providerOrder: old.providers || [],
      installedClaude: true,
    });
    await writeConfig(v2);
    return true;
  } catch {
    return false;
  }
}
