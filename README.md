# AgentManager

多实例 Claude Code CLI 管理器 — Electron 桌面应用。

![Electron](https://img.shields.io/badge/Electron-35-blue)
![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)
![Platform](https://img.shields.io/badge/Platform-Windows-blue)

## 功能

- **看板管理** — 拖拽卡片在可自定义列名的看板之间切换
- **多实例并行** — 同时运行多个 Claude Code，各自独立工作目录和 API 配置
- **独立终端窗口** — 每个实例拥有独立的 Electron 终端窗口（xterm.js），原生体验
- **API 隔离** — 设置自定义 API 地址时自动创建隔离 `CLAUDE_CONFIG_DIR`，无需全局切换
- **实例模板** — 创建新实例时可从已有实例复制配置
- **实时状态** — 区分"运行中"、"正在工作"、"待确认"、"已完成"四种状态，token 用量实时追踪
- **操作通知** — 需要授权/选择时卡片提醒 + 系统通知弹窗
- **通知开关** — 顶部状态栏铃铛按钮一键开关系统通知
- **任务完成通知** — agent 输出结束等待输入时发送系统通知
- **会话历史** — 持久化保存对话日志，可回看历史记录
- **系统托盘** — 关闭窗口最小化到托盘，后台持续运行

## 快速开始

### 环境要求

- **Node.js** 18+
- **Claude Code CLI**（`npm install -g @anthropic-ai/claude-code` 或通过 npx 使用）
- **C++ Build Tools**（编译 node-pty 需要，Windows 需安装 [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)）
- **Python**（node-gyp 依赖，需安装 setuptools：`pip install setuptools`）

### 安装与运行

```bash
git clone git@github.com:guaner-334/AgentManager.git
cd AgentManager
npm install
npm run dev
```

### 打包

```bash
npm run build      # 构建
npm run package    # 打包为可分发安装包（electron-builder）
```

## 使用说明

### 创建实例

点击 **「+ 新建实例」**，填写：

| 字段 | 说明 | 必填 |
|------|------|------|
| 名称 | 实例显示名 | 是 |
| 工作目录 | Claude 的工作路径（可用文件夹选择器） | 是 |
| API Base URL | 自定义 API 地址（如 MiniMax） | 否 |
| API Key | 自定义密钥 | 否 |
| 模型 | 如 `claude-sonnet-4-20250514` | 否 |
| System Prompt | 自定义系统提示 | 否 |
| 权限模式 | `bypassPermissions`（自动批准）或 `default` | 否 |

> 可从已有实例模板创建，自动复制 API 配置。

### 启动 / 停止

- 点击实例卡片上的 **▶** 按钮启动，自动弹出独立终端窗口
- 点击终端图标重新打开已运行实例的终端窗口
- 点击 **■** 按钮停止实例

### 状态指示

- **空闲** — 实例未启动
- **运行中** — 实例已启动，等待用户输入
- **正在工作** — agent 正在输出内容（文字波浪动效）
- **待确认** — 需要用户授权或选择（琥珀色脉冲）
- **已完成** — agent 完成任务等待输入

### 看板管理

- 拖动卡片到不同列管理任务状态
- 双击列标题可自定义列名

## 项目结构

```
AgentManager/
├── electron/                  # Electron 主进程
│   ├── main.ts                    # 窗口管理、托盘、事件转发
│   ├── preload.ts                 # contextBridge API
│   ├── ipc/
│   │   └── handlers.ts            # IPC 处理器（替代 REST API）
│   └── services/
│       ├── processManager.ts      # PTY 进程管理、状态检测
│       ├── instanceStore.ts       # 实例数据持久化（JSON）
│       └── configIsolation.ts     # API 隔离配置
├── src/                       # React 渲染进程
│   ├── App.tsx                    # 路由（看板 / 终端窗口）
│   ├── main.tsx                   # React 入口
│   ├── types.ts                   # 类型定义
│   ├── hooks/
│   │   └── useInstances.ts        # 实例状态管理（IPC 事件）
│   └── components/
│       ├── KanbanPage.tsx         # 主看板页面
│       ├── KanbanBoard.tsx        # 看板拖拽容器
│       ├── KanbanColumn.tsx       # 看板列（可编辑列名）
│       ├── InstanceCard.tsx       # 实例卡片
│       ├── TerminalWindow.tsx     # 独立终端窗口
│       ├── ConfigDialog.tsx       # 配置弹窗
│       ├── FolderPicker.tsx       # 文件夹选择器
│       ├── SessionHistoryDialog.tsx # 会话历史
│       └── StatusBadge.tsx        # 状态徽章
├── data/                      # 运行时数据（自动生成）
│   ├── instances.json
│   ├── logs/
│   └── claude-configs/
├── vite.config.ts
├── electron-builder.yml
└── package.json
```

## 开发

```bash
npm run dev        # 启动开发模式（Vite + Electron 热重载）
npm run build      # 构建生产版本
npm run package    # 打包桌面安装包
```

## 技术栈

- **Electron** — 桌面应用框架
- **React + TypeScript** — UI
- **Tailwind CSS** — 样式
- **xterm.js** — 终端渲染
- **node-pty** — PTY 进程管理
- **@dnd-kit** — 拖拽排序
- **Vite + vite-plugin-electron** — 构建工具
