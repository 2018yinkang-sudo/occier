# Occier v2 重构设计文档

> **项目定位：AI Development Environment Manager**  
> **版本：v2**  
> **文档用途：作为 OpenCode / Codex 的实现输入与重构基线**  
> **核心目标：将 Occier 从单点配置工具重构为 AI 开发环境的统一管理器。**

---

## 1. 背景与问题

AI Coding 工具越来越多：OpenCode、Claude Code、Codex、Cursor、Windsurf、VS Code 插件等。它们都依赖一套相似但彼此割裂的环境：

- 网络、代理、DNS、TLS、WSL
- API Key、OAuth、Azure 凭证
- Provider、Model、路由、Fallback
- MCP、工具权限、项目规则
- Node、Python、uv、bun、pnpm、Docker、Git
- 不同工具各自的配置文件与环境变量

当前开发者需要重复配置、重复排错，并且很难知道故障到底来自模型、密钥、代理、网络、运行时还是工具本身。

Occier v2 的任务不是“再做一个 AI Agent”，而是管理 AI Agent 所依赖的整个环境。

> **Occier = AI 开发环境的统一控制平面。**

---

## 2. 产品目标

### 2.1 核心目标

1. 统一管理网络、密钥、AI Provider、工作区、运行时和 AI Coding 工具。
2. 将 AI 开发环境配置时间压缩到 3 分钟以内。
3. 将常见网络与 Provider 故障定位时间压缩到 30 秒以内。
4. 保证所有配置可检查、可迁移、可回滚、可审计。
5. 不绑定任何单一模型、Provider 或 AI Coding 工具。

### 2.2 非目标

Occier v2 暂不负责：

- 替代 OpenCode、Claude Code、Codex 等编码 Agent。
- 托管完整 IDE。
- 自动修改业务代码。
- 构建复杂多 Agent 工作流。
- 代替企业级密钥管理系统或零信任平台。

---

## 3. 核心原则

| 原则 | 说明 |
|---|---|
| 工具可替换 | OpenCode、Claude Code、Codex 只是 Connector，不进入核心领域模型。 |
| Provider 可替换 | OpenAI、Anthropic、DeepSeek、Gemini、OpenRouter、Azure 均通过统一接口接入。 |
| 本地优先 | 默认本地保存配置和状态，不强制依赖云端账户。 |
| 安全优先 | 密钥不明文落盘，不写入日志，不进入 Git。 |
| 显式配置 | 所有自动行为均可追溯到明确配置与策略。 |
| 可诊断 | 每个失败都尽可能定位到网络、代理、鉴权、额度、模型、运行时或工具层。 |
| 可回滚 | 所有写配置操作先备份，失败后可恢复。 |
| MVP 优先 | 第一阶段只解决最频繁、最痛、最容易验证的问题。 |

---

## 4. v2 核心模块

```text
Occier
├── Network      网络与 Provider 连通性
├── Vault        密钥与凭证
├── AI           Provider、模型与路由
├── Workspace    项目级配置
├── Runtime      开发运行环境
├── Doctor       诊断、报告与修复
├── Connector    AI Coding 工具适配
└── Policy       策略、安全与预算控制
```

---

## 5. 模块需求

### 5.1 Network：网络管理

负责 AI Provider 访问链路。

#### 功能范围

- 读取并管理 `HTTP_PROXY`、`HTTPS_PROXY`、`ALL_PROXY`、`NO_PROXY`。
- 检测直连与代理路径。
- 检测 DNS、IPv4、IPv6、TCP、TLS、ALPN、HTTP/1.1、HTTP/2。
- 检测 Provider 延迟、模型列表接口和流式响应。
- 支持 WSL 与 Windows 主机代理场景。
- 支持针对域名设置 `DIRECT` 或 `PROXY`。

#### 典型输出

```text
DeepSeek
Route: PROXY 127.0.0.1:10808
TCP: OK
CONNECT: OK
TLS: TIMEOUT
Diagnosis: Proxy tunnel established, upstream TLS handshake failed
Suggestion: Switch proxy node or add api.deepseek.com to NO_PROXY
```

