import { c, banner, ok, warn, fail, info, divider } from '../../tui.mjs';
import { writeConfig, createDefaultConfig, migrateV1 } from '../../schema/config.mjs';
import { detectAll } from '../../env/detect.mjs';

export async function runInit() {
  banner();
  console.log(`  ${c.boldWhite('Initial Setup')}`);
  console.log(``);

  await migrateV1();

  const env = await detectAll();
  console.log(`  ${c.boldCyan('Environment Scan')}`);
  console.log(`    OS:      ${env.os}${env.isWSL ? ` (WSL${env.wslVersion})` : ''}`);
  console.log(`    Shell:   ${env.shell}`);
  console.log(`    Node:    ${env.node.version || c.red('not found')}`);
  if (!env.node.installed) {
    fail('Node.js is required. Install Node.js >= 20 first.');
    process.exit(1);
  }
  ok(`Node.js ${env.node.version}`);

  const cfg = createDefaultConfig();
  await writeConfig(cfg);
  ok('Configuration initialized');

  if (env.isWSL && env.wslNetworkMode !== 'mirrored') {
    warn(`WSL network mode: ${env.wslNetworkMode}. Recommended: mirrored`);
    info('Run "occier network configure" to set up WSL networking');
  }

  if (!env.claude.installed) {
    warn('Claude Code not installed');
    info('Run "occier tool install claude" to install');
  } else {
    ok(`Claude Code ${env.claude.version || ''}`);
  }

  if (!env.opencode.installed) {
    warn('OpenCode not installed');
    info('Run "occier tool install opencode" to install');
  } else {
    ok(`OpenCode ${env.opencode.version || ''}`);
  }

  if (!env.gh.loggedIn) {
    warn('GitHub not logged in');
    info('Run "gh auth login" or configure GitHub via occier');
  } else {
    ok('GitHub CLI authenticated');
  }

  divider();
  console.log(`  ${c.green('✓')} Setup complete. Run ${c.cyan('occier')} to start.\n`);
}
