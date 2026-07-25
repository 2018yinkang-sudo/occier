# 计划修复 — 审计遗留项

## 🔴 高优先级

### 1. ~~opencode 启动路径不传 provider 环境~~ ✅ 已完成
**位置**：`src/commands/v2/launch.mjs:88` — `spawn('opencode', [], { stdio: 'inherit' })`  
**现状**：~~opencode 启动时不设置任何 provider 凭据~~ → 已通过环境变量注入（`{ ...process.env, [VAR]: data.value }`）  
**完成**：2026-07-26, feature/credential-management

### 2. ~~v1 直启仅支持内置三 Provider~~ ✅ 已完成
**位置**：`src/cli.mjs:178` — `if (cmd === 'deepseek' || cmd === 'kimi' || cmd === 'anthropic')`  
**现状**：~~硬编码三个 Provider~~ → 已改为 registry 查找（`getProviderSafe(cmd)`），directLaunch 读 v2 vault  
**完成**：2026-07-26, feature/credential-management

## 🟡 中优先级

### 3. ~~设备指纹加密强度不足~~ ✅ 已完成
**位置**：`src/store/credential-store.mjs` — `deriveMasterKey(getDeviceFingerprint())`  
**现状**：~~默认加密密钥基于 hostname + machine-id + username~~ → 已实现：
- 可选 passphrase (`OCCIER_PASSPHRASE` 环境变量 + TUI 会话缓存)
- 随机 per-installation salt（存储于 vault.enc.meta）
- PBKDF2 迭代次数提升至 600,000（OWASP 2023）
- 旧 vault 自动迁移
- `occier vault passphrase set/remove/status` 命令
**完成**：2026-07-26, feature/credential-management

### 4. TUI Network 面板无实时连通性测试
**位置**：`src/tui/v3/network.mjs`  
**现状**：只展示 proxy 配置和 mirror 列表；cli `occier network test` 有实时测试但 TUI 面板没有。  
**计划**：在 network 面板加入「Test Connectivity」区块，复用 `checkConnectivity`。

### 5. WSL networkingMode 检测在无 USERPROFILE 时回退
**位置**：`src/network/wsl.mjs:38` — `winPathToWsl(process.env.USERPROFILE)`  
**现状**：WSL 会话中若 USERPROFILE 未通过 WSLENV 传入，`winPathToWsl` 返回 null，解析主机侧 .wslconfig 失败，回退默认 "nat"。  
**计划**：增加备用路径扫描 `/mnt/c/Users/*/` 查找已知用户目录（从 `whoami` 或 `/etc/wsl.conf [user]`）读取 .wslconfig。

### 6. ~~TUI Vault 面板只读~~ ✅ 已完成
**位置**：`src/tui/v3/vault.mjs`  
**现状**：~~TUI 仅展示凭据列表~~ → 已实现：
- in-TUI 添加凭据（三步流程：key name → value → type select）
- in-TUI 删除凭据（确认后删除）
- 类型选择支持 api_key / github_token / proxy_password / other
**完成**：2026-07-26, TUI v3 refactor + feature/credential-management

## 🟢 低优先级

### 7. configureAllProxies 中 apt/proxychains 需 root 时吞掉错误
**位置**：`src/network/proxy-ext.mjs:63` — catch 吞掉 EACCES  
**现状**：写过日志但静默标记失败；用户可能不知道哪些代理配置成功。  
**计划**：汇总结果时输出详细报告。

### 8. connectivity checkAll 串行化
**位置**：`src/network/connectivity.mjs:43` — for...of 逐个检测  
**计划**：改为 `Promise.all` 并行探测。

### 9. 移除 CLI dispatch 中 mirror/template 的专用分发器
**位置**：`src/cli.mjs:184-192` — dispatchMirror / dispatchTemplate 硬编码  
**现状**：两个命令跳过 registry 走专用分发器；增加了架构分支。  
**计划**：将 CLI 输出格式化方法（列表示例、diff 显示）改为该模块自己的导出，让 registry 分发器统一调用，删除 route() 中的特例。
