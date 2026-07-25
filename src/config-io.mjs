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
  // (original-case keys). The env file wins on conflicts.
  try {
    const { createStore } = await import('./store/credential-store.mjs');
    const store = createStore();
    const vault = await store.readAll();
    for (const [key, entry] of Object.entries(vault)) {
      const upper = key.toUpperCase();
      if (!(upper in entries) && entry && typeof entry.value === 'string') {
        entries[upper] = entry.value;
      }
    }
  } catch {
    // vault unreadable (corrupt or key mismatch) — v1 file data still valid
  }

  return entries;
}

export async function writeProvidersEnv(entries) {
  await ensureConfigDir();
  const lines = [
    '# Claude Code provider credentials',
    '# Managed by occier',
    '# Never commit this file.',
    '# Permissions: 600',
    '',
  ];
  for (const [key, val] of Object.entries(entries)) {
    lines.push(`${key}="${val}"`);
  }
  lines.push('');
  await writeFile(ENV_FILE, lines.join('\n'), { mode: 0o600 });
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
