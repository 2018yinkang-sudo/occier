import { c, ok, warn, fail, info, divider } from '../tui.mjs';
import { detectCapabilities } from '../../env/detect.mjs';
import { readConfig, writeConfig } from '../../schema/config.mjs';
import { detectExistingProxy, COMMON_PORTS, buildProxyEnv, buildShellRcBlock, injectShellRc } from '../../network/proxy.mjs';
import { detectWslNetworkMode, buildWslConfig } from '../../network/wsl.mjs';
import { checkAll as checkConnectivity } from '../../network/connectivity.mjs';
import { allMirrors } from '../../mirrors/registry.mjs';

async function getRcPath() {
  const { join } = await import('path');
  const { homedir } = await import('os');
  const candidates = ['.bashrc', '.zshrc', '.profile'];
  for (const name of candidates) {
    try {
      const { accessSync, R_OK } = await import('fs');
      accessSync(join(homedir(), name), R_OK);
      return join(homedir(), name);
    } catch { /* rc not found */ }
  }
  return join(homedir(), '.bashrc');
}

export async function showNetworkStatus() {
  const env = await detectCapabilities();

  console.log(``);
  divider();
  console.log(`  ${c.boldWhite('Network Status')}`);
  console.log(``);

  console.log(`  ${c.boldCyan('Platform')}`);
  console.log(`    OS:           ${env.os}${env.isWSL ? ` (WSL${env.wslVersion})` : ''}`);
  if (env.isWSL) {
    const mode = detectWslNetworkMode();
    console.log(`    WSL mode:     ${mode || 'unknown'}`);
  }

  console.log(``);
  console.log(`  ${c.boldCyan('Proxy')}`);
  const proxy = detectExistingProxy();
  for (const [k, v] of Object.entries(proxy)) {
    console.log(`    ${k.padEnd(15)} ${v ? c.gray(v) : c.gray('not set')}`);
  }

  console.log(``);
  console.log(`  ${c.boldCyan('Connectivity')}`);
  const results = await checkConnectivity();
  for (const r of results) {
    if (r.status === 'ok') {
      ok(`${r.name.padEnd(20)} ${r.http.code} (${r.http.ms}ms)`);
    } else {
      fail(`${r.name.padEnd(20)} ${r.http.error || 'unreachable'}`);
    }
  }

  console.log(``);
  console.log(`  ${c.boldCyan('Mirrors')}`);
  for (const m of allMirrors()) {
    const status = m.enabled ? c.green('enabled') : c.gray('disabled');
    console.log(`    ${m.id.padEnd(20)} ${status} ${c.gray(m.baseUrl)}`);
  }

  divider();
  console.log(``);
}

export async function configureNetwork() {
  const env = await detectCapabilities();

  console.log(``);
  divider();
  console.log(`  ${c.boldWhite('Network Configuration')}`);
  console.log(``);

  if (env.isWSL) {
    console.log(`  ${c.boldCyan('WSL Network')}`);
    const mode = detectWslNetworkMode();
    console.log(`    Current mode: ${mode || 'unknown'}`);
    if (mode !== 'mirrored') {
      warn('Mirrored networking not active');
      info('Add to %USERPROFILE%\\.wslconfig:');
      console.log(``);
      console.log(buildWslConfig('mirrored').split('\n').map((l) => `    ${c.gray(l)}`).join('\n'));
      console.log(``);
      info('Then run: wsl --shutdown');
    } else {
      ok('WSL mirrored networking is active');
    }
  }

  console.log(`  ${c.boldCyan('Proxy')}`);
  const proxy = detectExistingProxy();
  console.log(`    Detected proxy: ${proxy.http_proxy || c.gray('none')}`);
  console.log(`    Scanning common ports: ${COMMON_PORTS.join(', ')}`);
  info('Port scanning requires net access; run "occier network test" for connectivity.');

  const config = await readConfig();
  config.networkConfigured = true;
  await writeConfig(config);
  ok('Network configuration saved');

  divider();
  console.log(``);
}

export async function testNetwork() {
  console.log(``);
  divider();
  console.log(`  ${c.boldWhite('Network Test')}`);
  console.log(``);

  const proxy = detectExistingProxy();
  if (proxy.http_proxy) {
    console.log(`  ${c.gray('Using proxy:')} ${proxy.http_proxy}`);
  } else {
    console.log(`  ${c.gray('No proxy configured (direct connection)')}`);
  }
  console.log(``);

  const results = await checkConnectivity();
  for (const r of results) {
    console.log(`  ${c.boldCyan('→')} ${r.name}`);
    console.log(`    URL:       ${c.gray(r.url)}`);
    console.log(`    DNS:       ${r.dns.pass ? c.green(`${r.dns.ms}ms`) : c.red('fail')}`);
    console.log(`    HTTP:      ${r.http.pass ? c.green(`${r.http.code} (${r.http.ms}ms)`) : c.red(`${r.http.error || r.http.code}`)}`);
    console.log(``);
  }

  console.log(`  ${c.boldCyan('Port Scan')}`);
  info('To check proxy ports, ensure node:net is available:');
  console.log(`    ${c.cyan('occier doctor')}`);
  console.log(``);

  divider();
  console.log(``);
}

export async function configureProxy() {
  const { input, select, password } = await import('@inquirer/prompts');

  console.log(``);
  divider();
  console.log(`  ${c.boldWhite('Proxy Configuration')}`);
  console.log(``);

  const protocol = await select({
    message: 'Proxy protocol:',
    choices: [
      { name: 'HTTP', value: 'http' },
      { name: 'SOCKS5', value: 'socks5' },
    ],
  });

  const host = await input({
    message: 'Proxy host:',
    default: '127.0.0.1',
  });

  const port = await input({
    message: 'Proxy port:',
    default: '10808',
    validate: (v) => !isNaN(parseInt(v)) || 'Must be a number',
  });

  const useAuth = await select({
    message: 'Authentication required?',
    choices: [
      { name: 'No', value: false },
      { name: 'Yes', value: true },
    ],
  });

  let username = '';
  let pw = '';
  if (useAuth) {
    username = await input({ message: 'Username:' });
    pw = await password({ message: 'Password:', mask: true });
  }

  const persist = await select({
    message: 'Apply to:',
    choices: [
      { name: 'Current session only', value: 'session' },
      { name: 'Shell rc file', value: 'shell' },
      { name: 'Both', value: 'both' },
    ],
  });

  if (persist === 'session' || persist === 'both') {
    const env = buildProxyEnv(protocol, host, parseInt(port), username, pw);
    Object.assign(process.env, env);
    ok('Applied to current session');
  }

  if (persist === 'shell' || persist === 'both') {
    const rcPath = await getRcPath();
    const block = buildShellRcBlock(protocol, host, parseInt(port), username, pw);
    await injectShellRc(rcPath, block);
    ok(`Written to ${rcPath}`);
    info(`Run: source ${rcPath.split('/').pop()}`);
  }

  divider();
  console.log(``);
}

export async function showMirrors() {
  console.log(``);
  divider();
  console.log(`  ${c.boldWhite('Mirror Registry')}`);
  console.log(``);

  for (const m of allMirrors()) {
    const status = m.enabled ? c.green('●') : c.gray('○');
    const official = m.official ? c.gray('(official)') : c.yellow('(mirror)');
    console.log(`  ${status} ${m.id.padEnd(20)} ${official} ${c.gray(m.baseUrl)}`);
  }

  divider();
  console.log(``);
}
