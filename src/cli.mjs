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
    ${c.cyan('mirror list')}            List available mirrors
    ${c.cyan('mirror test')}            Test mirror latency
    ${c.cyan('mirror switch')}          Auto-switch to fastest mirror
    ${c.cyan('mirror restore')}         Restore official mirrors
    ${c.cyan('template list')}          List CLAUDE.md templates
    ${c.cyan('template preview <id>')}  Preview a template
    ${c.cyan('template apply <id>')}    Apply a template to project
    ${c.cyan('template diff <id>')}     Diff template against existing
    ${c.cyan('--help, -h')}             Show this help
    ${c.cyan('--version, -v')}          Show version
`;

export async function route(args) {
  if (args.length === 0) {
    const { detectAll } = await import('./env/detect.mjs');
    const env = await detectAll();

    console.log(`  ${c.boldCyan('╔══════════════════════════════════════════╗')}`);
    console.log(`  ${c.boldCyan('║')}      ${c.boldWhite('occier')} ${c.gray('v2 — AI Dev Environment Manager')}     ${c.boldCyan('║')}`);
    console.log(`  ${c.boldCyan('╚══════════════════════════════════════════╝')}`);
    console.log(``);

    const { select, Separator } = await import('@inquirer/prompts');
    const lines = [
      `  ${c.boldCyan('Dashboard')}`,
      ``,
      `    ${env.networkConfigured ? c.green('●') : c.yellow('○')} Network    ${env.isWSL ? `WSL ${env.wslNetworkMode || 'unknown'}` : 'direct'}  |  ${Object.keys(env.proxy).filter(k => env.proxy[k]).length > 0 ? 'proxy set' : 'no proxy'}`,
      `    ${(env.claude.installed || env.opencode.installed) ? c.green('●') : c.gray('○')} Prov.      ${env.claude.installed ? 'claude' : ''} ${env.opencode.installed ? '/ opencode' : ''}`,
      `    ${env.gh.loggedIn ? c.green('●') : c.gray('○')} GitHub     ${env.gh.loggedIn ? c.green('logged in') : c.gray('not logged in')}`,
      ``,
      `  ── ${c.boldWhite('Quick Actions')} ──`,
    ];

    for (const l of lines) console.log(l);

    const action = await select({
      message: '',
      choices: [
        { name: '  Init / Setup Wizard', value: 'init' },
        { name: '  Doctor (system check)', value: 'doctor' },
        { name: '  Network Config', value: 'network' },
        { name: '  Provider Config', value: 'provider' },
        { name: '  Launch Claude Code', value: 'launch' },
        new Separator(),
        { name: '  Quit', value: '_quit' },
      ],
    });

    console.log(``);
    if (action === 'init') { const { runInit } = await import('./commands/v2/init.mjs'); await runInit(); }
    else if (action === 'doctor') { const { runDoctor } = await import('./commands/v2/doctor.mjs'); await runDoctor(); }
    else if (action === 'network') { const { showNetworkStatus } = await import('./commands/v2/network.mjs'); await showNetworkStatus(); }
    else if (action === 'provider') { const { providerList } = await import('./commands/v2/provider.mjs'); await providerList(); }
    else if (action === 'launch') { const { runLaunch } = await import('./commands/v2/launch.mjs'); await runLaunch([]); }
    else process.exit(0);
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

  if (cmd === 'group') {
    const sub = args[1] || '';
    if (sub === 'use') {
      const { groupUse } = await import('./commands/v2/group.mjs');
      await groupUse();
    } else {
      const { groupList } = await import('./commands/v2/group.mjs');
      await groupList();
    }
    return;
  }

  if (cmd === 'model') {
    const sub = args[1] || '';
    if (sub === 'probe') {
      const { modelProbe } = await import('./commands/v2/group.mjs');
      await modelProbe();
    } else {
      const { modelList } = await import('./commands/v2/group.mjs');
      await modelList();
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

  if (cmd === 'mirror') {
    const sub = args[1] || 'list';
    const { showMirrors } = await import('./commands/v2/network.mjs');
    if (sub === 'test') {
      const { testAllMirrors } = await import('./mirrors/speedtest.mjs');
      const results = await testAllMirrors();
      console.log(`\n  ${c.boldWhite('Mirror Latency Test')}\n`);
      for (const r of results) {
        const icon = r.status === 'ok' ? c.green(`${r.ms}ms`) : c.red('fail');
        console.log(`    ${r.mirrorId.padEnd(22)} ${icon}`);
      }
      console.log(``);
    } else if (sub === 'switch') {
      const scope = args[2] || 'npm';
      const { autoSwitchMirror } = await import('./mirrors/speedtest.mjs');
      const result = await autoSwitchMirror(scope);
      if (result.switched) {
        console.log(`\n  ${c.green('✓')} Switched to ${c.cyan(result.best)} (${result.latency}ms)\n`);
      } else {
        console.log(`\n  ${c.yellow('!')} ${result.reason}\n`);
      }
    } else if (sub === 'restore') {
      const scope = args[2] || 'npm';
      const { restoreOfficialMirror } = await import('./mirrors/speedtest.mjs');
      await restoreOfficialMirror(scope);
      console.log(`\n  ${c.green('✓')} Restored official ${scope} mirror\n`);
    } else {
      await showMirrors();
    }
    return;
  }

  if (cmd === 'template') {
    const sub = args[1] || 'list';
    const { allTemplates, getTemplate } = await import('./tools/claude/templates.mjs');
    const { safeApplyTemplate, diffTemplate } = await import('./tools/claude/template-manager.mjs');

    if (sub === 'list') {
      console.log(`\n  ${c.boldWhite('CLAUDE.md Templates')}\n`);
      for (const t of allTemplates()) {
        console.log(`  ${c.cyan('●')} ${t.name.padEnd(22)} ${c.gray(t.description)}`);
      }
      console.log(``);
    } else if (sub === 'preview') {
      const id = args[2];
      if (!id) { console.log(`  Usage: occier template preview <id>\n`); return; }
      const t = getTemplate(id);
      if (!t) { console.log(`  ${c.red('Error:')} Template '${id}' not found\n`); return; }
      console.log(`\n  ${c.boldCyan(t.name)} — ${t.description}\n`);
      console.log(t.content.split('\n').slice(0, 15).map((l) => `  ${l}`).join('\n'));
      if (t.content.split('\n').length > 15) console.log(`  ${c.gray('...')}`);
      console.log(``);
    } else if (sub === 'apply') {
      const id = args[2];
      const path = args[3];
      if (!id || !path) { console.log(`  Usage: occier template apply <id> <path>\n`); return; }
      const result = await safeApplyTemplate(id, path);
      if (result.needConfirm) {
        const { confirm } = await import('@inquirer/prompts');
        const ok = await confirm({ message: `File exists. Backup saved to ${result.backupPath}. Overwrite?`, default: false });
        if (ok) {
          await safeApplyTemplate(id, path, true);
          console.log(`  ${c.green('✓')} Applied ${id} to ${path}\n`);
        } else {
          console.log(`  Aborted.\n`);
        }
      } else {
        console.log(`  ${c.green('✓')} Applied ${id} to ${path}\n`);
      }
    } else if (sub === 'diff') {
      const id = args[2];
      const path = args[3];
      if (!id || !path) { console.log(`  Usage: occier template diff <id> <path>\n`); return; }
      const diff = await diffTemplate(id, path);
      if (diff.hasDiff) {
        console.log(`\n  ${c.yellow('Diff:')}\n`);
        for (const l of diff.lines) {
          if (typeof l === 'string') console.log(`  ${l}`);
        }
        console.log(``);
      } else {
        console.log(`\n  ${c.green('✓')} No differences.\n`);
      }
    } else {
      console.log(`  Usage: occier template list|preview|apply|diff\n`);
    }
    return;
  }

  console.error(`\n  ${c.red('Unknown command:')} ${cmd}`);
  console.error(`  Run ${c.cyan('occier --help')} for usage.\n`);
  process.exit(1);
}
