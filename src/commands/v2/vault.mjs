import { password, input, select, confirm } from '@inquirer/prompts';
import { c, ok, divider } from '../../tui.mjs';
import { createStore, maskValue } from '../../store/credential-store.mjs';

export async function vaultList() {
  const store = createStore();
  const entries = await store.list();

  console.log(``);
  divider();
  console.log(`  ${c.boldWhite('Credential Vault')}`);
  console.log(``);

  if (entries.length === 0) {
    console.log(`  ${c.gray('No credentials stored.')}`);
    console.log(`  Run ${c.cyan('occier vault set')} to add one.\n`);
    return;
  }

  for (const e of entries) {
    console.log(`  ${c.cyan('●')} ${e.key.padEnd(25)} ${e.type.padEnd(10)} ${c.gray(e.fingerprint)}`);
  }
  console.log(``);
  divider();
  console.log(``);
}

export async function vaultSet() {
  const store = createStore();

  const key = await input({
    message: 'Credential name (e.g. deepseek_api, github_token):',
    validate: (v) => v.trim().length > 0 || 'Name is required',
  });

  const value = await password({
    message: `Value for ${key}:`,
    mask: true,
    validate: (v) => v.length >= 4 || 'Value must be at least 4 characters',
  });

  const type = await select({
    message: 'Credential type:',
    choices: [
      { name: 'API Key', value: 'api_key' },
      { name: 'GitHub Token', value: 'github_token' },
      { name: 'Proxy Password', value: 'proxy_password' },
      { name: 'Other', value: 'other' },
    ],
  });

  await store.set(key.trim(), { type, value, updatedAt: new Date().toISOString() });
  console.log(``);
  ok(`Credential '${key.trim()}' saved (${maskValue(value)})\n`);
}

export async function vaultRemove() {
  const store = createStore();
  const entries = await store.list();

  if (entries.length === 0) {
    console.log(`\n  ${c.gray('No credentials to remove.')}\n`);
    return;
  }

  const chosen = await select({
    message: 'Select credential to remove:',
    choices: [
      ...entries.map((e) => ({
        name: `${e.key.padEnd(25)} ${e.fingerprint}`,
        value: e.key,
      })),
    ],
  });

  const confirmed = await confirm({ message: `Remove '${chosen}'?`, default: false });
  if (confirmed) {
    await store.delete(chosen);
    console.log(`\n  ${c.green('✓')} Credential '${chosen}' removed.\n`);
  } else {
    console.log(`\n  Aborted.\n`);
  }
}
