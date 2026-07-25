import { c } from './tui.mjs';
import { lookupCommand, resolveModule } from './registry/commands.mjs';

const HELP = `
  ${c.boldCyan('occier')} ${c.gray('— AI Dev Environment Manager (v2)')}

  ${c.boldWhite('Usage:')}
    ${c.cyan('occier')}                     Open interactive dashboard
    ${c.cyan('occier')} ${c.gray('<command>')}           Run a command

  ${c.boldWhite('Commands:')}
    ${c.cyan('init')}                   First-time setup wizard
    ${c.cyan('doctor')}                 System diagnostics & repair
    ${c.cyan('status')}                 Show environment status
    ${c.cyan('network')}                Network configuration & testing
    ${c.cyan('vault')}                  Manage stored credentials
    ${c.cyan('provider')}               Configure API providers
    ${c.cyan('tool')}                   Install/update claude/opencode
    ${c.cyan('project')}                Manage projects
    ${c.cyan('group')}                  Select model groups
    ${c.cyan('model')}                  List/probe available models
    ${c.cyan('launch')}                 Launch Claude Code or OpenCode
    ${c.cyan('mirror')}                 Manage package mirrors
    ${c.cyan('template')}               Manage CLAUDE.md templates
    ${c.cyan('health')}                 Run system & provider health checks
    ${c.cyan('config')}                 Configuration management
    ${c.cyan('fix-path')}               Auto-configure PATH for new terminals
    ${c.cyan('remove')}                 Remove all configuration and cleanup
    ${c.cyan('<provider>')}             Direct launch (deepseek|kimi|anthropic)

  ${c.boldWhite('Options:')}
    ${c.cyan('--help, -h')}             Show this help
    ${c.cyan('--version, -v')}          Show version
`;

async function displayDashboard() {
  const { startDashboard } = await import('./tui/v3/framework.mjs');
  startDashboard(0);
}

async function dispatchMirror(args) {
  const sub = args[0] || 'list';
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
    const scope = args[1] || 'npm';
    const { autoSwitchMirror } = await import('./mirrors/speedtest.mjs');
    const result = await autoSwitchMirror(scope);
    if (result.switched) {
      console.log(`\n  ${c.green('✓')} Switched to ${c.cyan(result.best)} (${result.latency}ms)\n`);
    } else {
      console.log(`\n  ${c.yellow('!')} ${result.reason}\n`);
    }
  } else if (sub === 'restore') {
    const scope = args[1] || 'npm';
    const { restoreOfficialMirror } = await import('./mirrors/speedtest.mjs');
    await restoreOfficialMirror(scope);
    console.log(`\n  ${c.green('✓')} Restored official ${scope} mirror\n`);
  } else {
    const { showMirrors } = await import('./commands/v2/network.mjs');
    await showMirrors();
  }
}

async function dispatchTemplate(args) {
  const sub = args[0] || 'list';
  const { allTemplates, getTemplate } = await import('./tools/claude/templates.mjs');
  const { safeApplyTemplate, diffTemplate } = await import('./tools/claude/template-manager.mjs');

  if (sub === 'list') {
    console.log(`\n  ${c.boldWhite('CLAUDE.md Templates')}\n`);
    for (const t of allTemplates()) {
      console.log(`  ${c.cyan('●')} ${t.name.padEnd(22)} ${c.gray(t.description)}`);
    }
    console.log(``);
  } else if (sub === 'preview') {
    const id = args[1];
    if (!id) { console.log(`  Usage: occier template preview <id>\n`); return; }
    const t = getTemplate(id);
    if (!t) { console.log(`  ${c.red('Error:')} Template '${id}' not found\n`); return; }
    console.log(`\n  ${c.boldCyan(t.name)} — ${t.description}\n`);
    console.log(t.content.split('\n').slice(0, 15).map((l) => `  ${l}`).join('\n'));
    if (t.content.split('\n').length > 15) console.log(`  ${c.gray('...')}`);
    console.log(``);
  } else if (sub === 'apply') {
    const id = args[1];
    const path = args[2];
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
    const id = args[1];
    const path = args[2];
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
}

function dispatchCommand(cmd, args) {
  const entry = lookupCommand(cmd);
  if (!entry) return null;

  const sub = args[0] || '';
  const subEntry = entry.subCommands?.[sub];

  if (subEntry && subEntry.modulePath) {
    return async () => {
      const m = await import(resolveModule(subEntry.modulePath));
      await m[subEntry.exportName](...args.slice(1));
    };
  }

  if (entry.modulePath && entry.exportName) {
    return async () => {
      const m = await import(resolveModule(entry.modulePath));
      await m[entry.exportName](args);
    };
  }

  return null;
}

export async function route(args) {
  // Load user-defined providers once per invocation (best-effort).
  try {
    const { loadUserProviders } = await import('./registry/user-providers.mjs');
    await loadUserProviders();
  } catch { /* user providers are optional */ }

  if (args.length === 0) {
    await displayDashboard();
    return;
  }

  const cmd = args[0];

  if (cmd === '--help' || cmd === '-h') {
    console.log(HELP);
    return;
  }

  if (cmd === '--version' || cmd === '-v') {
    const { readFile } = await import('fs/promises');
    const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf-8'));
    console.log(`occier v${pkg.version}`);
    return;
  }

  if (cmd === 'deepseek' || cmd === 'kimi' || cmd === 'anthropic') {
    const { directLaunch } = await import('./commands/launch.mjs');
    await directLaunch(cmd);
    return;
  }

  if (cmd === 'mirror') {
    await dispatchMirror(args.slice(1));
    return;
  }

  if (cmd === 'template') {
    await dispatchTemplate(args.slice(1));
    return;
  }

  const handler = dispatchCommand(cmd, args.slice(1));
  if (handler) {
    await handler();
    return;
  }

  const entry = lookupCommand(cmd);
  if (entry && entry.subCommands) {
    const subs = Object.keys(entry.subCommands).join('|');
    console.log(`  ${c.yellow('Usage:')} occier ${cmd} ${subs}\n`);
    return;
  }

  console.error(`\n  ${c.red('Unknown command:')} ${cmd}`);
  console.error(`  Run ${c.cyan('occier --help')} for usage.\n`);
  process.exit(1);
}
