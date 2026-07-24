# Occier V2 开发计划

> 定位：在中国大陆新机器、Windows + WSL 或常规 Linux 环境中，3 分钟完成网络、模型密钥、Claude Code、OpenCode 与 GitHub 的部署和配置，并从统一 TUI 直接进入项目开发。

## 1. 产品定义

Occier 不是 Claude Code 或 OpenCode 的替代品，也不是通用 IDE。

Occier 是一层本地 AI 开发环境控制面：

```text
新机器
  ↓
网络可用
  ↓
凭证安全可用
  ↓
Claude Code / OpenCode 可用
  ↓
项目规则与模型组就绪
  ↓
直接开始开发
```

核心成功指标：

- 首次安装后 3 分钟内完成基础配置。
- 用户不需要手工修改 `.bashrc`、`.profile` 或复制环境变量。
- API Key、GitHub Token 不出现在命令参数、日志、项目文件或 Git 历史中。
- 用户可在 TUI 中看到网络、Provider、模型和开发工具的实时可用状态。
- 新建或进入项目后，可直接启动 `claude` 或 `opencode`。

## 2. V2 范围

### 2.1 必须完成

| 模块 | V2 能力 |
|---|---|
| 环境识别 | Windows、WSL、Linux、Shell、Node、npm、Git 检测 |
| 网络配置 | WSL 代理、环境变量代理、Git/npm/pip/APT 镜像与代理 |
| 网络监控 | 端口、DNS、GitHub、npm、模型 API 的延迟和连通性 |
| 密钥管理 | 模型 API Key、GitHub Token 的安全保存、更新、删除和脱敏展示 |
| Model Connector | 内置 Provider、模型目录、密钥检测、模型可用性检测 |
| Claude Code | 检测、安装、升级、动态注入凭证、模型组、`CLAUDE.md` 模板 |
| OpenCode | 检测、安装、升级、Provider 密钥配置、直接启动 |
| 项目入口 | 新建项目、打开已有项目、选择工具与模型组后启动 |
| Doctor | 完整环境诊断、风险提示、可逆修复 |
| CLI | TUI 之外提供可脚本化的核心命令 |

### 2.2 暂不完成

- 云端账户和配置同步
- 团队权限管理
- Provider 插件市场
- MCP 全量管理
- IDE 图形界面
- 自动购买、充值或创建第三方账号
- 自动修改宿主机代理软件
- 远程代码执行平台

## 3. 总体架构

```text
┌──────────────────── Occier TUI / CLI ────────────────────┐
│ Dashboard │ Network │ Vault │ Providers │ Tools │ Project │
└──────────────────────────┬────────────────────────────────┘
                           │
┌──────────────────── Service Layer ─────────────────────────┐
│ Environment │ Network │ Credential │ Connector │ Tool      │
│ Model Group │ Template │ Project │ Doctor │ Process        │
└──────────────────────────┬────────────────────────────────┘
                           │
┌──────────────────── Adapter Layer ─────────────────────────┐
│ WSL/Windows │ Shell │ Git │ npm │ APT │ pip │ Claude Code  │
│ OpenCode │ GitHub │ DeepSeek │ Kimi │ Anthropic │ Custom   │
└────────────────────────────────────────────────────────────┘
```

原则：

1. TUI、CLI 不包含核心业务逻辑。
2. Provider、开发工具、网络目标均通过 Registry 注册。
3. 所有系统修改必须可预览、备份、执行、回滚。
4. 所有外部命令必须有超时、退出码和脱敏日志。
5. 供应商模型名称不得散落硬编码，应由可更新目录管理。

## 4. 模块计划

### 4.1 Bootstrap：环境识别与首次启动

首次启动执行只读扫描：

- 操作系统与版本
- 是否处于 WSL
- WSL 版本和网络模式
- 当前 Shell
- Node.js、npm、Git、curl、PowerShell 可用性
- Claude Code、OpenCode、GitHub CLI 安装状态
- 当前代理环境变量
- Git、npm、pip、APT 代理和镜像配置
- 已存在的 Occier 配置和旧版迁移状态

输出统一状态：

```text
PASS      已满足
WARNING   可用但存在风险
ERROR     阻塞使用
UNKNOWN   无法确定
```

首次向导：

```text
环境扫描
  → 网络配置
  → 密钥仓库
  → Provider
  → Claude Code / OpenCode
  → GitHub
  → 默认模型组
  → 默认 CLAUDE.md
  → 完成验证
```

### 4.2 Network：网络配置与监控

#### A. WSL 网络模式

优先检测并推荐：

```ini
[wsl2]
networkingMode=mirrored
autoProxy=true
dnsTunneling=true
```

要求：

