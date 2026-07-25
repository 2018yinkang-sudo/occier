import { readFile, writeFile, mkdir, access } from 'fs/promises';
import { constants } from 'fs';
import { CC_CONFIG_DIR, ENV_FILE, CONFIG_FILE } from './paths.mjs';
import { parseEnvContent } from './store/credential-store.mjs';

const DEFAULT_CONFIG = {
  version: 1,
  providers: [],
  preferences: {
    defaultProvider: null,
  },
  installedAt: null,
};

async function ensureConfigDir() {
  await mkdir(CC_CONFIG_DIR, { recursive: true, mode: 0o700 });
}

export async function readConfig() {
  try {
    await access(CONFIG_FILE, constants.R_OK);
    const raw = await readFile(CONFIG_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function writeConfig(config) {
  await ensureConfigDir();
  config.updatedAt = new Date().toISOString();
  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
}

export async function readProvidersEnv() {
  const entries = {};

  // Parse legacy env file using shared parser
  try {
    await access(ENV_FILE, constants.R_OK);
    const raw = await readFile(ENV_FILE, 'utf-8');
    const parsed = parseEnvContent(raw);
    for (const [key, entry] of Object.entries(parsed)) {
      entries[key.toUpperCase()] = entry.value;
    }
  } catch {
    // no legacy env file — fall through to vault merge
  }

  // Bridge: surface v2 vault credentials (lowercase keys) to v1 consumers
  // (original-case keys). Only read provider-specific keys, not the entire vault.
  try {
    const { createStore } = await import('./store/credential-store.mjs');
    const { allProviders } = await import('./registry/providers.mjs');
    const store = createStore();
    for (const p of allProviders()) {
      const lowerKey = p.envVarName.toLowerCase();
      if (!(p.envVarName in entries)) {
        const data = await store.get(lowerKey);
        if (data && typeof data.value === 'string') {
          entries[p.envVarName] = data.value;
        }
      }
    }
  } catch {
    // vault unreadable (corrupt or key mismatch) — v1 file data still valid
  }

  return entries;
}

export async function providersEnvExists() {
  try {
    await access(ENV_FILE, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

export async function configExists() {
  try {
    await access(CONFIG_FILE, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

export { maskValue as maskKey } from './store/credential-store.mjs';
