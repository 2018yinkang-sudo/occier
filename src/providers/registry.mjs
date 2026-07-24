const PROVIDERS = {
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek',
    description: 'Backend, architecture, debugging, refactoring',
    envVar: 'DEEPSEEK_API_KEY',
    env: {
      ANTHROPIC_BASE_URL: 'https://api.deepseek.com/anthropic',
      ANTHROPIC_MODEL: 'deepseek-v4-pro[1m]',
      ANTHROPIC_DEFAULT_OPUS_MODEL: 'deepseek-v4-pro[1m]',
      ANTHROPIC_DEFAULT_SONNET_MODEL: 'deepseek-v4-pro[1m]',
      ANTHROPIC_DEFAULT_HAIKU_MODEL: 'deepseek-v4-flash',
      CLAUDE_CODE_SUBAGENT_MODEL: 'deepseek-v4-flash',
      CLAUDE_CODE_EFFORT_LEVEL: 'max',
    },
    healthUrl: 'https://api.deepseek.com/anthropic/v1/messages',
  },
  kimi: {
    id: 'kimi',
    label: 'Kimi',
    description: 'Frontend, design, visual, UI/UX',
    envVar: 'KIMI_API_KEY',
    env: {
      ANTHROPIC_BASE_URL: 'https://api.moonshot.cn/anthropic',
      ANTHROPIC_MODEL: 'kimi-k3[1m]',
      ANTHROPIC_DEFAULT_OPUS_MODEL: 'kimi-k3[1m]',
      ANTHROPIC_DEFAULT_SONNET_MODEL: 'kimi-k3[1m]',
      ANTHROPIC_DEFAULT_HAIKU_MODEL: 'kimi-k3[1m]',
      ANTHROPIC_DEFAULT_FABLE_MODEL: 'kimi-k3[1m]',
      CLAUDE_CODE_SUBAGENT_MODEL: 'kimi-k3[1m]',
      CLAUDE_CODE_EFFORT_LEVEL: 'max',
      ENABLE_TOOL_SEARCH: 'false',
      CLAUDE_CODE_AUTO_COMPACT_WINDOW: '1048576',
    },
    healthUrl: 'https://api.moonshot.cn/anthropic/v1/messages',
  },
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic',
    description: 'Official Claude API / claude.ai login',
    envVar: 'ANTHROPIC_API_KEY_OFFICIAL',
    env: {},
    healthUrl: null,
  },
};

export function getProvider(id) {
  const p = PROVIDERS[id];
  if (!p) throw new Error(`Unknown provider: ${id}`);
  return p;
}

export function allProviders() {
  return Object.values(PROVIDERS);
}

export function providerChoices() {
  return Object.values(PROVIDERS).map(p => ({
    name: `${p.label.padEnd(14)} ${p.description}`,
    value: p.id,
  }));
}
