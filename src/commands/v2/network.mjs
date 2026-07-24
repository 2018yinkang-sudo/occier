import { c, ok, warn, fail, info, divider } from '../tui.mjs';
import { detectCapabilities, detectProxyEnv } from '../../env/detect.mjs';
import { run } from '../../exec/runner.mjs';
import { readConfig, writeConfig } from '../../schema/config.mjs';
import { URL } from 'url';

export async function showNetworkStatus() {
  const env = await detectCapabilities();

  console.log(``);
  divider();
  console.log(`  ${c.boldWhite('Network Status')}`);
  console.log(``);

  console.log(`  ${c.boldCyan('Platform')}`);
  console.log(`    OS:           ${env.os}${env.isWSL ? ` (WSL${env.wslVersion})` : ''}`);
  if (env.isWSL) {
    console.log(`    WSL mode:     ${env.wslNetworkMode}`);
  }

  console.log(``);
  console.log(`  ${c.boldCyan('Proxy')}`);
  const proxy = env.proxy;
  for (const [k, v] of Object.entries(proxy)) {
    console.log(`    ${k.padEnd(15)} ${v ? c.gray(v) : c.gray('not set')}`);
  }

  console.log(``);
  console.log(`  ${c.boldCyan('Connectivity')}`);

  const targets = [
    { name: 'GitHub', url: 'https://github.com' },
    { name: 'npm Registry', url: 'https://registry.npmjs.org' },
    { name: 'npm Official', url: 'https://www.npmjs.com' },
    { name: 'Google', url: 'https://www.google.com' },
  ];

  for (const t of targets) {
    const start = Date.now();
    const r = await run('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', '--connect-timeout', '5', t.url], { timeout: 8000 });
    const ms = Date.now() - start;
    if (r.exitCode === 0) {
      const color = ms < 200 ? c.green : ms < 500 ? c.yellow : c.red;
      ok(`${t.name.padEnd(20)} HTTP ${r.stdout} ${color(`${ms}ms`)}`);
    } else {
      fail(`${t.name.padEnd(20)} unreachable`);
    }
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

  const proxy = detectProxyEnv();
  if (env.isWSL) {
    console.log(`  ${c.boldCyan('WSL Network')}`);
    console.log(`    Current mode: ${env.wslNetworkMode}`);
    if (env.wslNetworkMode !== 'mirrored') {
      warn('Mirrored networking not active');
      info('Add to Windows %USERPROFILE%\\.wslconfig:');
      console.log(``);
      console.log(`    ${c.gray('[wsl2]')}`);
      console.log(`    ${c.gray('networkingMode=mirrored')}`);
      console.log(`    ${c.gray('autoProxy=true')}`);
      console.log(`    ${c.gray('dnsTunneling=true')}`);
      console.log(``);
      info('Then run: wsl --shutdown');
    } else {
      ok('WSL mirrored networking is active');
    }
  }

  console.log(`  ${c.boldCyan('Proxy')}`);
  const host = proxy.http_proxy ? new URL(proxy.http_proxy).hostname : '127.0.0.1';
  const port = proxy.http_proxy ? parseInt(new URL(proxy.http_proxy).port) : 10808;
  console.log(`    Detected proxy: ${proxy.http_proxy || c.gray('none')}`);
  console.log(`    Default host:   ${host}`);
  console.log(`    Default port:   ${port}`);
  console.log(``);
  info('To configure proxy, set environment variables:');
  console.log(`    ${c.cyan('export http_proxy=http://127.0.0.1:10808')}`);
  console.log(`    ${c.cyan('export https_proxy=http://127.0.0.1:10808')}`);
  console.log(``);
  info('Or run proxy_on if you have the proxy function in your shell rc.');
  console.log(``);

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

  const targets = [
    { name: 'GitHub', url: 'https://github.com' },
    { name: 'npm Registry', url: 'https://registry.npmjs.org' },
    { name: 'Google', url: 'https://www.google.com' },
  ];

  const proxy = detectProxyEnv();
  if (proxy.http_proxy) {
    console.log(`  ${c.gray('Using proxy:')} ${proxy.http_proxy}`);
  } else {
    console.log(`  ${c.gray('No proxy configured (direct connection)')}`);
  }
  console.log(``);

  for (const t of targets) {
    console.log(`  ${c.boldCyan('→')} ${t.name}`);
    console.log(`    URL: ${c.gray(t.url)}`);

    const start = Date.now();
    const r = await run('curl', ['-s', '-o', '/dev/null', '-w', `HTTP %{http_code} | %{time_total}s | %{speed_download}B/s`, '--connect-timeout', '5', t.url], { timeout: 10000 });
    const ms = Date.now() - start;

    if (r.exitCode === 0) {
      console.log(`    ${c.green('✓')} ${r.stdout}`);
    } else if (r.exitCode === -1) {
      console.log(`    ${c.red('✗')} Connection failed (command not found)`);
    } else {
      console.log(`    ${c.red('✗')} ${r.stderr || 'Connection failed'}`);
    }
    console.log(`    ${c.gray(`Time: ${ms}ms`)}`);
    console.log(``);
  }

  divider();
  console.log(``);
}
