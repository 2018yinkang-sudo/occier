import { c, banner, ok, warn, fail, info, divider } from '../tui.mjs';
import { detectCapabilities } from '../../env/detect.mjs';
import { readConfig } from '../../schema/config.mjs';
import { createStore } from '../../store/credential-store.mjs';

export async function runDoctor() {
  banner();
  console.log(`  ${c.boldWhite('System Doctor')}`);
  console.log(``);

  const env = await detectCapabilities();
  let allOk = true;

  console.log(`  ${c.boldCyan('Environment')}`);
  console.log(`    OS:      ${env.os}`);
  console.log(`    Shell:   ${env.shell}`);

  if (env.node.installed) ok(`Node.js ${env.node.version}`);
  else { fail('Node.js not found'); allOk = false; }

  if (env.npm.installed) ok(`npm ${env.npm.version}`);
  else { warn('npm not found'); }

  if (env.git.installed) ok(`Git ${env.git.version}`);
  else { warn('Git not found'); }

  if (env.curl.installed) ok('curl');
  else warn('curl not found');

  console.log(``);
  console.log(`  ${c.boldCyan('Tools')}`);

  if (env.claude.installed) ok(`Claude Code ${env.claude.version || ''}`);
  else { fail('Claude Code not installed'); allOk = false; }

  if (env.opencode.installed) ok(`OpenCode ${env.opencode.version || ''}`);
  else info('OpenCode not installed (optional)');

  if (env.gh.installed) {
    if (env.gh.loggedIn) ok('GitHub CLI authenticated');
    else warn('GitHub CLI not logged in');
  } else warn('GitHub CLI not installed');

  console.log(``);
  console.log(`  ${c.boldCyan('Network')}`);

  const proxy = env.proxy;
  if (proxy.http_proxy) ok(`HTTP proxy: ${proxy.http_proxy}`);
  else warn('No HTTP proxy configured');

  if (proxy.https_proxy) ok(`HTTPS proxy: ${proxy.https_proxy}`);
  else warn('No HTTPS proxy configured');

  if (env.isWSL) {
    console.log(`    WSL mode: ${env.wslNetworkMode}`);
    if (env.wslNetworkMode !== 'mirrored') {
      warn('WSL not in mirrored mode — proxy configuration may not work');
    } else {
      ok('WSL mirrored networking');
    }
  }

  console.log(``);
  console.log(`  ${c.boldCyan('Credentials')}`);

  const store = createStore();
  const keys = await store.list();
  if (keys.length > 0) {
    ok(`${keys.length} credential(s) stored`);
    for (const k of keys) {
      info(`${k.key}: ${k.fingerprint}`);
    }
  } else {
    warn('No credentials configured');
  }

  const config = await readConfig();
  console.log(`    Config version: ${config.version}`);
  console.log(`    Network configured: ${config.networkConfigured ? c.green('yes') : c.yellow('no')}`);

  divider();

  if (allOk) {
    console.log(`  ${c.green('✓ All checks passed')}\n`);
  } else {
    console.log(`  ${c.yellow('! Some issues found')}\n`);
  }
}
