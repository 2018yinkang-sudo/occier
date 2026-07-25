import { spawn } from 'child_process';

export function clearProviderEnv(env) {
  const keys = [
    'ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL',
    'ANTHROPIC_MODEL', 'ANTHROPIC_DEFAULT_OPUS_MODEL', 'ANTHROPIC_DEFAULT_SONNET_MODEL',
    'ANTHROPIC_DEFAULT_HAIKU_MODEL', 'ANTHROPIC_DEFAULT_FABLE_MODEL',
    'CLAUDE_CODE_SUBAGENT_MODEL', 'CLAUDE_CODE_EFFORT_LEVEL',
    'CLAUDE_CODE_AUTO_COMPACT_WINDOW', 'ENABLE_TOOL_SEARCH',
    'OCCIER_PASSPHRASE',
  ];
  for (const k of keys) {
    delete env[k];
  }
}

export function applyProviderEnv(env, providerConfig) {
  for (const [k, v] of Object.entries(providerConfig)) {
    if (v !== undefined && v !== null) {
      env[k] = v;
    }
  }
}

export function launchClaude(providerEnvVars, passthroughArgs = null) {
  const env = { ...process.env };
  clearProviderEnv(env);
  applyProviderEnv(env, providerEnvVars);

  let args;
  if (passthroughArgs !== null) {
    // Explicit passthrough from the v2 dispatcher — never re-read process.argv,
    // otherwise occier's own subcommand/flags would leak into claude's prompt.
    args = passthroughArgs;
  } else {
    // Legacy v1 path: `occier <provider> [claude args...]`
    args = process.argv.slice(2);
    if (args.length > 0 && ['deepseek', 'kimi', 'anthropic'].includes(args[0])) {
      args.splice(0, 1);
    }
  }

  const child = spawn('claude', args, {
    stdio: 'inherit',
    env,
  });

  child.on('error', (err) => {
    if (err.code === 'ENOENT') {
      process.stderr.write(`\n\x1b[31mError:\x1b[0m claude is not installed.\n`);
      process.stderr.write(`Install it from: https://docs.anthropic.com/en/docs/claude-code/overview\n\n`);
    } else {
      process.stderr.write(`\n\x1b[31mError:\x1b[0m Failed to launch claude: ${err.message}\n\n`);
    }
    process.exit(1);
  });

  child.on('exit', (code, signal) => {
    process.exit(code ?? (signal ? 1 : 0));
  });
}