#### 首批 Provider

- OpenAI
- Anthropic
- DeepSeek
- OpenRouter
- Gemini
- GitHub
- Azure OpenAI

---

### 5.2 Vault：密钥管理

统一管理 API Key、OAuth Token 和云平台凭证。

#### 功能范围

- 添加、删除、更新、验证凭证。
- 密钥加密存储。
- 默认优先调用系统 Keychain：Windows Credential Manager、macOS Keychain、Linux Secret Service。
- 无系统 Keychain 时使用本地加密文件。
- 支持环境变量导入。
- 支持凭证作用域：全局、Profile、Workspace。
- 显示凭证状态，不显示完整密钥。
- 日志、错误、导出报告自动脱敏。

#### 凭证类型

```text
api_key
oauth_token
client_credentials
azure_credentials
service_account
```

#### 安全要求

- 禁止明文写入 `occier.json`。
- 禁止在命令输出中显示完整 Key。
- 禁止自动写入项目 `.env`，除非用户明确执行导出。
- 修改或删除密钥前要求确认。

---

### 5.3 AI：Provider 与模型管理

负责模型发现、配置、健康状态与路由。

#### 功能范围

- Provider 注册与统一配置。
- 拉取或维护模型列表。
- 模型能力标签：Coding、Reasoning、Vision、Long Context、Tools、Cheap、Fast。
- 健康状态、延迟与错误率记录。
- 默认模型与备用模型。
- 可选的手动路由规则。
- 第一阶段不做复杂智能路由，仅支持明确的优先级与 Fallback。

#### 示例

```yaml
providers:
  deepseek:
    credential: vault://deepseek/default
    base_url: https://api.deepseek.com
  openrouter:
    credential: vault://openrouter/default

routes:
  coding:
    primary: deepseek/deepseek-v4-flash
    fallback:
      - openrouter/anthropic/claude-sonnet
      - openrouter/openai/gpt
```

---

### 5.4 Workspace：工作区管理

每个项目拥有独立且可继承的 AI 开发配置。

#### 工作区管理对象

- 默认 Provider 与 Model
- Network Profile
- 凭证引用
- MCP 配置
- AI Coding 工具配置
- 项目规则与权限
- 环境变量模板
- Runtime 要求

#### 配置优先级

```text
系统默认 < 用户全局 < Profile < Workspace < 临时命令参数
```

#### 推荐文件

项目根目录：

```text
.occier/
├── workspace.yaml
├── policy.yaml
└── generated/
```

`workspace.yaml` 只保存非敏感配置和 Vault 引用。

---

### 5.5 Runtime：运行环境管理

负责检测 AI Coding 依赖的基础环境。

#### 首批检测项

- Operating System
- WSL
- Git
- Node.js
- npm / pnpm
- bun
- Python
- uv
- Docker
- Shell
- PATH

#### 第一阶段能力

- 版本检测。
- 缺失项提示。
- PATH 冲突识别。
- WSL 与 Windows 命令来源识别。
- 生成安装建议。

#### 后续能力

- 一键安装。
- 版本切换。
- 环境快照。
- 项目运行时锁定。

---

### 5.6 Doctor：诊断系统

Doctor 是 v2 的首要价值入口。

#### 命令

```bash
occier doctor
occier doctor network
occier doctor provider deepseek
occier doctor runtime
occier doctor export
occier doctor repair
```

#### 检测流程

```text
环境识别
→ 代理变量
→ DNS
→ TCP
→ HTTP CONNECT
→ TLS
→ Provider API
→ Authentication
→ Model List
→ Non-stream Request
→ Stream Request
→ 诊断
→ 修复建议
```

#### 诊断规则示例

