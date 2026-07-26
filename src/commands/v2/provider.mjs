import { select, password } from '@inquirer/prompts';
import { c, ok, warn, info, divider } from '../../tui.mjs';
import { allProviders, getProvider } from '../../registry/providers.mjs';
import { createStore } from '../../store/credential-store.mjs';
import { testProviderConnectivity, connectProvider } from '../../services/provider.mjs';

export async function providerList() {
  const store = createStore();
  const entries = await store.list();
  const providers = allProviders();

  console.log(``);
  divider();
  console.log(`  ${c.boldWhite('Available Providers')}`);
  console.log(``);

  for (const p of providers) {
    const entry = entries.find((e) => e.key === p.envVarName.toLowerCase());
    const status = entry ? c.green('configured') : c.yellow('not configured');
    const key = entry ? c.gray(entry.fingerprint) : '';
    console.log(`  ${c.cyan('●')} ${p.label.padEnd(15)} ${status}`);
    if (entry) console.log(`    ${' '.repeat(17)}${key}`);
    console.log(`    ${' '.repeat(17)}${c.gray(p.description)}`);
    console.log(`    ${' '.repeat(17)}${c.gray('models: ' + p.models.map((m) => m.name).join(', ') || 'N/A')}`);
    console.log(``);
  }

  divider();
  console.log(``);
}

export async function providerConnect() {
  const providerId = await select({
    message: 'Select provider to configure:',
    choices: allProviders().map((p) => ({
      name: `${p.label.padEnd(15)} ${p.description}`,
      value: p.id,
    })),
  });

  const provider = getProvider(providerId);
  console.log(`\n  ${c.gray(`Protocol: ${provider.protocol}  |  Base URL: ${provider.baseURL || 'default'}`)}\n`);

  if (providerId === 'kimi') {
    info('Use Kimi API Open Platform key, NOT Kimi Code subscription key.');
  }
  if (providerId === 'anthropic') {
    info('Leave empty to use claude.ai login instead of API key.');
  }

  const key = await password({
    message: `${provider.label} API key:`,
    mask: true,
    validate: (input) => {
      if (providerId === 'anthropic') return true;
      return input.length >= 4 || 'Key must be at least 4 characters';
    },
  });

  if (key) {
    const result = await connectProvider(providerId, key);
    if (!result.ok) {
      warn(`Failed to save: ${result.error}`);
    } else {
      ok(`API key saved for ${provider.label} (${result.data.fingerprint})`);

      if (provider.healthUrl || provider.baseURL) {
        console.log(`  ${c.gray('Testing connectivity...')}`);
        const r = await testProviderConnectivity(providerId);
        const d = r.ok ? r.data : null;
        if (d?.keyValid === true) ok(`Key valid — HTTP ${d.httpCode}`);
        else if (d?.keyValid === false) warn(`Key INVALID — HTTP ${d.httpCode}`);
        else if (d?.reachable === false) warn('Unreachable');
        else warn('Connectivity test inconclusive');
      }
    }
  } else {
    info(`No key provided for ${provider.label}. Will use login flow if available.`);
  }

  console.log(``);
}

export async function providerTest() {
  const store = createStore();
  const entries = await store.list();
  const providers = allProviders();

  console.log(``);
  divider();
  console.log(`  ${c.boldWhite('Provider Connectivity Test')}`);
  console.log(``);

  for (const p of providers) {
    const entry = entries.find((e) => e.key === p.envVarName.toLowerCase());
    if (!entry) {
      console.log(`  ${c.gray('○')} ${p.label.padEnd(15)} ${c.yellow('not configured')}`);
      continue;
    }

    const start = Date.now();
    const result = await testProviderConnectivity(p.id);
    if (!result.ok || !result.data) {
      console.log(`  ${c.red('✗')} ${p.label.padEnd(15)} ${c.red(result.error || 'test failed')}`);
      continue;
    }
    const r = result.data;
    if (r.reachable === false) {
      console.log(`  ${c.red('✗')} ${p.label.padEnd(15)} ${c.red('unreachable')}`);
    } else if (r.keyValid === true) {
      console.log(`  ${c.green('✓')} ${p.label.padEnd(15)} ${c.green('key valid')}  HTTP ${r.httpCode}  (${Date.now() - start}ms)`);
    } else if (r.keyValid === false) {
      console.log(`  ${c.red('✗')} ${p.label.padEnd(15)} ${c.red('key INVALID')}  HTTP ${r.httpCode}`);
    } else if (r.reachable === null) {
      console.log(`  ${c.gray('─')} ${p.label.padEnd(15)} ${c.gray(r.detail)}`);
    } else {
      console.log(`  ${c.yellow('⚠')} ${p.label.padEnd(15)} ${c.yellow(r.detail)}`);
    }
  }

  console.log(``);
  divider();
  console.log(``);
}
