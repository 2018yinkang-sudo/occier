import { password, input, select, confirm } from '@inquirer/prompts';
import { c, ok, divider } from '../../tui.mjs';
import { createStore, readVaultMetaSync, getDeviceFingerprint, reEncryptVault, maskValue } from '../../store/credential-store.mjs';
import { listTypes, getModelPresets, ENDPOINT_LABELS, defaultKeyFor, XRAY_METHODS, getType } from '../../store/credential-types.mjs';
import { setCredential, getCredential, testCredential } from '../../services/vault.mjs';

function hostOf(url) {
  try { return new URL(url).host; } catch { return url || ''; }
}

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

  const types = listTypes();
  const labelOf = new Map(types.map((t) => [t.id, t.label]));
  for (const e of entries) {
    const typeLabel = labelOf.get(e.type) || e.type;
    let detail = '';
    if (e.type === 'model_key' && e.fields) {
      detail = `${c.gray(e.fields.endpoint_type + ' · ' + hostOf(e.fields.base_url))}`;
    }
    console.log(`  ${c.cyan('●')} ${e.key.padEnd(25)} ${typeLabel.padEnd(14)} ${e.fingerprint}  ${detail}`);
  }
  console.log(``);
  divider();
  console.log(``);
}

export async function vaultSet() {
  const types = listTypes();

  const typeChoice = await select({
    message: 'Credential type:',
    choices: types.map((t) => ({ name: `${t.label.padEnd(14)} ${c.gray(t.description)}`, value: t.id })),
  });

  const typeDef = getType(typeChoice);

  // — key name —
  let key;
  if (typeDef.keyMode === 'fixed' && typeDef.fixedKey) {
    key = typeDef.fixedKey;
  } else if (typeDef.keyMode === 'default') {
    const def = defaultKeyFor(typeChoice);
    key = await input({
      message: `Credential name (回车使用用户名 ${c.cyan(def)}):`,
      default: def || undefined,
      validate: (v) => v.trim().length > 0 || 'Name is required',
    });
  } else {
    key = await input({
      message: 'Credential name (alias):',
      validate: (v) => v.trim().length > 0 || 'Name is required',
    });
  }

  // — type-specific prompts —
  if (typeChoice === 'model_key') {
    await promptModelKey(key);
    return;
  }
  if (typeChoice === 'proxy_password') {
    await promptProxyPassword(key);
    return;
  }

  // Non-structured: single secret value (sudo_password).
  const value = await password({
    message: `Value for ${key}:`,
    mask: true,
    validate: (v) => v.length >= 4 || 'Value must be at least 4 characters',
  });

  const result = await setCredential(key, typeChoice, { value });
  if (result.ok) {
    ok(`Credential '${key.trim()}' saved (${result.data.fingerprint})\n`);
  } else {
    console.error(`\n  ${c.red('Error:')} ${result.error}\n`);
  }
}

