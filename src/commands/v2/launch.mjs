import { c } from '../../tui.mjs';
import { hasCommand } from '../../exec/runner.mjs';
import { launchClaude } from '../../launch.mjs';
import { createStore } from '../../store/credential-store.mjs';
import { getProviderSafe } from '../../registry/providers.mjs';

export function filterLaunchArgs(args) {
  const passthrough = [];
  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--tool' || args[i] === '--provider') && args[i + 1]) {
      i++;
    } else if (args[i] === 'claude' || args[i] === 'opencode') {
      continue;
    } else {
      passthrough.push(args[i]);
    }
  }
  return passthrough;
}

export async function runLaunch(args) {
  let tool = 'claude';
  let providerId = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--tool' && args[i + 1]) {
      tool = args[i + 1];
      i++;
    } else if (args[i] === '--provider' && args[i + 1]) {
      providerId = args[i + 1];
      i++;
    } else if (!providerId && ['claude', 'opencode'].includes(args[i])) {
      tool = args[i];
    }
  }

  const installed = await hasCommand(tool);
  if (!installed) {
    console.error(`\n  ${c.red('Error:')} ${tool} is not installed.\n`);
    process.exit(1);
  }

  if (tool === 'claude') {
    const store = createStore();
    const entries = await store.list();

    if (!providerId) {
      const { select } = await import('@inquirer/prompts');
      const { allProviders } = await import('../../registry/providers.mjs');
      const configured = allProviders().filter((p) => {
        const hasKey = entries.some((e) => e.key === p.envVarName.toLowerCase());
        if (!hasKey) return false;
        // Claude Code speaks the Anthropic protocol, so vault model keys
        // with openai/gemini endpoints cannot be used directly here.
        if (p.source === "vault") return p.protocol === "anthropic";
        return true;
      });
      if (configured.length === 0) {
        console.error(`\n  ${c.red('Error:')} No providers configured. Run ${c.cyan('occier provider connect')} or add a model key in the vault.\n`);
        process.exit(1);
      }
      const chosen = await select({
        message: 'Select provider:',
        choices: configured.map((p) => ({
          name: `${p.label.padEnd(14)} ${p.description}`,
          value: p.id,
        })),
      });
      providerId = chosen;
    }

    const provider = getProviderSafe(providerId);
    if (!provider) {
      console.error(`\n  ${c.red('Error:')} Unknown provider: ${providerId}\n`);
      process.exit(1);
    }

    const envVars = await buildClaudeEnv(provider, store);
    if (!envVars) {
      console.error(
        `\n  ${c.red('Error:')} ${provider.label} 是 ${provider.protocol} 端点，不能直接用于 Claude Code。` +
        `请选择 anthropic 兼容端点，或用 ${c.cyan('opencode')} 启动。\n`,
      );
      process.exit(1);
    }

    console.log(`  Provider: ${c.cyan(provider.label)}  |  Model: ${c.gray(provider.defaultModel || 'default')}`);
    console.log(``);

    launchClaude(envVars, filterLaunchArgs(args));
  } else if (tool === 'opencode') {
    const store = createStore();
    const { allProviders } = await import('../../registry/providers.mjs');
    const { clearProviderEnv } = await import('../../launch.mjs');
    const envVars = { ...process.env };
    clearProviderEnv(envVars);

    if (!providerId) {
      const entries = await store.list();
      const configured = allProviders().filter((p) =>
        entries.some((e) => e.key === p.envVarName.toLowerCase()),
      );
      if (configured.length === 0) {
        console.error(`\n  ${c.red('Error:')} No providers configured. Run ${c.cyan('occier provider connect')} or add a model key in the vault.\n`);
        process.exit(1);
      }
      const { select } = await import('@inquirer/prompts');
      providerId = await select({
        message: 'Select provider:',
        choices: configured.map((p) => ({
          name: `${p.label.padEnd(14)} ${p.description}`,
          value: p.id,
        })),
      });
    }

    const provider = getProviderSafe(providerId);
    if (provider) {
      Object.assign(envVars, await buildOpenCodeEnv(provider, store));
    }

    console.log(`  ${c.cyan('Starting OpenCode...')}`);
    console.log(``);

    const { spawn } = await import('child_process');
    const child = spawn('opencode', [], { stdio: 'inherit', env: envVars });
    child.on('error', (err) => {
      console.error(`\n  ${c.red('Error:')} ${err.message}\n`);
      process.exit(1);
    });
    child.on('exit', (code) => {
      process.exit(code ?? 0);
    });
  }
}

// Resolve a provider + its stored credential into the env vars Claude Code
// needs. Returns null if the provider cannot be used with Claude Code (e.g. a
// vault model key whose endpoint is not anthropic-compatible).
async function buildClaudeEnv(provider, store) {
  if (provider.source === "vault") {
    if (provider.protocol !== "anthropic") return null;
    const entry = await store.get(provider.id);
    const apiKey = entry?.fields?.api_key || "";
    return {
      ANTHROPIC_BASE_URL: provider.baseURL,
      ANTHROPIC_AUTH_TOKEN: apiKey,
    };
  }

  // Builtin / user provider: key stored under envVarName as a string value.
  const providerData = await store.get(provider.envVarName.toLowerCase());
  const envVars = { ...provider.claudeEnv };
  if (providerData && providerData.value) {
    if (provider.id === "anthropic") envVars.ANTHROPIC_API_KEY = providerData.value;
    else envVars.ANTHROPIC_AUTH_TOKEN = providerData.value;
  }
  return envVars;
}

// Resolve a provider into env vars for OpenCode. Vault model keys set the
// protocol-appropriate standard env vars; builtin providers keep existing
// behavior (set envVarName to the stored value, looked up by envVarName).
async function buildOpenCodeEnv(provider, store) {
  if (provider.source === "vault") {
    const entry = await store.get(provider.id);
    const apiKey = entry?.fields?.api_key || "";
    const base = provider.baseURL || "";
    if (provider.protocol === "openai") {
      return { OPENAI_API_KEY: apiKey, OPENAI_BASE_URL: base };
    }
    if (provider.protocol === "anthropic") {
      return { ANTHROPIC_API_KEY: apiKey, ANTHROPIC_BASE_URL: base };
    }
    if (provider.protocol === "gemini") {
      return { GEMINI_API_KEY: apiKey };
    }
    return {};
  }
  const entry = await store.get(provider.envVarName.toLowerCase());
  const env = {};
  if (entry?.value) env[provider.envVarName] = entry.value;
  return env;
}
