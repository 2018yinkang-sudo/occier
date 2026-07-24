import { Registry } from "./base.mjs";

const BUILTIN_PROVIDERS = [
  {
    id: "deepseek",
    label: "DeepSeek",
    description: "Backend, architecture, debugging, refactoring",
    protocol: "anthropic",
    authType: "api_key",
    envVarName: "DEEPSEEK_API_KEY",
    baseURL: "https://api.deepseek.com/anthropic",
    healthUrl: "https://api.deepseek.com/anthropic/v1/messages",
    models: [
      { id: "deepseek-v4-pro[1m]", name: "DeepSeek Pro", context: 128000, output: 8192 },
      { id: "deepseek-v4-flash", name: "DeepSeek Flash", context: 128000, output: 8192 },
    ],
    defaultModel: "deepseek-v4-pro[1m]",
    claudeEnv: {
      ANTHROPIC_BASE_URL: "https://api.deepseek.com/anthropic",
      ANTHROPIC_MODEL: "deepseek-v4-pro[1m]",
      ANTHROPIC_DEFAULT_OPUS_MODEL: "deepseek-v4-pro[1m]",
      ANTHROPIC_DEFAULT_SONNET_MODEL: "deepseek-v4-pro[1m]",
      ANTHROPIC_DEFAULT_HAIKU_MODEL: "deepseek-v4-flash",
      CLAUDE_CODE_SUBAGENT_MODEL: "deepseek-v4-flash",
      CLAUDE_CODE_EFFORT_LEVEL: "max",
    },
  },
  {
    id: "kimi",
    label: "Kimi",
    description: "Frontend, design, visual, UI/UX",
    protocol: "anthropic",
    authType: "api_key",
    envVarName: "KIMI_API_KEY",
    baseURL: "https://api.moonshot.cn/anthropic",
    healthUrl: "https://api.moonshot.cn/anthropic/v1/messages",
    models: [
      { id: "kimi-k3[1m]", name: "Kimi K3", context: 128000, output: 8192 },
    ],
    defaultModel: "kimi-k3[1m]",
    claudeEnv: {
      ANTHROPIC_BASE_URL: "https://api.moonshot.cn/anthropic",
      ANTHROPIC_MODEL: "kimi-k3[1m]",
      ANTHROPIC_DEFAULT_OPUS_MODEL: "kimi-k3[1m]",
      ANTHROPIC_DEFAULT_SONNET_MODEL: "kimi-k3[1m]",
      ANTHROPIC_DEFAULT_HAIKU_MODEL: "kimi-k3[1m]",
      ANTHROPIC_DEFAULT_FABLE_MODEL: "kimi-k3[1m]",
      CLAUDE_CODE_SUBAGENT_MODEL: "kimi-k3[1m]",
      CLAUDE_CODE_EFFORT_LEVEL: "max",
      ENABLE_TOOL_SEARCH: "false",
      CLAUDE_CODE_AUTO_COMPACT_WINDOW: "1048576",
    },
  },
  {
    id: "anthropic",
    label: "Anthropic",
    description: "Official Claude API / claude.ai login",
    protocol: "anthropic",
    authType: "api_key",
    envVarName: "ANTHROPIC_API_KEY_OFFICIAL",
    baseURL: "",
    healthUrl: null,
    models: [],
    defaultModel: null,
    claudeEnv: {},
  },
  {
    id: "openai",
    label: "OpenAI",
    description: "GPT-4o, GPT-4o-mini, o-series models",
    protocol: "openai",
    authType: "api_key",
    envVarName: "OPENAI_API_KEY",
    baseURL: "https://api.openai.com/v1",
    healthUrl: "https://api.openai.com/v1/models",
    models: [
      { id: "gpt-4o", name: "GPT-4o", context: 128000, output: 16384 },
      { id: "gpt-4o-mini", name: "GPT-4o Mini", context: 128000, output: 16384 },
    ],
    defaultModel: "gpt-4o",
    claudeEnv: {
      ANTHROPIC_BASE_URL: "https://api.openai.com/v1",
      ANTHROPIC_AUTH_TOKEN: "",
    },
  },
  {
    id: "zhipu",
    label: "Zhipu AI",
    description: "GLM-4 series, Chinese-optimized",
    protocol: "openai",
    authType: "api_key",
    envVarName: "ZHIPU_API_KEY",
    baseURL: "https://open.bigmodel.cn/api/paas/v4",
    healthUrl: null,
    models: [
      { id: "glm-4", name: "GLM-4", context: 128000, output: 4096 },
      { id: "glm-4-flash", name: "GLM-4 Flash", context: 128000, output: 4096 },
    ],
    defaultModel: "glm-4",
    claudeEnv: {},
  },
];

const providerRegistry = new Registry();

for (const p of BUILTIN_PROVIDERS) {
  providerRegistry.register(p.id, p);
}

export function getProvider(id) {
  return providerRegistry.get(id);
}

export function getProviderSafe(id) {
  return providerRegistry.tryGet(id);
}

export function allProviders() {
  return providerRegistry.list();
}

export function providerChoices() {
  return allProviders().map((p) => ({
    name: `${p.label.padEnd(14)} ${p.description}`,
    value: p.id,
  }));
}

export { providerRegistry };