async function promptModelKey(key) {
  const presets = getModelPresets();
  const presetChoice = await select({
    message: 'Preset (fills endpoint_type + base_url):',
    choices: presets.map((p) => ({
      name: `${p.label}${p.base_url ? c.gray('  ' + p.base_url) : ''}`,
      value: p.id,
    })),
  });
  const preset = presets.find((p) => p.id === presetChoice);

  const endpointType = await select({
    message: 'Endpoint type:',
    choices: Object.entries(ENDPOINT_LABELS).map(([val, label]) => ({ name: label, value: val })),
    default: preset?.endpoint_type || undefined,
  });
  const baseUrl = await input({
    message: 'Base URL:',
    default: preset?.base_url || undefined,
    validate: (v) => { const s = v.trim(); if (!s) return 'Base URL is required'; try { new URL(s); return true; } catch { return 'Invalid URL'; } },
  });
  const apiKey = await password({
    message: 'API Key:',
    mask: true,
    validate: (v) => v.length > 0 || 'API Key is required',
  });
  const label = await input({ message: 'Display label (optional, Enter to skip):' });

  const result = await setCredential(key, 'model_key', {
    fields: { endpoint_type: endpointType, base_url: baseUrl.trim(), api_key: apiKey, label: label.trim() },
  });
  if (result.ok) {
    ok(`Model key '${key.trim()}' saved (${result.data.fingerprint})`);
    // Auto-test the key immediately.
    try {
      console.log(`  Testing connectivity...`);
      const tr = await testCredential(key);
      if (tr.ok && tr.data.reachable) {
        if (tr.data.keyValid === true) console.log(`  ${c.green('✓')} Key valid!\n`);
        else if (tr.data.keyValid === false) console.log(`  ${c.red('✗')} Key INVALID (HTTP ${tr.data.httpCode})\n`);
        else console.log(`  ${c.yellow('⚠')} Reachable, but key validation unavailable (HTTP ${tr.data.httpCode})\n`);
      } else {
        console.log(`  ${tr.ok ? c.yellow('⚠') + ' ' + tr.data.detail : c.red('✗') + ' ' + (tr.error || 'test failed')}\n`);
      }
    } catch { /* test failure is non-fatal */ }
  } else console.error(`\n  ${c.red('Error:')} ${result.error}\n`);
}

async function promptProxyPassword(key) {
  const protocol = await select({
    message: 'Protocol:',
    choices: [
      { name: 'HTTP (user + pass)', value: 'http' },
      { name: 'SOCKS (user + pass)', value: 'socks' },
      { name: 'Shadowsocks (method + password)', value: 'shadowsocks' },
      { name: 'Trojan (password)', value: 'trojan' },
      { name: 'VLESS (UUID)', value: 'vless' },
      { name: 'VMess (UUID)', value: 'vmess' },
    ],
  });

  const fields = { protocol };

  if (protocol === 'http' || protocol === 'socks') {
    fields.username = await input({ message: 'Username:' });
    fields.password = await password({
      message: 'Password:',
      mask: true,
      validate: (v) => v.length > 0 || 'Password is required',
    });
  } else if (protocol === 'trojan') {
    fields.password = await password({
      message: 'Password:',
      mask: true,
      validate: (v) => v.length > 0 || 'Password is required',
    });
    const email = await input({ message: 'Email (optional, Enter to skip):' });
    if (email.trim()) fields.email = email.trim();
  } else if (protocol === 'shadowsocks') {
    fields.method = await select({
      message: 'Method:',
      choices: XRAY_METHODS.map((m) => ({ name: m, value: m })),
      default: '2022-blake3-aes-256-gcm',
    });
    fields.password = await password({
      message: 'Password/Key:',
      mask: true,
      validate: (v) => v.length > 0 || 'Password is required',
    });
    const email = await input({ message: 'Email (optional, Enter to skip):' });
    if (email.trim()) fields.email = email.trim();
  } else if (protocol === 'vless') {
    fields.id = await input({
      message: 'UUID:',
      validate: (v) => v.trim().length > 0 || 'UUID is required',
    });
    fields.flow = await select({
      message: 'Flow (optional):',
      choices: [
        { name: '(none)', value: '' },
        { name: 'xtls-rprx-vision', value: 'xtls-rprx-vision' },
        { name: 'xtls-rprx-vision-udp443', value: 'xtls-rprx-vision-udp443' },
      ],
    });
    if (!fields.flow) fields.flow = '';
  } else if (protocol === 'vmess') {
    fields.id = await input({
      message: 'UUID:',
      validate: (v) => v.trim().length > 0 || 'UUID is required',
    });
    fields.security = await select({
      message: 'Security (optional):',
      choices: [
        { name: 'auto', value: 'auto' },
        { name: 'aes-128-gcm', value: 'aes-128-gcm' },
        { name: 'chacha20-poly1305', value: 'chacha20-poly1305' },
      ],
      default: 'auto',
    });
    if (!fields.security) fields.security = 'auto';
  }

  const result = await setCredential(key, 'proxy_password', { fields });
  if (result.ok) ok(`Proxy credential '${key.trim()}' saved (${result.data.fingerprint})\n`);
  else console.error(`\n  ${c.red('Error:')} ${result.error}\n`);
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
    choices: entries.map((e) => ({
      name: `${e.key.padEnd(25)} ${e.fingerprint}`,
      value: e.key,
    })),
  });

  const confirmed = await confirm({ message: `Remove '${chosen}'?`, default: false });
  if (confirmed) {
    await store.delete(chosen);
    console.log(`\n  ${c.green('✓')} Credential '${chosen}' removed.\n`);
  } else {
    console.log(`\n  Aborted.\n`);
  }
}

