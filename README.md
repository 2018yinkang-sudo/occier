# Claude Code WSL 多模型配置包

本配置包提供：

- 工业级项目规则文件 `CLAUDE.md`
- 私有密钥环境变量模板
- DeepSeek Claude Code 启动器
- Kimi Claude Code 启动器
- Anthropic 官方模式启动器
- 自动安装脚本

## 目录结构

```text
claude-code-wsl-kit/
├── CLAUDE.md
├── README.md
├── install.sh
├── uninstall.sh
├── bin/
│   ├── cc-common
│   ├── cc-deepseek
│   ├── cc-kimi
│   ├── cc-anthropic
│   └── cc-which
└── config/
    └── providers.env.example
```

## 1. 前置条件

在 WSL 中确认 Claude Code 已安装：

```bash
claude --version
```

没有安装时，可按 Claude Code 当前官方方式安装。安装完成后再使用本配置包。

## 2. 安装

解压后进入目录：

```bash
cd claude-code-wsl-kit
chmod +x install.sh uninstall.sh bin/*
./install.sh
source ~/.bashrc
```

安装脚本会：

- 把启动命令复制到 `~/.local/bin`
- 创建 `~/.config/claude-code/providers.env`
- 将密钥文件权限设为 `600`
- 在需要时把 `~/.local/bin` 加入 PATH

## 3. 填写 API Key

编辑私有配置：

```bash
nano ~/.config/claude-code/providers.env
```

填写：

```bash
DEEPSEEK_API_KEY="你的 DeepSeek API Key"
KIMI_API_KEY="你的 Kimi 开放平台 API Key"
```

Kimi 开放平台 API Key 与 Kimi Code Key/订阅不是同一种凭证，不可混用。

不要把真实密钥复制到项目目录，不要提交到 Git。

## 4. 使用

进入任意项目：

```bash
cd ~/projects/your-project
```

使用 DeepSeek：

```bash
cc-deepseek
```

使用 Kimi：

```bash
cc-kimi
```

使用 Anthropic 官方 Claude：

```bash
cc-anthropic
```

在 Claude Code 内输入：

```text
/status
```

检查实际端点和模型。

## 5. 给项目安装 CLAUDE.md

把配置包根目录中的 `CLAUDE.md` 复制到项目根目录：

```bash
cp /path/to/claude-code-wsl-kit/CLAUDE.md ~/projects/your-project/CLAUDE.md
```

然后按项目情况修改其中的产品使命、技术栈和特殊约束。

不要在 `CLAUDE.md` 中写 API Key。

## 6. 推荐分工

### DeepSeek

适合：

- 后端逻辑
- 数据库和 API
- 架构分析
- 多文件重构
- 测试与排错

### Kimi

适合：

- 页面设计
- 截图或设计稿理解
- 前端组件
- 响应式布局
- 视觉与交互调整

这只是工作流建议，不是硬性限制。

## 7. 避免配置冲突

不要在以下位置长期写死第三方供应商环境变量：

- `~/.bashrc`
- `~/.profile`
- `~/.claude/settings.json` 的 `env`
- 项目的 `.env`
- VS Code 的全局终端环境配置

尤其检查并清理这些变量：

```bash
env | grep -E 'ANTHROPIC|CLAUDE_CODE|ENABLE_TOOL_SEARCH'
```

启动器只影响它启动的 Claude Code 进程，不会永久污染其他终端。

## 8. 故障排查

### 命令不存在

```bash
source ~/.bashrc
echo "$PATH"
ls -l ~/.local/bin/cc-*
```

### API Key 未读取

```bash
ls -l ~/.config/claude-code/providers.env
nano ~/.config/claude-code/providers.env
```

权限应类似：

```text
-rw-------
```

修复权限：

```bash
chmod 600 ~/.config/claude-code/providers.env
```

### 实际模型不对

在 Claude Code 中使用：

```text
/status
```

同时排查残留变量：

```bash
env | grep -E 'ANTHROPIC|CLAUDE_CODE|ENABLE_TOOL_SEARCH'
grep -R "ANTHROPIC_" ~/.bashrc ~/.profile ~/.claude 2>/dev/null
```

### Kimi 返回 401/404

优先确认：

1. 使用的是 Kimi API 开放平台 Key，而不是 Kimi Code Key。
2. Key 与中国站/国际站端点区域匹配。
3. 账户具备模型调用权限与余额。
4. Claude Code 模型别名为 `kimi-k3[1m]`。

### DeepSeek 模型调用失败

确认当前官方模型别名是否仍为：

```text
deepseek-v4-pro[1m]
deepseek-v4-flash
```

模型名称可能随供应商发布而变化，应以 DeepSeek 官方 Claude Code 集成文档为准。

## 9. 安全说明

- `providers.env` 存放真实密钥，只应保存在本机。
- 不要截图、粘贴或发送真实密钥。
- 不要把该文件放入云盘同步目录。
- 怀疑泄露时立即撤销并重新生成密钥。
- 第三方模型通过兼容网关接入 Claude Code，功能兼容性可能随 Claude Code 更新而变化。
- Claude Code 官方并不为非 Claude 模型提供支持，出现兼容问题时应同时检查模型供应商文档。

## 10. 卸载

```bash
cd claude-code-wsl-kit
./uninstall.sh
```

卸载脚本不会删除私有密钥文件。手动删除：

```bash
rm ~/.config/claude-code/providers.env
```