- 读取 Windows `%USERPROFILE%\.wslconfig`
- 检测 Windows 与 WSL 版本是否支持
- 修改前展示差异并创建备份
- 明确提示执行 `wsl --shutdown`
- 重启后重新验证
- mirrored 不可用时提供 NAT 兼容方案

不能假设 WSL 中 `127.0.0.1` 一定可访问宿主机；必须基于当前模式和端口探测判断。

#### B. 代理配置

支持：HTTP、HTTPS、SOCKS5/SOCKS5H、Windows 系统代理继承、手动 Host + Port、TUN 状态说明。

配置范围：

- 当前 Occier 子进程
- 当前 Shell 会话
- Shell 持久配置
- Git
- npm
- pip
- APT
- proxychains4

默认策略：

- Occier 自身和其子进程优先动态注入，不污染全局环境。
- 永久修改必须由用户显式选择。
- 修改 `.bashrc`、`.zshrc` 时使用受控配置块，禁止重复追加。

```text
# >>> occier proxy >>>
...
# <<< occier proxy <<<
```

#### C. 国内镜像

建立可更新的 Mirror Registry，至少覆盖：

- npm registry
- Node.js 下载源
- pip index
- Ubuntu/Debian APT 镜像
- GitHub 文件下载加速地址，仅作为可选兼容方案

每个镜像记录：

```text
id / scope / baseUrl / region / official / enabled
lastCheckedAt / latency / status
```

默认优先官方源；网络受限时再推荐镜像。第三方镜像不能被视为永久可信。

#### D. 连通性与延迟面板

| 层级 | 检测 |
|---|---|
| L1 | 代理端口是否监听 |
| L2 | DNS 是否解析 |
| L3 | TCP/TLS 是否建立 |
| L4 | HTTP 状态和耗时 |
| L5 | API 鉴权是否成功 |
| L6 | 指定模型最小请求是否成功 |

目标至少包括 GitHub、npm Registry、Claude Code/OpenCode 安装源、各 Provider API 和用户自定义地址。

监控应按需或低频刷新，不能持续消耗模型额度。

### 4.3 Vault：统一密钥管理

管理对象：Provider API Key、GitHub PAT、GitHub CLI 登录状态和后续代理认证信息。

安全要求：

1. 不通过 CLI 参数传递密钥。
2. 不把密钥写入项目 `.env`。
3. 不把密钥写入 `CLAUDE.md`、OpenCode 项目配置或日志。
4. TUI 输入使用 Secret Input。
5. 展示只显示脱敏指纹。
6. 错误、诊断报告和遥测统一脱敏。
7. 子进程按需注入，进程结束后失效。
8. Occier 不将密钥发送到自有服务器。

存储优先级：

```text
系统密钥库
  ↓ 不可用
本地加密 Vault
  ↓ 最小兼容
权限 600 的私有凭证文件
```

必须抽象 `CredentialStore`，为 Windows Credential Manager、macOS Keychain、Linux Secret Service 和加密文件预留后端。

GitHub 优先使用 `gh auth login` / GitHub CLI 凭证，不默认保存高权限 PAT。

### 4.4 Provider 与 Model Connector

Connector 负责 Provider 元数据、Base URL、鉴权方式、模型目录、Claude Code 环境映射、OpenCode 配置映射、连通性检测、鉴权检测、模型探测和错误分类。

首批 Provider：

- Anthropic
- DeepSeek
- Kimi / Moonshot
- OpenRouter
- 自定义 Anthropic Compatible
- 自定义 OpenAI Compatible

```ts
interface ProviderConnector {
  id: string;
  metadata: ProviderMetadata;
  listModels(context: ConnectorContext): Promise<ModelRecord[]>;
  validateCredential(secretRef: SecretRef): Promise<CredentialCheck>;
  probeModel(modelId: string, secretRef: SecretRef): Promise<ModelProbe>;
  buildClaudeEnvironment(profile: ModelProfile): Promise<NodeJS.ProcessEnv>;
  buildOpenCodeConfig(profile: ModelProfile): Promise<OpenCodeProviderConfig>;
}
```

模型状态：

```text
AVAILABLE / AUTH_FAILED / UNAVAILABLE / RATE_LIMITED
NO_BALANCE / NETWORK_ERROR / UNKNOWN
```

检测策略：保存密钥时鉴权；选择模型时发起最小请求；启动前仅在缓存过期时重检；必须显示最后检测时间。

### 4.5 Claude Code 管理

能力：检测、版本识别、安装、升级、启动、Provider 选择、模型组、项目/用户级 `CLAUDE.md`、环境冲突诊断。

安装器必须封装成可更新策略，避免永久绑定某一种安装命令。

Occier 通过子进程环境动态提供：

