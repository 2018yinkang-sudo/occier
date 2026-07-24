#!/usr/bin/env node

async function main() {
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
