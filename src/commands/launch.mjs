import { getProvider } from '../registry/providers.mjs';
import { readProvidersEnv } from '../config-io.mjs';
import { launchClaude } from '../launch.mjs';
import { c } from '../tui.mjs';

export async function directLaunch(providerId) {
  const provider = getProvider(providerId);
  const entries = await readProvidersEnv();
  const key = entries[provider.envVarName];

  if (providerId === 'anthropic') {
    const envVars = {};
    if (key && key.length > 4 && !key.includes('replace_with_your')) {
      envVars.ANTHROPIC_API_KEY = key;
      console.log(`  Provider: ${c.cyan('Anthropic API')}`);
    } else {
      console.log(`  Provider: ${c.cyan('Anthropic / claude.ai login')}`);
    }
    console.log('');
    launchClaude(envVars);
    return;
  }

  if (!key || key.length <= 4 || key.includes('replace_with_your')) {
    console.error(`\n  ${c.red('Error:')} ${provider.label} API key not configured.`);
    console.log(`  Run ${c.cyan('occier config')} to set it up.\n`);
    process.exit(1);
  }

  console.log(`  Provider: ${c.cyan(provider.label)}  |  Model: ${c.gray(provider.claudeEnv.ANTHROPIC_MODEL || 'default')}`);
  console.log('');

  const envVars = { ...provider.claudeEnv, ANTHROPIC_AUTH_TOKEN: key };
  launchClaude(envVars);
}
