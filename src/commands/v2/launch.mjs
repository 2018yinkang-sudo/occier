import { c } from '../../tui.mjs';
import { hasCommand } from '../../exec/runner.mjs';
import { launchClaude } from '../../launch.mjs';
import { createStore } from '../../store/credential-store.mjs';
import { getProviderSafe } from '../../registry/providers.mjs';

export function filterLaunchArgs(args) {
  const passthrough = [];
  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--tool' || args[i] === '--provider') && args[i + 1]) {
      i++;
    } else if (args[i] === 'claude' || args[i] === 'opencode') {
      continue;
    } else {
      passthrough.push(args[i]);
    }
  }
  return passthrough;
}

export async function runLaunch(args) {
  let tool = 'claude';
  let providerId = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--tool' && args[i + 1]) {
      tool = args[i + 1];
      i++;
    } else if (args[i] === '--provider' && args[i + 1]) {
      providerId = args[i + 1];
      i++;
    } else if (!providerId && ['claude', 'opencode'].includes(args[i])) {
      tool = args[i];
    }
  }

  const installed = await hasCommand(tool);
  if (!installed) {
    console.error(`\n  ${c.red('Error:')} ${tool} is not installed.\n`);
    process.exit(1);
  }

  if (tool === 'claude') {
    const store = createStore();
    const entries = await store.list();

    if (!providerId) {
      const { select } = await import('@inquirer/prompts');
      const { allProviders } = await import('../../registry/providers.mjs');
      const configured = allProviders().filter((p) =>
        entries.some((e) => e.key === p.envVarName.toLowerCase()),
      );
      if (configured.length === 0) {
        console.error(`\n  ${c.red('Error:')} No providers configured. Run ${c.cyan('occier provider connect')}.\n`);
        process.exit(1);
      }
      const chosen = await select({
        message: 'Select provider:',
        choices: configured.map((p) => ({
          name: `${p.label.padEnd(14)} ${p.description}`,
          value: p.id,
        })),
      });
      providerId = chosen;
    }

    const provider = getProviderSafe(providerId);
    if (!provider) {
      console.error(`\n  ${c.red('Error:')} Unknown provider: ${providerId}\n`);
      process.exit(1);
    }

    const providerData = await store.get(provider.envVarName.toLowerCase());

    const envVars = { ...provider.claudeEnv };
    if (providerData && providerData.value) {
      if (providerId === 'anthropic') {
        envVars.ANTHROPIC_API_KEY = providerData.value;
      } else {
        envVars.ANTHROPIC_AUTH_TOKEN = providerData.value;
      }
    }

    console.log(`  Provider: ${c.cyan(provider.label)}  |  Model: ${c.gray(provider.defaultModel || 'default')}`);
    console.log(``);

    launchClaude(envVars, filterLaunchArgs(args));
  } else if (tool === 'opencode') {
    const store = createStore();
    const { allProviders } = await import('../../registry/providers.mjs');
    const { clearProviderEnv } = await import('../../launch.mjs');
    const envVars = { ...process.env };
    clearProviderEnv(envVars);

    if (!providerId) {
      const entries = await store.list();
      const configured = allProviders().filter((p) =>
        entries.some((e) => e.key === p.envVarName.toLowerCase()),
      );
      if (configured.length === 0) {
        console.error(`\n  ${c.red('Error:')} No providers configured. Run ${c.cyan('occier provider connect')}.\n`);
        process.exit(1);
      }
      const { select } = await import('@inquirer/prompts');
      providerId = await select({
        message: 'Select provider:',
        choices: configured.map((p) => ({
          name: `${p.label.padEnd(14)} ${p.description}`,
          value: p.id,
        })),
      });
    }

    const provider = getProviderSafe(providerId);
    if (provider) {
      const data = await store.get(provider.envVarName.toLowerCase());
      if (data?.value) {
        envVars[provider.envVarName] = data.value;
      }
    }

    console.log(`  ${c.cyan('Starting OpenCode...')}`);
    console.log(``);

    const { spawn } = await import('child_process');
    const child = spawn('opencode', [], { stdio: 'inherit', env: envVars });
    child.on('error', (err) => {
      console.error(`\n  ${c.red('Error:')} ${err.message}\n`);
      process.exit(1);
    });
    child.on('exit', (code) => {
      process.exit(code ?? 0);
    });
  }
}
