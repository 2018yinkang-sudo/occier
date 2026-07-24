import { select, password } from '@inquirer/prompts';
import { c, ok, warn, info, divider } from '../tui.mjs';
import { allProviders, getProvider } from '../../registry/providers.mjs';
import { createStore, maskValue } from '../../store/credential-store.mjs';
import { run } from '../../exec/runner.mjs';

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
  const store = createStore();

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
    await store.set(provider.envVarName.toLowerCase(), {
      type: 'api_key',
      value: key,
      provider: providerId,
      updatedAt: new Date().toISOString(),
    });
    ok(`API key saved for ${provider.label} (${maskValue(key)})`);

    if (provider.healthUrl) {
      console.log(`  ${c.gray('Testing connectivity...')}`);
      const r = await run('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', '--connect-timeout', '5', '-H', `Authorization: Bearer ${key.slice(0, 4)}***`, provider.healthUrl], { timeout: 8000 });
      if (r.exitCode === 0) {
        ok(`API reachable — HTTP ${r.stdout}`);
      } else {
        warn('Connectivity test inconclusive (may need proxy)');
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
    process.stdout.write(`  ${c.gray('⏳')} ${p.label.padEnd(15)} testing...`);

    if (!p.healthUrl) {
      process.stdout.write(`\r  ${c.gray('─')} ${p.label.padEnd(15)} ${c.gray('N/A (uses login flow)')}\n`);
      continue;
    }

    const start = Date.now();
    const r = await run('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', '--connect-timeout', '5', p.healthUrl], { timeout: 8000 });
    const ms = Date.now() - start;

    if (r.exitCode === 0) {
      const code = parseInt(r.stdout);
      if (code === 200 || code === 401 || code === 403) {
        process.stdout.write(`\r  ${c.green('✓')} ${p.label.padEnd(15)} HTTP ${code} (${ms}ms)\n`);
      } else {
        process.stdout.write(`\r  ${c.green('✓')} ${p.label.padEnd(15)} HTTP ${code} (${ms}ms)\n`);
      }
    } else {
      process.stdout.write(`\r  ${c.red('✗')} ${p.label.padEnd(15)} ${c.red('unreachable')}\n`);
    }
  }

  console.log(``);
  divider();
  console.log(``);
}
