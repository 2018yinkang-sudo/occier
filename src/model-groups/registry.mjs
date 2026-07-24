const BUILTIN_GROUPS = [
  {
    id: "balanced",
    label: "Balanced",
    description: "Default balanced configuration for general coding tasks",
    provider: "deepseek",
    models: {
      primary: "deepseek-v4-pro[1m]",
      reasoning: "deepseek-v4-pro[1m]",
      fast: "deepseek-v4-flash",
      subagent: "deepseek-v4-flash",
    },
    extraEnv: { CLAUDE_CODE_EFFORT_LEVEL: "max" },
  },
  {
    id: "maximum",
    label: "Maximum",
    description: "Maximum power for complex reasoning and architecture",
    provider: "deepseek",
    models: {
      primary: "deepseek-v4-pro[1m]",
      reasoning: "deepseek-v4-pro[1m]",
      fast: "deepseek-v4-pro[1m]",
      subagent: "deepseek-v4-pro[1m]",
    },
    extraEnv: { CLAUDE_CODE_EFFORT_LEVEL: "max" },
  },
  {
    id: "economy",
    label: "Economy",
    description: "Fast, low-cost model for quick questions",
    provider: "deepseek",
    models: {
      primary: "deepseek-v4-flash",
      reasoning: "deepseek-v4-flash",
      fast: "deepseek-v4-flash",
      subagent: "deepseek-v4-flash",
    },
    extraEnv: { CLAUDE_CODE_EFFORT_LEVEL: "fast" },
  },
  {
    id: "frontend",
    label: "Frontend",
    description: "Frontend-focused: UI, CSS, design review",
    provider: "kimi",
    models: {
      primary: "kimi-k3[1m]",
      reasoning: "kimi-k3[1m]",
      fast: "kimi-k3[1m]",
      subagent: "kimi-k3[1m]",
    },
    extraEnv: { CLAUDE_CODE_EFFORT_LEVEL: "max" },
  },
  {
    id: "custom",
    label: "Custom",
    description: "User-customizable group (configure via occier group)",
    provider: "anthropic",
    models: {
      primary: null,
      reasoning: null,
      fast: null,
      subagent: null,
    },
    extraEnv: {},
  },
];

const _groups = new Map();

for (const g of BUILTIN_GROUPS) {
  _groups.set(g.id, { ...g });
}

export function getGroup(id) {
  const g = _groups.get(id);
  if (!g) throw new Error(`Unknown model group: ${id}`);
  return g;
}

export function getGroupSafe(id) {
  return _groups.get(id) ?? null;
}

export function allGroups() {
  return Array.from(_groups.values());
}

export function groupChoices() {
  return allGroups().map((g) => ({
    name: `${g.label.padEnd(14)} ${g.description}`,
    value: g.id,
  }));
}

export function setGroupConfig(id, overrides) {
  const g = _groups.get(id);
  if (!g) return false;
  Object.assign(g, overrides);
  return true;
}
