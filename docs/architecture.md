# Sakurajima 架构说明

## 进程划分

- Main Process：窗口、托盘、持久化、配置加密、网络请求编排、IPC 管理
- Preload：为渲染层暴露白名单 API，不提供任意 Node 访问
- Renderer：React UI，负责桌宠界面、聊天面板、设置页、状态展示

## 核心窗口

- `CompanionWindow`
  - 透明、无边框、可拖动、常驻前台
  - 用于展示角色形象、轻量动效、状态反馈
- `PanelWindow`
  - 常规窗口样式，可展开聊天和设置
  - 支持首启引导、历史会话浏览、错误提示

## 数据流

1. Renderer 通过 preload API 发起设置保存、连接测试、聊天请求
2. Main 负责校验入参、读取配置、请求网络、持久化状态
3. Renderer 只消费结构化返回值，不直接访问文件系统或网络配置

## 存储策略

- 配置与 UI 偏好：本地 JSON store
- API Key：Electron `safeStorage` 加密后存储
- 会话历史：本地 JSON store，按 session 组织
- 窗口状态：独立持久化，包含位置、尺寸、可见性

## 外部依赖边界

- 聊天能力：OpenAI-compatible API，优先适配 New API
- 图片生成：仅开发阶段资产生产，非运行时依赖
- 打包：electron-builder

