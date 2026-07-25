import { select } from '@inquirer/prompts';
import { c, ok, warn, info, divider } from '../../tui.mjs';
import { allGroups, getGroup } from '../../model-groups/registry.mjs';
import { allProviders, getProvider } from '../../registry/providers.mjs';
import { createStore } from '../../store/credential-store.mjs';

export async function groupList() {
  console.log(``);
  divider();
  console.log(`  ${c.boldWhite('Model Groups')}`);
  console.log(``);

  for (const g of allGroups()) {
    console.log(`  ${c.cyan('●')} ${g.label.padEnd(14)} ${c.gray(g.description)}`);
    console.log(`    Provider:  ${g.provider}`);
    console.log(`    Model:     ${g.models.primary || c.gray('not set')}`);
    if (g.models.fast !== g.models.primary) {
      console.log(`    Fast:      ${g.models.fast}`);
    }
    console.log(``);
  }

  divider();
  console.log(``);
}

export async function groupUse() {
  const store = createStore();
  const entries = await store.list();
  const providers = allProviders().filter((p) =>
    p.envVarName && entries.some((e) => e.key.toLowerCase() === p.envVarName.toLowerCase()),
  );
  const groups = allGroups().filter((g) =>
    providers.some((p) => p.id === g.provider) || g.id === 'custom',
  );

  if (groups.length === 0 && !providers.length) {
    console.log(`\n  ${c.yellow('No providers configured.')} Run ${c.cyan('occier provider connect')} first.\n`);
    return;
  }

  const chosen = await select({
    message: 'Select model group:',
    choices: groups.map((g) => ({
      name: `${g.label.padEnd(14)} ${g.description}`,
      value: g.id,
    })),
  });

  const group = getGroup(chosen);
  console.log(`\n  ${c.green('✓')} Using ${c.cyan(group.label)}`);
  console.log(`    Provider: ${c.gray(group.provider)}`);
  console.log(`    Model:    ${c.gray(group.models.primary || 'default')}`);
  console.log(``);
}

export async function modelList() {
  const providers = allProviders();
  console.log(``);
  divider();
  console.log(`  ${c.boldWhite('Available Models')}`);
  console.log(``);

  for (const p of providers) {
    if (!p.models || p.models.length === 0) continue;
    console.log(`  ${c.cyan('●')} ${p.label} (${p.protocol})`);
    for (const m of p.models) {
      console.log(`    ${m.id.padEnd(35)} ${c.gray(`${m.context.toLocaleString()} ctx`)}`);
    }
    console.log(``);
  }

  divider();
  console.log(``);
}

export async function modelProbe() {
  const store = createStore();
  const entries = await store.list();

  const providers = allProviders().filter((p) =>
    p.healthUrl && entries.some((e) => e.key.toLowerCase() === p.envVarName.toLowerCase()),
  );

  if (providers.length === 0) {
    console.log(`\n  ${c.yellow('No configured providers to probe.')}\n`);
    return;
  }

  const chosen = await select({
    message: 'Select provider to probe:',
    choices: providers.map((p) => ({
      name: `${p.label.padEnd(14)} ${p.description}`,
      value: p.id,
    })),
  });

  const provider = getProvider(chosen);
  console.log(`  ${c.gray(`Connecting to ${provider.baseURL || provider.defaultModel || chosen}...`)}`);

  if (provider.healthUrl) {
    const { run } = await import('../../exec/runner.mjs');
    const r = await run('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', '--connect-timeout', '5', provider.healthUrl], { timeout: 8000 });
    if (r.exitCode === 0) {
      ok(`API reachable (HTTP ${r.stdout})`);
    } else {
      warn('API unreachable — check network or proxy');
    }
  } else {
    info('No health check endpoint for this provider');
  }
  console.log(``);
}
