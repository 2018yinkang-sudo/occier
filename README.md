# occier — AI Dev Environment Manager

3 分钟在新机器上完成网络、模型密钥、Claude Code、OpenCode 与 GitHub 的部署和配置，从统一 Dashboard 直接进入项目开发。

## Quick Start

```bash
# Install
npm install -g github:2018yinkang-sudo/occier

# Launch Dashboard
occier

# Quick setup
occier init
```

## How It Works

```
新机器 → 网络可用 → 凭证安全可用 → CC/OC 可用 → 项目规则就绪 → 开始开发
```

occier 是一层本地 AI 开发环境控制面，管理网络、凭证、模型提供商和开发工具的生命周期。

## Commands

| Command | Description |
|---------|-------------|
| `occier` | Dashboard — interactive environment overview |
| `occier init` | First-time setup wizard |
| `occier doctor` | Full system diagnostics with fix suggestions |
| `occier status` | Show configuration state |
| `occier network status` | Network configuration & connectivity |
| `occier network configure` | Configure proxy & WSL networking |
| `occier network test` | Test connectivity & latency |
| `occier vault list\|set\|remove` | Manage stored credentials |
| `occier provider list\|connect\|test` | Manage AI providers |
| `occier model list\|probe` | List & test available models |
| `occier group list\|use` | Switch model groups |
| `occier tool install\|update` | Install/update claude or opencode |
| `occier template list\|preview\|apply\|diff` | CLAUDE.md template management |
| `occier mirror list\|test\|switch\|restore` | Mirror registry management |
| `occier project create\|open` | Project management |
| `occier launch` | Launch claude/opencode with config |
| `occier health` | Legacy health checks |
| `occier config` | Legacy config wizard |

## Supported Providers (7 built-in)

- **DeepSeek** — backend, architecture, debugging
- **Kimi (Moonshot)** — frontend, design, visual
- **Anthropic** — official Claude API / claude.ai login
- **OpenAI** — GPT-4o, GPT-4o-mini
- **Zhipu (智谱)** — GLM-4, Chinese-optimized
- **OpenRouter** — multi-provider aggregator
- **OpenAI Compatible** — any OpenAI-compatible endpoint

Each provider comes with built-in model catalogs, connectivity probes, and secure credential management.

## Credential Vault

The vault stores typed credentials, encrypted with AES-256-GCM. Each type has its own field schema (shared by the Web UI and CLI), so adding a type only touches `src/store/credential-types.mjs`.

| Type | Fields | Notes |
|------|--------|-------|
| `model_key` | `endpoint_type`, `base_url`, `api_key`, `model?`, `label?` | Structured; acts as a user-defined provider |
| `api_key` | `value` | Generic API key |
| `github_token` | `value` | GitHub PAT |
| `proxy_password` | `value` | Proxy auth |
| `sudo_password` | `value` | Local sudo password |
| `other` | `value` | Any secret |

**Model keys** carry `base_url` + `api_key` + `endpoint_type` and you name them yourself. They appear in the provider list and can be launched directly (`occier <name>`). Endpoint types:

- `anthropic` — `POST {base_url}/v1/messages` (Anthropic, DeepSeek, Kimi)
- `openai` — `POST {base_url}/v1/chat/completions` (OpenAI, 智谱, 通义千问/DashScope, OpenRouter, and most Chinese providers via OpenAI-compatible endpoints)
- `gemini` — Google Gemini native

Built-in presets (DeepSeek, Kimi, 智谱, 通义千问, OpenAI, Anthropic, OpenRouter, Gemini, OpenAI-compatible, Custom) auto-fill `endpoint_type` + `base_url`. Mainland Chinese providers are predominantly OpenAI-compatible — select the **OpenAI 兼容** preset and fill `base_url` per the vendor's docs.

**Consumption**: launching Claude Code with an `anthropic`-protocol model key sets `ANTHROPIC_BASE_URL` + `ANTHROPIC_AUTH_TOKEN`. `openai`/`gemini` keys cannot drive Claude Code directly (use `opencode`). Only the provider you select at launch is activated, so multiple model keys never conflict.

**Security**: the HTTP API never returns plaintext (no reveal endpoint); plaintext is only available via `occier vault get <key> --reveal` (stderr). Deletion requires typing the key name. The server binds to `127.0.0.1` only.

```bash
occier vault set          # type-aware: pick type → fill type-specific fields
occier vault list         # shows type + endpoint + masked fingerprint
occier vault get <key> --reveal   # plaintext to stderr (CLI only)
occier vault remove <key>
occier vault passphrase set       # protect vault with a passphrase
```

## Network Configuration

For **China mainland** and **WSL** users:

```bash
occier network configure   # WSL mirrored mode + proxy setup
occier network test        # Test DNS + HTTP connectivity
occier mirror switch npm   # Auto-switch to fastest npm mirror
```

Proxy supports: HTTP, HTTPS, SOCKS5/SOCKS5H. Configuration applies to Occier itself, Git, npm, pip, APT, and proxychains. All modifications use controlled blocks and are fully revertible.

## Security

- API keys stored in encrypted vault (`~/.config/occier/vault.enc`, AES-256-GCM)
- Keys never appear in CLI arguments, logs, project files, or Git history
- TUI always shows masked credentials (`sk-a****b12c`)
- Subprocess injection only (env vars), never plaintext in config files
- GitHub prefers `gh auth login` OAuth over stored PATs

## Configuration Directory

```
~/.config/occier/
├── config.json          # Global configuration
├── vault.enc            # Encrypted credential store (AES-256-GCM)
├── projects.json        # Saved projects
├── user-providers.json  # Custom provider definitions
├── backups/             # Auto-backups for WSL config, templates
└── logs/                # Sanitized diagnostic logs
```

## Prerequisites

- **Node.js** >= 20
- **Claude Code** or **OpenCode** (auto-detect, guided install)

## Uninstall

```bash
occier remove
npm uninstall -g occier
```

## License

MIT