| 条件 | 诊断 |
|---|---|
| DNS 失败 | DNS 配置或污染 |
| TCP 失败 | 网络、路由或防火墙 |
| Proxy CONNECT 失败 | 代理不可达或协议错误 |
| CONNECT 成功、TLS 超时 | 代理节点或上游线路异常 |
| TLS 成功、HTTP 401 | Key 无效或未传递 |
| HTTP 403 | 权限、地区或账户限制 |
| HTTP 429 | 额度、速率或并发限制 |
| 模型列表成功、流式失败 | SSE、代理或 SDK 兼容问题 |
| IPv4 成功、IPv6 失败 | IPv6 路由问题 |
| curl 成功、工具失败 | 工具运行时或配置问题 |

#### 报告要求

`occier doctor export` 生成脱敏 Markdown：

```text
System
WSL
Proxy
DNS
Provider
TLS
Latency
Errors
Diagnosis
Suggested Actions
```

---

### 5.7 Connector：AI Coding 工具适配

Connector 将 Occier 的统一配置写入不同工具，但不让工具配置污染核心领域。

#### 首批 Connector

1. OpenCode
2. Claude Code
3. Codex CLI

后续：Cursor、Windsurf、VS Code。

#### Connector 标准接口

```text
detect()
read_config()
validate()
plan_changes()
apply_changes()
backup()
rollback()
health_check()
```

#### 核心要求

- 修改前生成 Diff。
- 修改前自动备份。
- 不覆盖用户未知字段。
- 尽量使用局部 Patch，不整文件重写。
- 写入后执行验证。
- 失败自动回滚。

---

### 5.8 Policy：策略中心

Policy 用于定义模型、预算、权限与安全规则。

#### 第一阶段能力

- Provider 白名单。
- 模型白名单。
- 工作区可用凭证范围。
- 网络路由规则。
- 工具配置写入权限。
- 单次操作确认策略。

#### 后续能力

- 成本预算。
- Token 限制。
- 自动 Fallback 策略。
- 团队级默认策略。
- 敏感目录访问控制。
- 审计日志。

---

## 6. 总体架构

```text
CLI / Desktop UI
        │
        ▼
Application Service
        │
 ┌──────┼────────┬────────┬────────┐
 ▼      ▼        ▼        ▼        ▼
Doctor Network   Vault     AI     Workspace
        │          │        │        │
        └──────────┴────────┴────────┘
                   │
               Policy Engine
                   │
         ┌─────────┴─────────┐
         ▼                   ▼
   Runtime Adapters     Tool Connectors
                             │
              OpenCode / Claude Code / Codex
```

### 分层建议

```text
src/
├── domain/          领域模型与规则
├── application/     用例编排
├── infrastructure/  网络、存储、Keychain、Shell
├── connectors/      AI Coding 工具适配器
├── providers/       AI Provider 适配器
├── cli/             CLI 命令
└── tests/
```

核心领域不得直接依赖 OpenCode、Claude Code 或某个 Provider SDK。

---

## 7. 领域模型

### 7.1 Provider

```typescript
interface Provider {
  id: string;
  name: string;
  baseUrl: string;
  credentialRef?: string;
  capabilities: ProviderCapability[];
  health?: ProviderHealth;
}
```

### 7.2 NetworkProfile

```typescript
interface NetworkProfile {
  id: string;
  proxy?: {
    http?: string;
    https?: string;
    all?: string;
    noProxy?: string[];
  };
  preferIPv4?: boolean;
  timeoutMs?: number;
}
```

### 7.3 Workspace

```typescript
interface Workspace {
  id: string;
  path: string;
  profile?: string;
  provider?: string;
  model?: string;
  networkProfile?: string;
  connectorConfigs: Record<string, unknown>;
  policy?: string;
}
```

### 7.4 DiagnosticResult

```typescript
interface DiagnosticResult {
  checkId: string;
  status: "pass" | "warn" | "fail" | "skip";
  stage: string;
  summary: string;
  evidence: Record<string, unknown>;
  diagnosis?: string;
  suggestions: SuggestedAction[];
  durationMs: number;
}
```

### 7.5 SuggestedAction

```typescript
interface SuggestedAction {
  id: string;
  risk: "low" | "medium" | "high";
  description: string;
  commandPreview?: string;
  reversible: boolean;
}
```

