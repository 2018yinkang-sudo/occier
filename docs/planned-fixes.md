# 计划修复 — 审计遗留项

## 🔴 高优先级

### 1. opencode 启动路径不传 provider 环境
**位置**：`src/commands/v2/launch.mjs:88` — `spawn('opencode', [], { stdio: 'inherit' })`  
**现状**：opencode 启动时不设置任何 provider 凭据，完全依赖其自身的 ~/.config/opencode/auth.json。用户用 occier 配置的凭据对 opencode 不可见。  
**计划**：启动前调用 `syncToOpenCodeAuth(providerId, apiKey)` 写入 opencode 的 auth.json，或通过环境变量注入。

### 2. v1 直启仅支持内置三 Provider
**位置**：`src/cli.mjs:171` — `if (cmd === 'deepseek' || cmd === 'kimi' || cmd === 'anthropic')`  
**现状**：`occier deepseek` 等快捷直启仅硬编码三个 Provider；v2 新建的 OpenRouter / Zhipu / 自定义 Provider 无法通过此路径启动。  
**计划**：改为从 registry 查找任意 provider id（包括用户自定义），匹配则走 directLaunch 并支持任意 protocol。同时 `directLaunch` 应从 v2 vault 读取凭据（目前仍只读 v1 providers.env）。

## 🟡 中优先级

### 3. 设备指纹加密强度不足
**位置**：`src/store/credential-store.mjs:198` — `deriveMasterKey(getDeviceFingerprint())`  
**现状**：默认加密密钥基于 hostname + machine-id + username，同一机器的任意用户可推导密钥。文件权限 0600 是主要防线。  
**计划**：支持可选 passphrase（运行时提示输入），`createStore('encrypted', {passphrase:'...'})`；passphrase 不在任何位置持久化。

### 4. TUI Network 面板无实时连通性测试
**位置**：`src/tui/v2/network.mjs`  
**现状**：只展示 proxy 配置和 mirror 列表；cli `occier network test` 有实时测试但 TUI 面板没有。  
**计划**：在 network 面板加入「Test Connectivity」区块，复用 `checkConnectivity`。

### 5. WSL networkingMode 检测在无 USERPROFILE 时回退
**位置**：`src/network/wsl.mjs:38` — `winPathToWsl(process.env.USERPROFILE)`  
**现状**：WSL 会话中若 USERPROFILE 未通过 WSLENV 传入，`winPathToWsl` 返回 null，解析主机侧 .wslconfig 失败，回退默认 "nat"。  
**计划**：增加备用路径扫描 `/mnt/c/Users/*/` 查找已知用户目录（从 `whoami` 或 `/etc/wsl.conf [user]`）读取 .wslconfig。

### 6. TUI Vault 面板只读
**位置**：`src/tui/v2/vault.mjs`  
**现状**：TUI 仅展示凭据列表，无法添加/删除凭据（需退出使用 `occier vault set/remove`）。  
**计划**：加入 `vault set`/`remove` 的 in-TUI 操作（密码输入 + 类型选择）。

## 🟢 低优先级

### 7. configureAllProxies 中 apt/proxychains 需 root 时吞掉错误
**位置**：`src/network/proxy-ext.mjs:63` — catch 吞掉 EACCES  
**现状**：写过日志但静默标记失败；用户可能不知道哪些代理配置成功。  
**计划**：汇总结果时输出详细报告。

### 8. connectivity checkAll 串行化
**位置**：`src/network/connectivity.mjs:43` — for...of 逐个检测  
**计划**：改为 `Promise.all` 并行探测。

### 9. 移除 CLI dispatch 中 mirror/template 的专用分发器
**位置**：`src/cli.mjs:177-185` — dispatchMirror / dispatchTemplate 硬编码  
**现状**：两个命令跳过 registry 走专用分发器；增加了架构分支。  
**计划**：将 CLI 输出格式化方法（列表示例、diff 显示）改为该模块自己的导出，让 registry 分发器统一调用，删除 route() 中的特例。
