# ociier — Claude Code Multi-Provider CLI

OpenClaw-style interactive CLI for Claude Code with DeepSeek, Kimi, and Anthropic providers. One command: `occier`.

## Quick Start

```bash
# Install globally
npm install -g github:2018yinkang-sudo/occier

# Run setup wizard
occier config

# Launch with interactive provider selection
occier

# Or pick a provider directly
occier deepseek
occier kimi
occier anthropic
```

## Commands

| Command | Description |
|---------|-------------|
| `occier` | Interactive provider selection → launch Claude Code |
| `occier deepseek` | Quick-launch with DeepSeek |
| `occier kimi` | Quick-launch with Kimi |
| `occier anthropic` | Quick-launch with Anthropic |
| `occier status` | Show current configuration |
| `occier health` | Run system & provider health checks |
| `occier config` | Interactive setup wizard |
| `occier config set-key` | Update a specific API key |
| `occier config reset` | Reset all configuration |
| `occier config show` | Show config file locations & keys |
| `occier remove` | Remove all configuration |

## Directory Structure

```text
occier/
├── package.json
├── bin/
│   └── occier.mjs            # Entry point
├── src/
│   ├── cli.mjs               # CLI routing
│   ├── tui.mjs               # Terminal UI helpers
│   ├── paths.mjs             # Path resolution
│   ├── config-io.mjs         # Config read/write
│   ├── launch.mjs            # Claude Code launcher
│   ├── checks.mjs            # Health checks
│   ├── providers/
│   │   └── registry.mjs      # Provider definitions
│   └── commands/
│       ├── select.mjs         # Interactive selection
│       ├── launch.mjs         # Direct launch
│       ├── status.mjs         # Config display
│       ├── health.mjs         # Health checks
│       ├── setup-wizard.mjs   # Config wizard
│       └── remove.mjs         # Cleanup
├── config/
│   └── providers.env.example
├── CLAUDE.md
└── README.md
```

## Configuration

Configuration is stored at `~/.config/claude-code/`:

- `config.json` — ociier state
- `providers.env` — API keys (permissions: 600)

## Prerequisites

- Node.js >= 18
- Claude Code installed: `claude --version`

## Provider Details

### DeepSeek
- Endpoint: `https://api.deepseek.com/anthropic`
- Model: `deepseek-v4-pro[1m]` / `deepseek-v4-flash`
- Best for: backend, architecture, debugging, refactoring

### Kimi
- Endpoint: `https://api.moonshot.cn/anthropic`
- Model: `kimi-k3[1m]`
- Best for: frontend, design, visual, UI/UX
- **Note:** Use Kimi API Open Platform key, NOT Kimi Code subscription key

### Anthropic
- Official Claude API or claude.ai login
- Set `ANTHROPIC_API_KEY_OFFICIAL` for API billing, or leave blank for login flow

## Security

- `providers.env` stores real API keys — permissions always 600
- Never commit, screenshot, or share API keys
- Do not sync config directory to cloud storage
- Use `occier remove` for complete cleanup

## Troubleshooting

```bash
# Check system health
occier health

# View current config
occier status

# Reset and start fresh
occier config reset
occier health
```

## Uninstall

```bash
occier remove
npm uninstall -g ociier
```
