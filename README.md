# occier — Claude Code Multi-Provider CLI

One command to switch Claude Code between DeepSeek, Kimi, and Anthropic providers.  
No config files to edit by hand. No env vars to remember.

## Quick Start

```bash
# Install
npm install -g github:2018yinkang-sudo/occier

# Run setup wizard
occier config

# Launch (interactive picker)
occier

# Launch directly
occier deepseek
occier kimi
occier anthropic
```

## Commands

| Command | Description |
|---|---|
| `occier` | Interactive provider picker → launch Claude Code |
| `occier deepseek` | Quick-launch with DeepSeek |
| `occier kimi` | Quick-launch with Kimi |
| `occier anthropic` | Quick-launch with Anthropic (API or claude.ai login) |
| `occier status` | Show configuration state |
| `occier health` | System health check + provider API connectivity |
| `occier config` | Interactive setup wizard |
| `occier config set-key` | Update a single API key |
| `occier config reset` | Delete all configuration |
| `occier config show` | Print config file paths and masked keys |
| `occier fix-path` | Add `~/.local/bin` to shell rc |
| `occier remove` | Full configuration cleanup |
| `occier --help` | Usage help |
| `occier --version` | Print version |

## How It Works

occier stores API keys in `~/.config/claude-code/providers.env` (permissions `600`).  
When you launch a provider, it sets the appropriate environment variables and spawns the `claude` CLI:

| Provider | Environment Override |
|---|---|
| DeepSeek | `ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic` |
| Kimi | `ANTHROPIC_BASE_URL=https://api.moonshot.cn/anthropic` |
| Anthropic | Native — uses `ANTHROPIC_API_KEY` or claude.ai OAuth login |

This works because Claude Code supports custom Anthropic-compatible API endpoints.

## Provider Details

### DeepSeek
- **Endpoint:** `https://api.deepseek.com/anthropic`
- **Models:** `deepseek-v4-pro[1m]` (default), `deepseek-v4-flash` (subagent)
- **Best for:** backend, architecture, debugging, refactoring
- **API key:** DeepSeek Platform → API Keys

### Kimi
- **Endpoint:** `https://api.moonshot.cn/anthropic`
- **Model:** `kimi-k3[1m]`
- **Best for:** frontend, design, visual, UI/UX
- **API key:** Kimi API Open Platform (NOT Kimi Code subscription key)

### Anthropic
- Official Claude API or claude.ai subscription login
- Set `ANTHROPIC_API_KEY_OFFICIAL` for API billing, or leave blank for OAuth login flow

## Configuration

```
~/.config/claude-code/
├── config.json       # occier state (tracking, preferences)
└── providers.env     # API keys (chmod 600)
```

## Prerequisites

- **Node.js** >= 20
- **Claude Code** CLI installed (`claude --version` must succeed)
- At least one provider API key

## Security

- API keys are stored with `600` permissions, config directory with `700`
- Never commit, screenshot, or share API keys
- `occier remove` wipes all config and PATH entries for a clean slate

## Troubleshooting

```bash
occier health       # Run system checks
occier status       # View current config
occier config reset # Wipe config and start over
```

## Uninstall

```bash
occier remove
npm uninstall -g occier
```

## License

MIT
