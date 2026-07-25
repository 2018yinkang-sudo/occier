import { readFile, writeFile, mkdir, access } from 'fs/promises';
import { constants } from 'fs';
import { CC_CONFIG_DIR, ENV_FILE, CONFIG_FILE } from './paths.mjs';

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
  try {
    await access(ENV_FILE, constants.R_OK);
    const raw = await readFile(ENV_FILE, 'utf-8');
    const entries = {};
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      entries[key] = val;
    }
    return entries;
  } catch {
    return {};
  }
}

export async function writeProvidersEnv(entries) {
  await ensureConfigDir();
  const lines = [
    '# Claude Code provider credentials',
    '# Managed by ociier',
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
