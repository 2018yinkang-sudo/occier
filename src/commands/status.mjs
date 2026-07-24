import { readProvidersEnv, configExists, maskKey } from '../config-io.mjs';
import { allProviders } from '../providers/registry.mjs';
import { ENV_FILE, CONFIG_FILE, CC_CONFIG_DIR } from '../paths.mjs';
import { c, divider } from '../tui.mjs';

export async function showStatus() {
  console.log('');
  divider();

  const hasConfig = await configExists();
  const entries = await readProvidersEnv();

  console.log(`  ${c.boldWhite('Configuration')}`);
  console.log('');
  console.log(`    Config dir    ${c.gray(CC_CONFIG_DIR)}`);
  console.log(`    Config file   ${c.gray(CONFIG_FILE)} ${hasConfig ? c.green('exists') : c.yellow('not found')}`);
  console.log(`    Env file      ${c.gray(ENV_FILE)} ${Object.keys(entries).length > 0 ? c.green('exists') : c.yellow('not found')}`);
  console.log('');
  divider();

  console.log(`  ${c.boldWhite('Providers')}`);
  console.log('');

  for (const p of allProviders()) {
    const key = entries[p.envVar];
    const hasKey = key && key.length > 4 && !key.includes('replace_with_your');
    const status = hasKey ? `${c.green('● configured')}` : `${c.yellow('○ not set')}`;
    console.log(`    ${p.label.padEnd(14)} ${status}`);
    if (hasKey) {
      console.log(`                      ${c.gray(p.envVar + '=' + maskKey(key))}`);
    }
    console.log(`                      ${c.gray(p.description)}`);
    if (p.env.ANTHROPIC_MODEL) {
      console.log(`                      ${c.gray('model: ' + p.env.ANTHROPIC_MODEL)}`);
    }
    console.log('');
  }

  divider();
  console.log('');
}
