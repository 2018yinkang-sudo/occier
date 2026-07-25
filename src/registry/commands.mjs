// Command registry — maps command names to lazy-imported handlers
// The route() function in cli.mjs uses this to dispatch commands

const COMMANDS = [
  {
    name: "init",
    help: "First-time setup wizard",
    modulePath: "../commands/v2/init.mjs",
    exportName: "runInit",
  },
  {
    name: "doctor",
    help: "System diagnostics & repair",
    modulePath: "../commands/v2/doctor.mjs",
    exportName: "runDoctor",
  },
  {
    name: "status",
    help: "Show environment status",
    modulePath: "../commands/status.mjs",
    exportName: "showStatus",
  },
  {
    name: "network",
    help: "Network configuration & testing",
    modulePath: "../commands/v2/network.mjs",
    subCommands: {
      configure: { modulePath: "../commands/v2/network.mjs", exportName: "configureNetwork", help: "Configure proxy & mirrors" },
      test: { modulePath: "../commands/v2/network.mjs", exportName: "testNetwork", help: "Test connectivity & latency" },
      proxy: { modulePath: "../commands/v2/network.mjs", exportName: "configureProxy", help: "Set up proxy" },
      mirror: { modulePath: "../commands/v2/network.mjs", exportName: "showMirrors", help: "List mirrors" },
    },
  },
  {
    name: "vault",
    help: "Manage stored credentials",
    modulePath: "../commands/v2/vault.mjs",
    subCommands: {
      list: { modulePath: "../commands/v2/vault.mjs", exportName: "vaultList", help: "List stored credentials" },
      set: { modulePath: "../commands/v2/vault.mjs", exportName: "vaultSet", help: "Store a credential" },
      remove: { modulePath: "../commands/v2/vault.mjs", exportName: "vaultRemove", help: "Remove a credential" },
    },
  },
  {
    name: "provider",
    help: "Configure API providers",
    modulePath: "../commands/v2/provider.mjs",
    subCommands: {
      list: { modulePath: "../commands/v2/provider.mjs", exportName: "providerList", help: "List available providers" },
      connect: { modulePath: "../commands/v2/provider.mjs", exportName: "providerConnect", help: "Configure a provider" },
      test: { modulePath: "../commands/v2/provider.mjs", exportName: "providerTest", help: "Test provider connectivity" },
    },
  },
  {
    name: "tool",
    help: "Install/update development tools",
    modulePath: "../commands/v2/tools.mjs",
    subCommands: {
      install: { modulePath: "../commands/v2/tools.mjs", exportName: "installTool", args: ["tool"], help: "Install claude/opencode" },
      update: { modulePath: "../commands/v2/tools.mjs", exportName: "updateTool", args: ["tool"], help: "Update claude/opencode" },
    },
  },
  {
    name: "project",
    help: "Manage projects",
    modulePath: "../commands/v2/project.mjs",
    subCommands: {
      create: { modulePath: "../commands/v2/project.mjs", exportName: "projectCreate", help: "Create a new project" },
      open: { modulePath: "../commands/v2/project.mjs", exportName: "projectOpen", help: "Open an existing project" },
    },
  },
  {
    name: "group",
    help: "Select model groups",
    modulePath: "../commands/v2/group.mjs",
    subCommands: {
      list: { modulePath: "../commands/v2/group.mjs", exportName: "groupList", help: "List model groups" },
      use: { modulePath: "../commands/v2/group.mjs", exportName: "groupUse", help: "Select a model group" },
    },
  },
  {
    name: "model",
    help: "List/probe available models",
    modulePath: "../commands/v2/group.mjs",
    subCommands: {
      list: { modulePath: "../commands/v2/group.mjs", exportName: "modelList", help: "List available models" },
      probe: { modulePath: "../commands/v2/group.mjs", exportName: "modelProbe", help: "Test model availability" },
    },
  },
  {
    name: "launch",
    help: "Launch Claude Code or OpenCode",
    modulePath: "../commands/v2/launch.mjs",
    exportName: "runLaunch",
  },
  {
    name: "health",
    help: "Run system & provider health checks",
    modulePath: "../commands/health.mjs",
    exportName: "runHealthCheck",
  },
  {
    name: "config",
    help: "Configuration management",
    modulePath: "../commands/setup-wizard.mjs",
    subCommands: {
      "set-key": { modulePath: "../commands/setup-wizard.mjs", exportName: "setKey", help: "Update a specific API key" },
      reset: { modulePath: "../commands/setup-wizard.mjs", exportName: "resetConfig", help: "Reset all configuration" },
      show: { modulePath: "../commands/setup-wizard.mjs", exportName: "showConfig", help: "Show config file locations" },
    },
  },
  {
    name: "remove",
    help: "Remove all configuration and cleanup",
    modulePath: "../commands/remove.mjs",
    exportName: "runRemove",
  },
  {
    name: "fix-path",
    help: "Auto-configure PATH for new terminals",
    modulePath: "../commands/fix-path.mjs",
    exportName: "fixPath",
  },
  {
    name: "mirror",
    help: "Manage package mirrors",
    modulePath: null,
    subCommands: {
      list: { modulePath: "../commands/v2/network.mjs", exportName: "showMirrors", help: "List available mirrors" },
      test: { modulePath: "../mirrors/speedtest.mjs", exportName: "testAllMirrors", help: "Test mirror latency" },
      switch: { modulePath: "../mirrors/speedtest.mjs", exportName: "autoSwitchMirror", args: ["scope"], help: "Auto-switch to fastest mirror" },
      restore: { modulePath: "../mirrors/speedtest.mjs", exportName: "restoreOfficialMirror", args: ["scope"], help: "Restore official mirrors" },
    },
  },
  {
    name: "template",
    help: "Manage CLAUDE.md templates",
    modulePath: null,
    subCommands: {
      list: { modulePath: "../tools/claude/templates.mjs", exportName: "allTemplates", help: "List templates" },
      preview: { modulePath: "../tools/claude/templates.mjs", exportName: "getTemplate", args: ["id"], help: "Preview a template" },
      apply: { modulePath: "../tools/claude/template-manager.mjs", exportName: "safeApplyTemplate", args: ["id", "path"], help: "Apply a template" },
      diff: { modulePath: "../tools/claude/template-manager.mjs", exportName: "diffTemplate", args: ["id", "path"], help: "Diff template against existing" },
    },
  },
];

export function lookupCommand(cmd) {
  return COMMANDS.find((c) => c.name === cmd) ?? null;
}

export function lookupSubCommand(cmd, sub) {
  const entry = lookupCommand(cmd);
  if (!entry || !entry.subCommands) return null;
  return entry.subCommands[sub] ?? null;
}

export function listCommands() {
  return COMMANDS.filter((c) => !c.hidden);
}
