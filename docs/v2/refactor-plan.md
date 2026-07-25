# Occier V2 重构计划

> 基于 `docs/v2/plan.md` 架构要求，针对当前代码库的架构偏离进行系统性重构。

## 0. 当前状态基线

### 已实现
- Phase 0-5 所有功能模块
- 7 Provider Registry (v2) + 3 Provider Registry (v1 遗留)
- 5 Model Groups
- 5 CLAUDE.md Templates
- 122 测试 (20 文件) 通过 | Lint 0 错误
- OpenRouter / 自定义 Compatible Provider 支持

### 架构偏离 (需重构)
| # | 问题 | 严重度 | 偏离条款 |
|---|------|--------|----------|
| R1 | CLI 路由 321 行 if/else 链 | 严重 | 6: CLI 设计 — 应调用 Service Layer |
| R2 | 两套并行 Provider Registry | 严重 | 4.2: 避免并行架构 |
| R3 | 命令文件包含业务逻辑 | 严重 | 3: TUI/CLI 不包含核心业务 |
| R4 | Mirror 状态不持久 | 高 | 4.2C: Mirror Registry |
| R5 | TUI Dashboard 使用 inquirer 菜单非全屏 | 中 | 5: TUI 信息架构 |
| R6 | 命令文件缺乏统一接口签名 | 中 | 6: CLI 设计 |
| R7 | Provider/Model 探测结果无统一缓存层 | 中 | 4.4: 检测策略 |
| R8 | 无 Service Layer 抽象 | 中 | 3: 总体架构 |

---

## 1. 重构范围（分 4 个阶段）

### Phase A：消解并行架构（R1, R2, R3）
**目标**：合并重复注册表，提取 CLI 命令注册表，建立 Service Layer 骨架

#### A1. 合并 Provider Registry
```
删除: src/providers/registry.mjs (v1)
迁移消费者:
  src/commands/launch.mjs → 使用 src/registry/providers.mjs
  src/commands/setup-wizard.mjs → 使用 src/registry/providers.mjs
  src/checks.mjs → 使用 src/registry/providers.mjs
保持向后兼容: src/providers/registry.mjs → re-export from v2
```

#### A2. CLI 命令注册表
```
新建: src/registry/commands.mjs
  - 声明式命令定义 {cmd, sub, handler, args, help}
  - 动态 import 懒加载
  - 统一参数解析
替换: src/cli.mjs route() 中 321 行 if/else
```

#### A3. Service Layer 骨架
```
新建: src/services/
  ├── network.mjs   (摘取 network.mjs 中的纯逻辑)
  ├── vault.mjs     (摘取 vault.mjs 中的纯逻辑)
  ├── provider.mjs  (摘取 provider.mjs 中的纯逻辑)
  ├── project.mjs   (摘取 project.mjs 中的纯逻辑)
  └── tools.mjs     (摘取 tools.mjs 中的纯逻辑)
原则: Service 层返回 {ok, data, error}，不与 console.log 耦合
```

### Phase B：基础设施加固（R4, R7）
**目标**：mirror 持久化，探测缓存统一

#### B1. Mirror State 持久化
```
修改: src/mirrors/registry.mjs
  - 添加 saveMirrors() / loadMirrors()
  - 使用 ~/.config/occier/mirrors.json
  - 启动时合并 builtin + 用户覆盖
```

#### B2. 统一探测缓存层
```
新建: src/registry/probe-cache.mjs
  - 抽象 CacheStore {get,set,clear,isValid}
  - TTL + 并发去重 (in-flight map)
  - probes.mjs 和 speedtest.mjs 共用
```

### Phase C：TUI 全屏仪表盘（R5）
**目标**：全屏 Terminal Kit TUI，类似 OpenClaw 风格

```
新建: src/tui/v2/
  ├── framework.mjs  (全屏框架: header, tabs, footer, hotkeys)
  ├── dashboard.mjs  (顶部状态 + Quick Actions)
  ├── network.mjs    (代理/镜像/连通性面板)
  ├── vault.mjs      (凭证列表/增删)
  ├── provider.mjs   (Provider 列表/配置/测试)
  ├── tools.mjs      (Claude/OpenCode 安装/更新)
  └── project.mjs    (项目列表/创建/启动)
依赖: terminal-kit (推荐) 或 blessed
```

### Phase D：接口标准化（R6, R8）
**目标**：统一命令签名，完善 Service Layer

#### D1. 统一命令签名
```ts
interface CliCommand {
  name: string;
  handler: (args: string[]) => Promise<void>;
  subCommands: Record<string, CliCommand>;
  help: string;
}
```

