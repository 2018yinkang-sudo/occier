import { select, Separator } from '@inquirer/prompts';
import { readProvidersEnv, configExists } from '../config-io.mjs';
import { getProvider, providerChoices } from '../providers/registry.mjs';
import { launchClaude } from '../launch.mjs';
import { banner } from '../tui.mjs';

export async function selectAndLaunch() {
  banner();

  const hasConfig = await configExists();
  if (!hasConfig) {
    console.log('  No configuration found. Running setup first...');
    const { runSetup } = await import('./setup-wizard.mjs');
    await runSetup();
    console.log('');
  }

  const entries = await readProvidersEnv();
  const configuredProviders = [];
  for (const p of providerChoices().map(c => c.value)) {
    const provider = getProvider(p);
    const key = entries[provider.envVar];
    if (key && key.length > 4 && !key.includes('replace_with_your')) {
      configuredProviders.push(p);
    }
  }

  if (configuredProviders.length === 0) {
    console.log('  No API keys configured. Run \x1b[36moccier config\x1b[0m to set up.');
    console.log('');
    process.exit(0);
  }

  const all = providerChoices().map(c => {
    const configured = configuredProviders.includes(c.value);
    const prefix = configured ? '\x1b[32m●\x1b[0m ' : '\x1b[90m○\x1b[0m ';
    return { ...c, name: prefix + c.name };
  });

  const chosen = await select({
    message: 'Select AI provider:',
    choices: [
      ...all,
      new Separator(),
      { name: 'Quit', value: '_quit' },
    ],
  });

  if (chosen === '_quit') {
    console.log('');
    process.exit(0);
  }

  const provider = getProvider(chosen);
  const key = entries[provider.envVar];

  if (!key || key.length <= 4 || key.includes('replace_with_your')) {
    console.log('');
    console.log(`  \x1b[33m${provider.label} API key is not configured.\x1b[0m`);
    console.log(`  Run \x1b[36moccier config\x1b[0m to set it up.`);
    console.log('');
    process.exit(1);
  }

  const envVars = { ...provider.env };
  if (chosen === 'anthropic') {
    if (key && key.length > 4) {
      envVars.ANTHROPIC_API_KEY = key;
    }
  } else {
    envVars.ANTHROPIC_AUTH_TOKEN = key;
  }

  console.log('');
  console.log(`  Provider: \x1b[36m${provider.label}\x1b[0m  |  Model: \x1b[90m${provider.env.ANTHROPIC_MODEL || 'default'}\x1b[0m`);
  console.log('');

  launchClaude(envVars);
}
