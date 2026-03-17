# ADR 0001: 采用 Electron + Vite + React + TypeScript

## 状态

已接受

## 背景

当前环境具备 Node.js，但不具备 Rust 工具链。项目目标是以较低工程阻力构建 macOS 本地桌面应用，并需要透明窗口、托盘、双窗口协调和前端 UI 快速开发能力。

## 决策

采用 Electron + Vite + React + TypeScript：

- Electron 负责桌面能力
- Vite 负责前端开发体验
- React 负责复杂 UI 状态和组件组织
- TypeScript 负责跨进程合同和数据结构约束

## 后果

- 能快速落地 macOS 桌面能力
- 安全配置需要显式管理
- 打包与资源处理有成熟生态可用
