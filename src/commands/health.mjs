import { checkClaudeInstalled, checkProvidersEnv, checkEnvFilePerms, checkConfigDirPerms, checkShellRcPath } from '../checks.mjs';
import { allProviders } from '../providers/registry.mjs';
import { checkProviderConnectivity } from '../checks.mjs';
import { c, divider } from '../tui.mjs';

async function spinner(text, fn) {
  process.stdout.write(`    ${c.gray('⏳')} ${text}...`);
  try {
    const result = await fn();
    process.stdout.write(`\r    ${result.pass ? c.green('✓') : result.pass === null ? c.gray('─') : c.red('✗')} ${text}\n`);
    return result;
  } catch (err) {
    process.stdout.write(`\r    ${c.red('✗')} ${text}\n`);
    return { pass: false, detail: err.message };
  }
}

export async function runHealthCheck() {
  console.log('');
  divider();
  console.log(`  ${c.boldWhite('Health Check')}`);
  console.log('');

  const claudeResult = await spinner('Claude Code installed', checkClaudeInstalled);
  if (!claudeResult.pass) {
    console.log(`        ${c.red('→ claude not found. Install: https://docs.anthropic.com/en/docs/claude-code')}\n`);
  } else {
    console.log(`        ${c.gray(`→ ${claudeResult.detail}`)}\n`);
  }

  const shellRc = await spinner('Shell config found', checkShellRcPath);
  console.log(`        ${c.gray(`→ ${shellRc.detail}`)}\n`);

  const envPerms = await spinner('providers.env permissions', checkEnvFilePerms);
  if (envPerms.pass === false) {
    console.log(`        ${c.yellow('→ Permissions should be 600')}\n`);
  } else if (envPerms.pass) {
    console.log(`        ${c.gray(`→ ${envPerms.detail}`)}\n`);
  } else {
    console.log(`        ${c.yellow('→ providers.env not yet created')}\n`);
  }

  const dirPerms = await spinner('Config directory permissions', checkConfigDirPerms);
  if (dirPerms.pass === false) {
    console.log(`        ${c.yellow('→ Permissions should be 700')}\n`);
  } else if (dirPerms.pass) {
    console.log(`        ${c.gray(`→ ${dirPerms.detail}`)}\n`);
  } else {
    console.log(`        ${c.yellow('→ config directory not yet created')}\n`);
  }

  console.log('');
  divider();
  console.log(`  ${c.boldWhite('Provider Connectivity')}`);
  console.log('');

  const provResults = await checkProvidersEnv();

  for (const p of allProviders()) {
    const provStatus = provResults[p.id];
    if (provStatus && provStatus.pass) {
      const netResult = await spinner(`  ${p.label} API`, () => checkProviderConnectivity(p.id));
      if (netResult.pass || netResult.pass === null) {
        console.log(`        ${c.gray(`→ ${netResult.detail}`)}\n`);
      } else {
        console.log(`        ${c.yellow('→ check your network or API key')}\n`);
      }
    } else {
      process.stdout.write(`    ${c.gray('○')}   ${p.label} API\n`);
      console.log(`        ${c.yellow('→ API key not configured')}\n`);
    }
  }

  divider();
  console.log('');
}
