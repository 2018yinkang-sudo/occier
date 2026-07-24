import { homedir } from 'os';
import { join } from 'path';
import { accessSync, R_OK } from 'fs';

export const HOME = homedir();
export const XDG_CONFIG_HOME = process.env.XDG_CONFIG_HOME || join(HOME, '.config');
export const CC_CONFIG_DIR = join(XDG_CONFIG_HOME, 'claude-code');
export const ENV_FILE = join(CC_CONFIG_DIR, 'providers.env');
export const CONFIG_FILE = join(CC_CONFIG_DIR, 'config.json');

export function shellRcPath() {
  const candidates = [
    join(HOME, '.bashrc'),
    join(HOME, '.zshrc'),
    join(HOME, '.profile'),
  ];
  for (const p of candidates) {
    try {
      accessSync(p, R_OK);
      return p;
    } catch { /* file not found, skip */ }
  }
  return join(HOME, '.bashrc');
}
