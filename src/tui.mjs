export const c = {
  reset: '\x1b[0m',
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  gray: (s) => `\x1b[90m${s}\x1b[0m`,
  boldCyan: (s) => `\x1b[1;36m${s}\x1b[0m`,
  boldWhite: (s) => `\x1b[1;37m${s}\x1b[0m`,
};

export function header(text) {
  const line = '─'.repeat(46);
  console.log('');
  console.log(`  ${c.boldCyan(line)}`);
  console.log(`  ${c.boldCyan(text)}`);
  console.log(`  ${c.boldCyan(line)}`);
  console.log('');
}

export function section(text) {
  console.log(`\n  ${c.cyan('──')} ${c.boldWhite(text)}\n`);
}

export function ok(text) {
  console.log(`    ${c.green('✓')} ${text}`);
}

export function warn(text) {
  console.log(`    ${c.yellow('!')} ${text}`);
}

export function fail(text) {
  console.log(`    ${c.red('✗')} ${text}`);
}

export function info(text) {
  console.log(`    ${c.gray(text)}`);
}

export function divider() {
  console.log(`  ${c.dim('─'.repeat(46))}`);
}

export function banner() {
  console.log('');
  console.log(`  ${c.boldCyan('╔══════════════════════════════════╗')}`);
  console.log(`  ${c.boldCyan('║')}       ${c.boldWhite('occier')} ${c.gray('— Claude Code CLI')}    ${c.boldCyan('║')}`);
  console.log(`  ${c.boldCyan('╚══════════════════════════════════╝')}`);
  console.log('');
}
