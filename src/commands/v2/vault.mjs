import { password, input, select, confirm } from '@inquirer/prompts';
import { c, ok, divider } from '../../tui.mjs';
import { createStore, maskValue, readVaultMetaSync, getDeviceFingerprint, reEncryptVault } from '../../store/credential-store.mjs';

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

export async function vaultGet(...args) {
  const store = createStore();
  const reveal = args.includes('--reveal') || args.includes('-r');

  if (args.length === 0 || args[0].startsWith('-')) {
    console.log(`\n  ${c.yellow('Usage:')} occier vault get <key> [--reveal]\n`);
    return;
  }

  const key = args[0];
  const data = await store.get(key);
  if (!data) {
    console.log(`\n  ${c.red('Error:')} Credential '${key}' not found.\n`);
    return;
  }

  console.log(``);
  divider();
  console.log(`  ${c.boldWhite('Credential')}: ${key}`);
  console.log(`  ${c.boldWhite('Type')}: ${data.type || 'api_key'}`);
  if (reveal) {
    console.error(`  ${c.boldWhite('Value')}: ${data.value}`);
    console.error(`\n  ${c.yellow('Warning:')} Plaintext value printed to stderr. Do not share or log this output.`);
  } else {
    console.log(`  ${c.boldWhite('Value')}: ${maskValue(data.value)}`);
  }
  if (data.updatedAt) {
    console.log(`  ${c.boldWhite('Updated')}: ${data.updatedAt}`);
  }
  console.log(``);
  divider();
  console.log(``);
}

export async function vaultPassphrase(...args) {
  const subcmd = args[0];
  if (!subcmd || subcmd === '--help' || subcmd === '-h') {
    console.log(``);
    console.log(`  ${c.boldWhite('occier vault passphrase')} — manage vault passphrase`);
    console.log(``);
    console.log(`  ${c.cyan('set')}    Set a passphrase to protect the vault`);
    console.log(`  ${c.cyan('remove')} Remove passphrase (reverts to device-fingerprint key)`);
    console.log(`  ${c.cyan('status')} Show whether vault is passphrase-protected`);
    console.log(``);
    return;
  }

  if (subcmd === 'status') {
    const meta = readVaultMetaSync();
    if (meta && meta.passphraseProtected) {
      console.log(`\n  Vault is ${c.green('passphrase-protected')}.\n`);
    } else if (meta) {
      console.log(`\n  Vault is protected by ${c.yellow('device fingerprint')}.\n`);
    } else {
      console.log(`\n  Vault uses ${c.yellow('legacy encryption')} (will auto-migrate on next write).\n`);
    }
    return;
  }

  if (subcmd === 'set') {
    const meta = readVaultMetaSync();
    const needsCurrent = meta && meta.passphraseProtected;

    let oldPassphrase;
    if (needsCurrent) {
      oldPassphrase = await password({ message: 'Current passphrase:', mask: true });
    } else {
      oldPassphrase = process.env.OCCIER_PASSPHRASE || getDeviceFingerprint();
    }

    const newPassphrase = await password({
      message: 'New passphrase:',
      mask: true,
      validate: (v) => v.length >= 8 || 'Passphrase must be at least 8 characters',
    });
    await password({
      message: 'Confirm passphrase:',
      mask: true,
      validate: (v) => v === newPassphrase || 'Passphrases do not match',
    });

    const confirmed = await confirm({
      message: 'Re-encrypt all credentials with the new passphrase?',
      default: false,
    });
    if (!confirmed) {
      console.log(`\n  Aborted.\n`);
      return;
    }

    try {
      const result = await reEncryptVault(oldPassphrase, newPassphrase);
      if (result.ok) {
        ok("Passphrase set. Use OCCIER_PASSPHRASE env var to avoid re-entering.\n");
      } else {
        console.error(`\n  ${c.red('Error:')} ${result.error}\n`);
        console.error(`  ${c.yellow('Backup may exist at ~/.config/occier/vault.enc.bak-*')}\n`);
      }
    } catch (err) {
      console.error(`\n  ${c.red('Error:')} ${err.message}\n`);
    }
    return;
  }

  if (subcmd === 'remove') {
    const meta = readVaultMetaSync();
    if (!meta || !meta.passphraseProtected) {
      console.log(`\n  Vault is not passphrase-protected.\n`);
      return;
    }

    const oldPassphrase = await password({
      message: 'Current passphrase:',
      mask: true,
    });

    const confirmed = await confirm({
      message: 'Re-encrypt vault with device-fingerprint key?',
      default: false,
    });
    if (!confirmed) {
      console.log(`\n  Aborted.\n`);
      return;
    }

    // Explicitly use device fingerprint, NOT OCCIER_PASSPHRASE
    const newPassphrase = getDeviceFingerprint();

    try {
      const result = await reEncryptVault(oldPassphrase, newPassphrase);
      if (result.ok) {
        ok("Passphrase removed. Vault now uses device-fingerprint key.\n");
      } else {
        console.error(`\n  ${c.red('Error:')} ${result.error}\n`);
        console.error(`  ${c.yellow('Backup may exist at ~/.config/occier/vault.enc.bak-*')}\n`);
      }
    } catch (err) {
      console.error(`\n  ${c.red('Error:')} ${err.message}\n`);
    }
    return;
  }

  console.log(`\n  ${c.yellow('Usage:')} occier vault passphrase <set|remove|status>\n`);
}