export async function vaultTest(...args) {
  if (args.length === 0 || args[0].startsWith('-')) {
    console.log(`\n  ${c.yellow('Usage:')} occier vault test <key>\n`);
    return;
  }
  const key = args[0];
  console.log(`\n  Testing ${c.cyan(key)}...`);
  const tr = await testCredential(key);
  if (!tr.ok) {
    console.log(`  ${c.red('✗')} ${tr.error}\n`);
    return;
  }
  const r = tr.data;

  // Print raw commands and output.
  if (r.commands && r.commands.length > 0) {
    for (const cmd of r.commands) {
      console.log(`\n  ${c.boldWhite('$')} ${c.cyan(cmd.cmd)}`);
      if (cmd.stdout) console.log(`  ${c.gray(cmd.stdout)}`);
      if (cmd.stderr) console.log(`  ${c.red(cmd.stderr)}`);
      const exitColor = cmd.exitCode === 0 ? 'green' : 'red';
      console.log(`  ${c.gray('[')}${c[exitColor]('exit: ' + cmd.exitCode)}${c.gray(']')} ${cmd.duration || ''}ms`);
    }
    console.log('');
  }

  if (r.reachable === false) {
    console.log(`  ${c.red('✗')} Unreachable — ${r.detail}\n`);
  } else if (r.keyValid === true) {
    console.log(`  ${c.green('✓')} Valid — ${r.detail}\n`);
  } else if (r.keyValid === false) {
    console.log(`  ${c.red('✗')} Invalid — ${r.detail}\n`);
  } else if (r.reachable === null) {
    console.log(`  ${r.detail.startsWith('Missing') ? c.red('✗') : c.green('✓')} ${r.detail}\n`);
  } else {
    console.log(`  ${c.yellow('⚠')} ${r.detail}\n`);
  }
}

export async function vaultGet(...args) {
  const reveal = args.includes('--reveal') || args.includes('-r');

  if (args.length === 0 || args[0].startsWith('-')) {
    console.log(`\n  ${c.yellow('Usage:')} occier vault get <key> [--reveal]\n`);
    return;
  }

  const key = args[0];
  const result = await getCredential(key);
  if (!result.ok) {
    console.log(`\n  ${c.red('Error:')} Credential '${key}' not found.\n`);
    return;
  }
  const data = result.data;

  console.log(``);
  divider();
  console.log(`  ${c.boldWhite('Credential')}: ${key}`);
  console.log(`  ${c.boldWhite('Type')}: ${data.type || 'api_key'}`);

  if (data.fields) {
    // Structured (model_key)
    for (const [fname, fval] of Object.entries(data.fields)) {
      if (fname === 'api_key') {
        if (reveal) {
          console.error(`  ${c.boldWhite('api_key')}: ${fval}`);
        } else {
          console.log(`  ${c.boldWhite('api_key')}: ${maskValue(fval, 'api_key')}`);
        }
      } else {
        console.log(`  ${c.boldWhite(fname)}: ${fval}`);
      }
    }
  } else {
    if (reveal) {
      console.error(`  ${c.boldWhite('Value')}: ${data.value}`);
      console.error(`\n  ${c.yellow('Warning:')} Plaintext value printed to stderr. Do not share or log this output.`);
    } else {
      console.log(`  ${c.boldWhite('Value')}: ${maskValue(data.value, data.type)}`);
    }
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
