#!/usr/bin/env node

import { homedir } from 'os';
import { join } from 'path';

async function checkPath() {
  const HOME = homedir();
  const binDir = join(HOME, '.local', 'bin');
  if (!process.env.PATH.split(':').includes(binDir)) {
    process.stderr.write('\n');
    process.stderr.write('  \x1b[33m⚠\x1b[0m  PATH does not include \x1b[90m~/.local/bin\x1b[0m.\n');
    process.stderr.write('  \x1b[33m⚠\x1b[0m  The \x1b[36moccier\x1b[0m command may not be found in new terminals.\n');
    process.stderr.write('  \x1b[33m⚠\x1b[0m  Run: \x1b[36moccier fix-path\x1b[0m to auto-configure.\n');
    process.stderr.write('\n');
  }
}

async function main() {
  checkPath().catch(() => {});
  const { route } = await import('../src/cli.mjs');
  const args = process.argv.slice(2);
  await route(args);
}

main().catch((err) => {
  if (err.code === 'ERR_MODULE_NOT_FOUND') {
    process.stderr.write('\n\x1b[31mError:\x1b[0m Dependencies not installed.\n');
    process.stderr.write('Run: \x1b[36mnpm install\x1b[0m\n\n');
    process.exit(1);
  }
  process.stderr.write(`\n\x1b[31mError:\x1b[0m ${err.message}\n\n`);
  process.exit(1);
});
