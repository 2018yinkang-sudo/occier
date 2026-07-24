import { c } from './tui.mjs';

const HELP = `
  ${c.boldCyan('occier')} ${c.gray('— AI Dev Environment Manager (v2)')}

  ${c.boldWhite('Usage:')}
    ${c.cyan('occier')}                     Open interactive dashboard
    ${c.cyan('occier')} ${c.gray('<command>')}           Run a command

  ${c.boldWhite('V2 Commands:')}
    ${c.cyan('init')}                   First-time setup wizard
    ${c.cyan('doctor')}                 System diagnostics & repair
    ${c.cyan('status')}                 Show environment status
    ${c.cyan('network status')}         Show network configuration
    ${c.cyan('network configure')}      Configure proxy & mirrors
    ${c.cyan('network test')}           Test connectivity & latency
    ${c.cyan('vault list')}             List stored credentials
    ${c.cyan('vault set')}              Store a credential
    ${c.cyan('vault remove')}           Remove a credential
    ${c.cyan('provider list')}          List available providers
    ${c.cyan('provider connect')}       Configure a provider
    ${c.cyan('provider test')}          Test provider connectivity
    ${c.cyan('tool install')}           Install claude/opencode
    ${c.cyan('tool update')}            Update claude/opencode
    ${c.cyan('project create')}         Create a new project
    ${c.cyan('project open')}           Open an existing project
    ${c.cyan('launch')}                 Launch tool for project

  ${c.boldWhite('Legacy Commands:')}
    ${c.cyan('health')}                 Run system & provider health checks
    ${c.cyan('config')}                 Run interactive setup wizard
    ${c.cyan('config set-key')}         Update a specific API key
    ${c.cyan('config reset')}           Reset all configuration
    ${c.cyan('config show')}            Show config file locations and keys
    ${c.cyan('fix-path')}               Auto-configure PATH for new terminals
    ${c.cyan('remove')}                 Remove all configuration and cleanup
    ${c.cyan('<provider>')}             Direct launch (deepseek|kimi|anthropic)

  ${c.boldWhite('Options:')}
    ${c.cyan('--help, -h')}             Show this help
    ${c.cyan('--version, -v')}          Show version
`;

export async function route(args) {
  if (args.length === 0) {
    const { detectAll } = await import('./env/detect.mjs');
    const env = await detectAll();
    if (env.os === 'wsl' && env.wslNetworkMode !== 'mirrored') {
      console.log(`\n  ${c.yellow('!')} WSL mirrored networking not detected. Run ${c.cyan('occier network configure')}.\n`);
    }
    if (!env.claude.installed && !env.opencode.installed) {
      console.log(`\n  ${c.yellow('!')} No AI tools installed. Run ${c.cyan('occier init')} to set up.\n`);
    }
    console.log(`  ${c.boldWhite('occier v2 — AI Dev Environment Manager')}`);
    console.log(`  ${c.gray('Run')} ${c.cyan('occier --help')} ${c.gray('for commands.')}\n`);
    const { detectCapabilities } = await import('./env/detect.mjs');
    const status = await detectCapabilities();
    console.log(`  ${c.boldCyan('System Status')}`);
    console.log(`    OS:      ${status.os}${status.isWSL ? ` (WSL${status.wslVersion})` : ''}`);
    console.log(`    Shell:   ${status.shell}`);
    console.log(`    Node:    ${status.node.version || c.red('not found')}`);
    console.log(`    Claude:  ${status.claude.installed ? c.green(status.claude.version || 'installed') : c.gray('not installed')}`);
    console.log(`    OpenCode:${status.opencode.installed ? c.green(status.opencode.version || 'installed') : c.gray('not installed')}`);
    console.log(`    Git:     ${status.git.installed ? c.green(status.git.version || '') : c.gray('not found')}`);
    console.log(`    GitHub:  ${status.gh.loggedIn ? c.green('logged in') : c.yellow('not logged in')}`);
    console.log(``);
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

  if (cmd === 'init') {
    const { runInit } = await import('./commands/v2/init.mjs');
    await runInit();
    return;
  }

  if (cmd === 'doctor') {
    const { runDoctor } = await import('./commands/v2/doctor.mjs');
    await runDoctor();
    return;
  }

  if (cmd === 'status') {
    const { showStatus } = await import('./commands/status.mjs');
    await showStatus();
    return;
  }

  if (cmd === 'network') {
    const sub = args[1] || '';
    if (sub === 'configure') {
      const { configureNetwork } = await import('./commands/v2/network.mjs');
      await configureNetwork();
    } else if (sub === 'test') {
      const { testNetwork } = await import('./commands/v2/network.mjs');
      await testNetwork();
    } else {
      const { showNetworkStatus } = await import('./commands/v2/network.mjs');
      await showNetworkStatus();
    }
    return;
  }

  if (cmd === 'vault') {
    const sub = args[1] || '';
    if (sub === 'set') {
      const { vaultSet } = await import('./commands/v2/vault.mjs');
      await vaultSet();
    } else if (sub === 'remove') {
      const { vaultRemove } = await import('./commands/v2/vault.mjs');
      await vaultRemove();
    } else {
      const { vaultList } = await import('./commands/v2/vault.mjs');
      await vaultList();
    }
    return;
  }

  if (cmd === 'provider') {
    const sub = args[1] || '';
    if (sub === 'connect') {
      const { providerConnect } = await import('./commands/v2/provider.mjs');
      await providerConnect();
    } else if (sub === 'test') {
      const { providerTest } = await import('./commands/v2/provider.mjs');
      await providerTest();
    } else {
      const { providerList } = await import('./commands/v2/provider.mjs');
      await providerList();
    }
    return;
  }

  if (cmd === 'tool') {
    const sub = args[1] || '';
    if (sub === 'install') {
      const { installTool } = await import('./commands/v2/tools.mjs');
      const tool = args[2] || '';
      await installTool(tool);
    } else if (sub === 'update') {
      const { updateTool } = await import('./commands/v2/tools.mjs');
      const tool = args[2] || '';
      await updateTool(tool);
    } else {
      console.log(`  ${c.yellow('Usage:')} occier tool install|update <claude|opencode>`);
    }
    return;
  }

  if (cmd === 'project') {
    const sub = args[1] || '';
    if (sub === 'create') {
      const { projectCreate } = await import('./commands/v2/project.mjs');
      await projectCreate();
    } else if (sub === 'open') {
      const { projectOpen } = await import('./commands/v2/project.mjs');
      await projectOpen();
    } else {
      console.log(`  ${c.yellow('Usage:')} occier project create|open`);
    }
    return;
  }

  if (cmd === 'launch') {
    const { runLaunch } = await import('./commands/v2/launch.mjs');
    const rest = args.slice(1);
    await runLaunch(rest);
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

  if (cmd === 'fix-path') {
    const { fixPath } = await import('./commands/fix-path.mjs');
    await fixPath();
    return;
  }

  console.error(`\n  ${c.red('Unknown command:')} ${cmd}`);
  console.error(`  Run ${c.cyan('occier --help')} for usage.\n`);
  process.exit(1);
}
