import { c, banner } from './tui.mjs';

const HELP = `
  ${c.boldCyan('occier')} ${c.gray('— Claude Code multi-provider CLI')}

  ${c.boldWhite('Usage:')}
    ${c.cyan('occier')}                     Interactive provider selection
    ${c.cyan('occier')} ${c.gray('<provider>')}          Direct launch (deepseek|kimi|anthropic)
    ${c.cyan('occier')} ${c.gray('<command>')}           Run a command

  ${c.boldWhite('Commands:')}
    ${c.cyan('status')}                 Show current configuration
    ${c.cyan('health')}                 Run system & provider health checks
    ${c.cyan('config')}                 Run interactive setup wizard
    ${c.cyan('config set-key')}         Update a specific API key
    ${c.cyan('config reset')}           Reset all configuration
    ${c.cyan('config show')}            Show config file locations and keys
    ${c.cyan('remove')}                 Remove all configuration and cleanup
    ${c.cyan('--help, -h')}             Show this help
    ${c.cyan('--version, -v')}          Show version

  ${c.boldWhite('Providers:')}
    ${c.cyan('deepseek')}               Backend, architecture, debugging
    ${c.cyan('kimi')}                   Frontend, design, visual
    ${c.cyan('anthropic')}              Official Claude API / claude.ai login
`;

export async function route(args) {
  if (args.length === 0) {
    const { selectAndLaunch } = await import('./commands/select.mjs');
    await selectAndLaunch();
    return;
  }

  const cmd = args[0];

  if (cmd === '--help' || cmd === '-h') {
    console.log(HELP);
    return;
  }

  if (cmd === '--version' || cmd === '-v') {
    const pkg = await import('../package.json', { with: { type: 'json' } });
    console.log(`occier v${pkg.default.version}`);
    return;
  }

  if (cmd === 'deepseek' || cmd === 'kimi' || cmd === 'anthropic') {
    const { directLaunch } = await import('./commands/launch.mjs');
    await directLaunch(cmd);
    return;
  }

  if (cmd === 'status') {
    const { showStatus } = await import('./commands/status.mjs');
    await showStatus();
    return;
  }

  if (cmd === 'health') {
    const { runHealthCheck } = await import('./commands/health.mjs');
    await runHealthCheck();
    return;
  }

  if (cmd === 'config') {
    const subcmd = args[1];
    if (subcmd === 'set-key') {
      const { setKey } = await import('./commands/setup-wizard.mjs');
      await setKey();
      return;
    }
    if (subcmd === 'reset') {
      const { resetConfig } = await import('./commands/setup-wizard.mjs');
      await resetConfig();
      return;
    }
    if (subcmd === 'show') {
      const { showConfig } = await import('./commands/setup-wizard.mjs');
      await showConfig();
      return;
    }
    const { runSetup } = await import('./commands/setup-wizard.mjs');
    await runSetup();
    return;
  }

  if (cmd === 'remove') {
    const { runRemove } = await import('./commands/remove.mjs');
    await runRemove();
    return;
  }

  console.error(`\n  ${c.red('Unknown command:')} ${cmd}`);
  console.error(`  Run ${c.cyan('occier --help')} for usage.\n`);
  process.exit(1);
}