```text
ANTHROPIC_BASE_URL
ANTHROPIC_AUTH_TOKEN / ANTHROPIC_API_KEY
ANTHROPIC_MODEL
ANTHROPIC_DEFAULT_OPUS_MODEL
ANTHROPIC_DEFAULT_SONNET_MODEL
ANTHROPIC_DEFAULT_HAIKU_MODEL
CLAUDE_CODE_SUBAGENT_MODEL
```

禁止以命令行参数明文传密钥，也不默认写入全局 Shell 或 `~/.claude/settings.json`。

模型组示例：

```json
{
  "id": "deepseek-balanced",
  "provider": "deepseek",
  "primary": "model-a",
  "reasoning": "model-a",
  "fast": "model-b",
  "subagent": "model-b",
  "extraEnv": {}
}
```

内置组：Balanced、Maximum、Economy、Frontend、Custom。具体模型由 Connector 当前目录解析。

`CLAUDE.md` 首批模板：Founder/MVR、Industrial Engineering、Frontend Design、Research/Analysis、Minimal。支持预览、安装、备份、比较、合并、恢复，禁止无提示覆盖。

### 4.6 OpenCode 管理

V2 只做轻量管理：检测、安装、升级、Provider/API Key 引导、配置验证、启动、默认或临时模型选择。

Occier 优先复用 OpenCode 自身的 `/connect`、`opencode auth login` 和认证存储机制，不复制其完整配置系统。

Occier 的职责是：保证网络可用、确保凭证安全就绪、调用官方认证入口、验证最终可用；不管理 OpenCode 的全部 Agent、工具和权限体系。

### 4.7 GitHub 管理

能力：检测 Git/GitHub CLI、安装 `gh`、检测登录、引导设备登录、兼容 PAT、检测 SSH Key、测试 GitHub API 与 Git 操作、按需向子进程提供认证环境。

默认优先级：

```text
GitHub CLI OAuth
  ↓
SSH Key
  ↓
Fine-grained PAT
  ↓
Classic PAT，仅兼容
```

首次 push、创建仓库、创建 PR 等外部操作仍应由开发工具进行权限确认。

### 4.8 Project：统一项目入口

TUI 支持新建项目、打开已有项目、最近项目。

项目启动配置：路径、开发工具、Provider、模型组、`CLAUDE.md` 模板、网络配置、GitHub 身份、启动参数。

项目元数据保存在 Occier 用户目录，不把密钥写入项目。

```text
读取项目配置
  → 网络预检
  → 凭证解析
  → 模型可用性检查
  → 构建临时环境
  → 启动 claude/opencode
  → 记录脱敏结果
```

### 4.9 Doctor：诊断与修复

检测 Node/npm/Git/curl、WSL 网络、代理、DNS、GitHub/npm/API、残留环境变量、Claude Code/OpenCode、Vault 权限、Provider、模型和 GitHub 登录状态。

修复分级：

```text
SAFE       可自动执行，可回滚
CONFIRM    需要确认
MANUAL     只提供步骤
```

修复前必须显示修改对象、原值、新值、备份位置和是否需要重启。

## 5. TUI 信息架构

```text
Dashboard
├── Quick Start
├── Projects
├── Network
│   ├── Proxy
│   ├── Mirrors
│   ├── Connectivity
│   └── Latency
├── Credentials
│   ├── Model Providers
│   └── GitHub
├── Providers
│   ├── Connectors
│   ├── Models
│   └── Model Groups
├── Tools
│   ├── Claude Code
│   └── OpenCode
├── Templates
├── Doctor
└── Settings
```

首页只展示关键状态：Network、Claude Code、OpenCode、Provider、Model Group、GitHub、Project。

## 6. CLI 设计

```bash
occier
occier init
occier doctor
occier status
occier network status|configure|test
occier vault list|set|remove
occier provider list|connect|test
occier model list|probe
occier group use
occier tool install|update claude|opencode
occier project create|open
occier launch --tool claude --group balanced
```

CLI 与 TUI 必须调用同一 Service Layer。

## 7. 配置目录

```text
~/.config/occier/
├── config.json
├── projects.json
├── model-groups.json
├── registry-cache.json
├── backups/
└── logs/
```

普通 JSON 只保存 `secretRef`，不保存真实凭证。日志默认本地、可关闭、不含请求正文和密钥，并支持生成脱敏诊断包。

## 8. 交付阶段

### Phase 0：架构重构

建立 Service/Adapter/Registry、配置 Schema、CredentialStore、统一命令执行和脱敏日志。

验收：TUI 无直接系统调用；Provider 无直接 UI 依赖；密钥不进入普通配置对象。

### Phase 1：网络底座

完成环境识别、WSL mirrored/autoProxy 检测、手动代理、Git/npm 配置、连通性检测和基础 Doctor。

验收：受限 WSL 中能通过 TUI 让 GitHub、npm、Provider API 可达，所有持久修改可回滚。

### Phase 2：Vault + Provider