#### D2. Service Layer 完善
```
所有 services/*.mjs 导出具名 async functions
返回 {ok, data?, error?} 结构
CLI handlers 仅负责参数解析 + TUI 渲染
```

---

## 2. 文件变更清单

### 新增文件
```
src/registry/commands.mjs          # 命令注册表
src/registry/probe-cache.mjs       # 统一探测缓存
src/services/network.mjs           # 网络 Service
src/services/vault.mjs             # 凭证 Service
src/services/provider.mjs          # Provider Service
src/services/project.mjs           # 项目 Service
src/services/tools.mjs             # 工具 Service
src/services/doctor.mjs            # 诊断 Service
src/tui/v2/framework.mjs           # TUI 框架
src/tui/v2/dashboard.mjs           # TUI 仪表盘
src/tui/v2/network.mjs             # TUI 网络
src/tui/v2/vault.mjs               # TUI 凭证
src/tui/v2/provider.mjs            # TUI Provider
src/tui/v2/tools.mjs               # TUI 工具
src/tui/v2/project.mjs             # TUI 项目
```

### 修改文件
```
src/cli.mjs                        # 使用命令注册表
src/providers/registry.mjs         # re-export from v2 (过渡)
src/mirrors/registry.mjs           # 添加持久化
src/registry/probes.mjs            # 使用统一缓存
src/commands/v2/*.mjs              # 移出纯逻辑到 services/
src/commands/launch.mjs            # 使用 v2 registry
src/commands/setup-wizard.mjs      # 使用 v2 registry
src/checks.mjs                     # 使用 v2 registry
```

### 删除文件
```
src/providers/registry.mjs         # Phase A 结束后删除
```

---

## 3. 测试基线

### 当前基线 (v2 branch `f41ad51`)
```
Test Files:  20 passed
Tests:       122 passed
Lint:        0 errors
```

### Phase A 后基线
```
新增: src/registry/commands.test.mjs     (命令注册表单元测试)
新增: src/services/*.test.mjs            (每 service 至少 1 测试)
现有: 122 tests → ≥122 (不减少，不降级)
```

### Phase B 后基线
```
新增: src/mirrors/registry.test.mjs      (mirror 持久化测试)
新增: src/registry/probe-cache.test.mjs   (缓存 TTL/并发测试)
```

### Phase C 后基线
```
新增: src/tui/v2/*.test.mjs              (TUI 组件渲染测试)
注意: TUI 测试仅验证数据渲染逻辑，不测试 terminal-kit 原生 API
```

### Phase D 后基线
```
目标: ≥150 tests
覆盖率: 核心路径 100% (Service Layer), TUI 80%
```

### 验证命令
```bash
npm run ci          # lint + test
node bin/occier.mjs --help         # CLI 可用
node bin/occier.mjs doctor         # 诊断可用
node bin/occier.mjs provider list  # Provider 可用
node bin/occier.mjs network test   # 网络测试可用
```

---

## 4. 验收标准

### Phase A
- [ ] `src/providers/registry.mjs` 仅包含 re-export
- [ ] `src/cli.mjs` 路由逻辑 <100 行
- [ ] 所有命令通过注册表 dispatch
- [ ] 3 个 Service 文件存在且被 CLI 命令调用
- [ ] 现有 122 测试全部通过

### Phase B
- [ ] mirror enable/disable 重启后保持
- [ ] probe 缓存有 TTL 和并发去重
- [ ] 新增测试覆盖持久化和缓存

### Phase C
- [ ] 全屏 TUI 可用 (terminal-kit)
- [ ] Dashboard/Network/Vault/Provider/Tools/Project 面板
- [ ] 键盘导航 (Tab/Arrow/Enter/Esc)
- [ ] CLI 脚本化路径不受影响

### Phase D
- [ ] 所有命令使用统一接口签名
- [ ] Service Layer 覆盖所有核心模块
- [ ] ≥150 测试通过

---

## 5. 不重构的部分

- `src/store/credential-store.mjs` — 已在 v2-fix 中修复加密方案
- `src/exec/runner.mjs` / `logger.mjs` — 已在 v2-fix 中修复
- `src/network/proxy.mjs` / `wsl.mjs` — 已在 v2-fix 中修复
- `src/tools/claude/`, `opencode/`, `github/` — 逻辑合理，暂不重构
- `src/schema/config.mjs` — 结构清晰，暂不重构
- V1 旧命令 (health, config, status, select, fix-path, remove) — 过渡保留
