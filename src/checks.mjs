import { execFile } from 'child_process';
import { stat, access } from 'fs/promises';
import { R_OK } from 'fs';

import { ENV_FILE, CC_CONFIG_DIR, HOME } from './paths.mjs';
import { readProvidersEnv, configExists } from './config-io.mjs';
import { allProviders } from './providers/registry.mjs';

export async function checkClaudeInstalled() {
  return new Promise((resolve) => {
    const child = execFile('claude', ['--version'], { timeout: 5000 });
    let stdout = '';
    child.stdout?.on('data', d => stdout += d);
    child.on('close', (code) => resolve({ pass: code === 0, detail: stdout.trim() || 'installed' }));
    child.on('error', () => resolve({ pass: false, detail: 'not found' }));
  });
}

export async function checkProvidersEnv() {
  const entries = await readProvidersEnv();
  const providers = allProviders();
  const results = {};
  for (const p of providers) {
    const val = entries[p.envVar];
    results[p.id] = {
      pass: !!val && val.length > 4 && !val.includes('replace_with_your'),
      detail: val ? 'key set' : 'key not set',
    };
  }
  return results;
}

export async function checkConfigExists() {
  const exists = await configExists();
  return { pass: exists, detail: exists ? 'exists' : 'not created' };
}

export async function checkEnvFilePerms() {
  try {
    const s = await stat(ENV_FILE);
    const mode = (s.mode & 0o777).toString(8);
    return { pass: mode === '600', detail: mode };
  } catch {
    return { pass: null, detail: 'file not found' };
  }
}

export async function checkConfigDirPerms() {
  try {
    const s = await stat(CC_CONFIG_DIR);
    const mode = (s.mode & 0o777).toString(8);
    return { pass: mode === '700', detail: mode };
  } catch {
    return { pass: null, detail: 'directory not found' };
  }
}

export async function checkProviderConnectivity(providerId) {
  const { getProvider } = await import('./providers/registry.mjs');
  const p = getProvider(providerId);
  if (!p.healthUrl) return { pass: null, detail: 'N/A (uses claude.ai login)' };

  return new Promise((resolve) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
      resolve({ pass: false, detail: `timeout` });
    }, 5000);

    fetch(p.healthUrl, {
      method: 'HEAD',
      signal: controller.signal,
    }).then(res => {
      clearTimeout(timeout);
      resolve({ pass: res.status !== 401 && res.status !== 403, detail: `HTTP ${res.status}` });
    }).catch(err => {
      clearTimeout(timeout);
      resolve({ pass: false, detail: err.message });
    });
  });
}

export async function checkShellRcPath() {
  const candidates = ['.bashrc', '.zshrc', '.profile'];
  const found = [];
  for (const name of candidates) {
    try {
      const { join } = await import('path');
      const p = join(HOME, name);
      await access(p, R_OK);
      found.push(p);
    } catch {}
  }
  return { pass: found.length > 0, detail: found.map(p => p.split('/').pop()).join(', ') || 'none' };
}