---

## 8. 配置设计

### 8.1 全局配置

建议路径：

```text
Linux/WSL: ~/.config/occier/config.yaml
Windows:   %APPDATA%/Occier/config.yaml
```

示例：

```yaml
version: 2
active_profile: personal

profiles:
  personal:
    network: default
    default_provider: deepseek
    policy: personal

network_profiles:
  default:
    prefer_ipv4: true
    timeout_ms: 15000
    proxy:
      https: http://127.0.0.1:10808
      no_proxy:
        - localhost
        - 127.0.0.1
        - api.deepseek.com

providers:
  deepseek:
    base_url: https://api.deepseek.com
    credential: vault://deepseek/default

connectors:
  opencode:
    enabled: true
```

### 8.2 配置迁移

v2 启动时：

1. 检测 v1 配置。
2. 输出迁移计划。
3. 备份原配置。
4. 转换为 v2 Schema。
5. 校验。
6. 失败则保留 v1，不做破坏性修改。

---

## 9. CLI 设计

```bash
occier init
occier status
occier doctor
occier doctor provider deepseek
occier doctor export

occier vault add deepseek
occier vault list
occier vault validate deepseek

occier provider list
occier provider status
occier model list deepseek

occier workspace init
occier workspace status
occier workspace apply

occier connector list
occier connector inspect opencode
occier connector apply opencode

occier config show
occier config diff
occier config validate
```

### 输出原则

- 默认输出高密度表格。
- `--json` 输出机器可读格式。
- `--verbose` 输出诊断证据。
- 错误信息必须包含：发生阶段、原始错误、推断原因、下一步动作。

---

## 10. v2 MVP 范围

### P0：必须完成

| 模块 | MVP 能力 |
|---|---|
| Network | 代理变量、DNS、TCP、TLS、直连/代理检测 |
| Doctor | DeepSeek、OpenAI、Anthropic 连通性诊断 |
| Vault | 添加、读取、验证、脱敏展示 API Key |
| AI | Provider 与模型基础配置 |
| Workspace | 项目初始化与配置继承 |
| Connector | OpenCode 配置读取、Diff、写入、备份、回滚 |
| Runtime | WSL、Git、Node、bun、Python、uv 检测 |
| Export | 生成脱敏诊断报告 |

### P1：完成 MVP 后

- Claude Code Connector。
- Codex CLI Connector。
- Streaming 测试。
- 自动修复低风险问题。
- Network Profile 切换。
- 配置导入与导出。

### P2：暂缓

- Desktop GUI。
- 云同步。
- 团队策略。
- 智能模型路由。
- 成本计费分析。
- 一键安装全部 Runtime。
- 企业级审计。

---

## 11. 第一轮实现任务

### Task 1：建立 v2 项目结构

- 建立 `domain/application/infrastructure/connectors/providers/cli` 分层。
- 定义配置 Schema 与类型。
- 保留 v1 代码但隔离，不直接删除。

### Task 2：实现配置加载器

- 支持全局配置、Profile、Workspace 继承。
- 支持环境变量覆盖。
- 支持配置校验与友好错误。

### Task 3：实现 Network Doctor

- 读取代理环境变量。
- DNS 查询。
- TCP 连接。
- 代理 CONNECT。
- TLS 握手。
- HTTP 请求。
- 输出阶段化结果。

### Task 4：实现 Provider Adapter

首批：DeepSeek、OpenAI、Anthropic。

统一接口：

```text
getModels()
checkAuthentication()
testCompletion()
testStreaming()
```

### Task 5：实现 Vault

- 系统 Keychain Adapter。
- 本地加密存储 Fallback。
- 脱敏输出。
- Key 验证。

### Task 6：实现 OpenCode Connector

- 检测安装路径与版本。
- 读取配置。
- 生成目标配置。
- 展示 Diff。
- 备份、写入、验证、回滚。

### Task 7：实现诊断报告

- 终端结果。
- JSON 结果。
- Markdown 导出。
- 自动脱敏。