完成密钥管理、Provider Registry、模型目录、鉴权和模型可用性检测。

验收：密钥不进入参数、日志和项目；能区分网络、鉴权、余额、限流和模型错误。

### Phase 3：Claude Code

完成检测、安装、更新、动态环境注入、模型组、`CLAUDE.md` 和项目启动。

验收：无需修改 Shell 即可切换 Provider 启动 Claude Code。

### Phase 4：OpenCode + GitHub

完成 OpenCode 官方认证接入、GitHub CLI/SSH/PAT 管理和统一项目入口。

验收：项目可选择 Claude Code 或 OpenCode，GitHub 凭证不写入项目。

### Phase 5：3 分钟体验与发布

完成首次向导、故障恢复、npm 包、GitHub Actions、文档和演示。

目标流程：

```text
全新 WSL
→ 安装 Occier
→ 配置代理
→ 配置一个 Provider
→ 登录 GitHub
→ 安装 Claude Code/OpenCode
→ 创建项目
→ 启动开发
```

目标中位耗时不超过 3 分钟；下载、WSL 重启、第三方注册和充值时间单独记录。

## 9. 安全红线

- 禁止密钥作为命令行参数。
- 禁止密钥写入项目目录、日志、错误、截图或诊断包。
- 禁止未经确认修改全局 Shell、Git、npm、APT 配置。
- 禁止自动关闭 TLS 校验。
- 禁止默认使用不可信镜像。
- 禁止静默覆盖 `.wslconfig`、`CLAUDE.md` 或 OpenCode 配置。
- 禁止向 Agent 提供不必要的 GitHub 高权限 Token。
- 禁止将历史成功等同于当前模型可用。
- 禁止 Occier 自建服务收集用户凭证。

## 10. 开发前必须回答的问题

1. V2 首发是否仅保证 Windows 11 + WSL2 + Ubuntu，还是同时保证原生 Linux？
2. Occier 是否从 WSL 内调用 PowerShell 修改 `%USERPROFILE%\.wslconfig`？
3. 网络第一版是否包含 APT、pip、proxychains，还是先做 Git/npm/curl？
4. 密钥后端第一版采用系统密钥库还是本地加密 Vault？
5. 本地 Vault 主密钥由系统密钥库、用户密码还是设备派生密钥保护？
6. GitHub 默认使用 `gh auth login`，是否仍允许 Occier 保存 PAT？
7. 模型目录从官方 API、Models.dev、Occier Registry 还是内置清单更新？
8. 模型探测允许产生多少最低费用，缓存多久？
9. Claude Code 第三方兼容 Provider 是正式支持还是实验能力？
10. `CLAUDE.md` 合并采用结构化章节、受控区块还是仅预览/覆盖？
11. Occier 是否负责项目脚手架，还是只创建目录和 Git 仓库？
12. "3 分钟"是否排除下载、WSL 重启、第三方注册和充值？
13. npm 包名和 CLI 命令是否最终确定为 `occier`？
14. V2 首发仅中文还是中英双语？
15. 是否允许匿名、严格脱敏的错误统计，默认关闭还是主动选择？

## 11. 当前优先级

```text
P0  环境识别、命令执行安全层、配置 Schema
P0  Network Service 与 Doctor
P0  CredentialStore 与统一脱敏
P0  Provider Connector 与模型探测
P1  Claude Code 安装、模型组和动态启动
P1  CLAUDE.md 模板管理
P1  OpenCode 安装和认证接入
P1  GitHub CLI 与凭证管理
P2  Project Launcher 与首次向导
P2  国内镜像 Registry 和自动测速
P3  配置导入导出、插件化和多平台扩展
```

## 12. Definition of Done

- 新机器首次流程完整可用。
- 网络、凭证、Provider、开发工具和项目入口形成闭环。
- Claude Code 与 OpenCode 均能从 Occier 启动。
- 密钥由统一 Vault 管理并动态注入。
- 网络和模型状态有实时、带时间戳的检测结果。
- 所有系统修改均可解释、备份和回滚。
- Doctor 能定位主要阻塞问题。
- 无明文密钥泄露路径。
- 核心服务有单元测试，首次启动流程有集成测试。
- README 能让陌生用户独立完成安装和首次配置。

## 13. 参考依据

- Microsoft WSL 文档：Windows 11 22H2 及以上支持 mirrored networking；`autoProxy=true` 可让 WSL 使用 Windows HTTP 代理信息，DNS tunneling 用于改善 VPN 和复杂网络兼容性。
- Claude Code 文档：支持通过设置和环境变量配置模型、代理及网关；项目规则由 `CLAUDE.md` 等机制管理。
- OpenCode 文档：Provider 凭证可通过 `/connect` 或 `opencode auth login` 配置，认证信息由 OpenCode 自身存储或从环境变量加载，Occier 应优先复用其官方机制。
