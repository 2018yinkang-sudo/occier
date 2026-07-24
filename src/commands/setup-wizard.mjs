import { checkbox, password, select, confirm } from '@inquirer/prompts';
import { readProvidersEnv, writeProvidersEnv, readConfig, writeConfig, providersEnvExists } from '../config-io.mjs';
import { allProviders, getProvider } from '../providers/registry.mjs';
import { c, banner } from '../tui.mjs';

export async function runSetup() {
  banner();
  console.log(`  ${c.boldWhite('Setup Wizard')}`);
  console.log('');

  const hasEnv = await providersEnvExists();
  if (hasEnv) {
    const overwrite = await confirm({
      message: 'providers.env already exists. Overwrite?',
      default: false,
    });
    if (!overwrite) {
      console.log(`\n    ${c.green('✓')} Keeping existing configuration.`);
      console.log(`    Run ${c.cyan('occier config set-key')} to modify individual keys.`);
      console.log('');
      return;
    }
  }

  const selected = await checkbox({
    message: 'Select providers to configure:',
    choices: allProviders().map(p => ({
      name: `${p.label.padEnd(14)} ${p.description}`,
      value: p.id,
    })),
  });

  if (selected.length === 0) {
    console.log(`\n    No providers selected. Run ${c.cyan('occier config')} later.\n`);
    return;
  }

  const keys = {};
  console.log('');

  for (const id of selected) {
    const p = getProvider(id);
    if (id === 'kimi') {
      console.log(`  ${c.gray('Note: Use a Kimi API Open Platform key, NOT Kimi Code subscription key.')}`);
    }
    if (id === 'anthropic') {
      console.log(`  ${c.gray('Leave empty to use claude.ai login instead.')}`);
    }
    const key = await password({
      message: `${p.label} API key:`,
      validate: (input) => {
        if (id === 'anthropic') return true;
        if (input.length < 4) return 'Key must be at least 4 characters';
        return true;
      },
    });
    keys[p.envVar] = key;
    console.log('');
  }

  const allEntries = { ...(await readProvidersEnv()), ...keys };
  await writeProvidersEnv(allEntries);

  const config = await readConfig();
  config.providers = [...new Set([...config.providers, ...selected])];
  if (!config.installedAt) config.installedAt = new Date().toISOString();
  config.configured = true;
  await writeConfig(config);

  console.log(`  ${c.green('✓')} Configuration saved to ~/.config/claude-code/providers.env`);
  console.log('');
}

export async function setKey() {
  const entries = await readProvidersEnv();

  const { id } = await select({
    message: 'Select provider:',
    choices: allProviders().map(p => ({
      name: `${p.label.padEnd(14)} (current: ${entries[p.envVar] ? '****configured****' : 'not set'})`,
      value: p.id,
    })),
  });

  const p = getProvider(id);
  if (id === 'kimi') {
    console.log(`  ${c.gray('Note: Use Kimi API Open Platform key, NOT Kimi Code subscription key.')}\n`);
  }
  if (id === 'anthropic') {
    console.log(`  ${c.gray('Leave empty for claude.ai login.\n')}`);
  }

  const key = await password({
    message: `${p.label} API key:`,
    validate: (input) => {
      if (id === 'anthropic') return true;
      if (input.length < 4) return 'Key must be at least 4 characters';
      return true;
    },
  });

  entries[p.envVar] = key;
  await writeProvidersEnv(entries);
  console.log(`\n  ${c.green('✓')} ${p.label} API key updated.\n`);
}

export async function resetConfig() {
  const confirmReset = await confirm({
    message: `${c.red('Delete all configuration?')} This cannot be undone.`,
    default: false,
  });

  if (!confirmReset) {
    console.log(`\n  Aborted.\n`);
    return;
  }

  const { rm } = await import('fs/promises');
  const { ENV_FILE, CONFIG_FILE } = await import('../paths.mjs');

  try { await rm(ENV_FILE, { force: true }); } catch { /* file not found, skip */ }
  try { await rm(CONFIG_FILE, { force: true }); } catch { /* file not found, skip */ }

  console.log(`\n  ${c.green('✓')} Configuration reset.\n`);
}

export async function showConfig() {
  const { ENV_FILE, CONFIG_FILE, CC_CONFIG_DIR } = await import('../paths.mjs');
  const entries = await readProvidersEnv();

  console.log(`\n  ${c.boldWhite('Config locations:')}`);
  console.log(`    Config dir    ${c.gray(CC_CONFIG_DIR)}`);
  console.log(`    Config file   ${c.gray(CONFIG_FILE)}`);
  console.log(`    Env file      ${c.gray(ENV_FILE)}`);
  console.log('');

  for (const p of allProviders()) {
    const key = entries[p.envVar];
    const hasKey = key && key.length > 4 && !key.includes('replace_with_your');
    console.log(`    ${hasKey ? c.green('●') : c.gray('○')} ${p.label.padEnd(12)} ${p.envVar}=${hasKey ? '****' : c.gray('<not set>')}`);
  }
  console.log('');
}