---

## 12. 验收标准

### Network Doctor

- 能识别 WSL 环境。
- 能正确读取大小写两套代理变量。
- 能区分直连失败、代理失败、CONNECT 失败、TLS 超时和 HTTP 错误。
- 能复现并识别：`CONNECT 200，但 TLS handshake timeout`。
- 每个检测设置最大超时，程序不得无限卡住。

### Vault

- 配置文件与日志中不得出现完整 API Key。
- 能验证 Key 并返回明确结果。
- 删除或覆盖凭证前必须确认。

### OpenCode Connector

- 不破坏用户未知配置字段。
- 修改前展示 Diff。
- 修改前创建备份。
- 写入失败可自动回滚。

### Workspace

- 能建立 `.occier/workspace.yaml`。
- 能继承全局配置并被项目配置覆盖。
- 敏感信息仅以 Vault 引用出现。

### CLI

- Windows、WSL、Linux 至少在 WSL 环境完成端到端测试。
- 所有核心命令支持 `--json`。
- 错误必须具备可行动的修复建议。

---

## 13. 测试策略

### 单元测试

- 配置合并优先级。
- 脱敏规则。
- 诊断决策规则。
- Provider 错误映射。
- Connector Diff 与 Patch。

### 集成测试

模拟：

- 无代理直连成功。
- 代理端口未监听。
- Proxy CONNECT 403。
- CONNECT 200 后 TLS 超时。
- DNS 失败。
- IPv6 失败、IPv4 成功。
- Provider 401、403、429、500。
- 非流式成功、流式失败。
- OpenCode 配置写入失败并回滚。

### 安全测试

- 日志中搜索 API Key 前后缀。
- Markdown 报告脱敏。
- 配置文件权限检查。
- 命令历史泄密检查。

---

## 14. 技术约束

1. 优先使用 TypeScript，复用当前 Occier 技术栈；如现有项目不是 TypeScript，则保持现有语言，不进行无必要重写。
2. Network Doctor 不应完全依赖系统 `curl`；核心检测使用程序内部实现，`curl` 仅可作为补充验证。
3. 所有网络步骤必须独立计时并设置 Timeout。
4. 核心领域层不得直接执行 Shell。
5. Shell、文件系统、Keychain、网络均通过 Adapter 注入。
6. 修复操作默认只生成 Plan，用户确认后执行。
7. 第一阶段不引入数据库，使用配置文件与系统安全存储即可。
8. 不引入 Dify、LangGraph、Celery 等与本项目核心无关的基础设施。

---

## 15. 最终产品结构

```text
Occier v2
│
├── Setup：3 分钟建立 AI 开发环境
├── Status：一屏查看整体状态
├── Doctor：30 秒定位问题
├── Vault：统一管理凭证
├── AI：统一管理 Provider 与模型
├── Workspace：项目级环境隔离
├── Connector：适配不同 AI Coding 工具
├── Runtime：管理基础开发环境
└── Policy：约束权限、模型与网络行为
```

> **Occier v2 的第一价值不是“帮用户调用 AI”，而是确保用户的 AI 开发环境始终可用、可控、可迁移、可修复。**

---

## 16. OpenCode 执行指令

请按照以下顺序实施，不要一次性重写整个项目：

1. 阅读现有代码并输出 v1 架构、配置入口、外部依赖与可复用模块。
2. 对照本文档生成 v2 迁移计划，列出保留、重构、新增和废弃内容。
3. 先建立 v2 目录结构、类型与配置 Schema，不修改现有功能。
4. 实现 Network Doctor 最小闭环，并加入测试。
5. 实现 Vault 与 Provider Adapter。
6. 实现 OpenCode Connector 的只读检测，再实现安全写入。
7. 每完成一个阶段，运行测试并提交独立 Commit。
8. 所有破坏性修改必须先备份并提供回滚方案。
9. 不擅自扩展 P2 功能，不进行无关 UI 美化。
10. 最终交付：可运行代码、测试、迁移说明、CLI 使用文档与已知限制。
