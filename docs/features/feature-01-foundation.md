# Feature 01: 项目脚手架与规范基线

## 目标

建立 Sakurajima 的基础工程、文档体系和开发规范，确保后续所有开发都能沿着统一的结构推进。

## 设计

- 使用 Electron + Vite + React + TypeScript
- 建立 `main / preload / renderer / shared` 分层
- 引入测试、打包和类型检查基础设施
- 建立文档索引、功能文档和审查记录位置
- 采用 `tsx + node:test` 作为轻量单元测试基线，避免基础阶段引入过重测试依赖

## 实现结果

- 已创建 `electron.vite.config.ts`、TypeScript 配置、`package.json` 与基础脚本
- 已建立最小可运行主进程、preload 和 renderer，占位界面可展示应用版本
- 已加入文档一致性检查脚本 `scripts/check-docs-consistency.mjs`
- 已建立首个共享模块 `src/shared/app-meta.ts` 及对应测试

## 验证结果

- `npm install --no-audit`：通过
- `npm run typecheck`：通过
- `npm test`：通过
- `npm run build`：通过

## 验收标准

- 仓库可安装依赖并启动基础开发环境
- 文档骨架完整
- 存在统一脚本用于开发、构建、测试

## 安全与严谨性审查

- 主进程已启用 `contextIsolation`、`sandbox`，并禁用 `nodeIntegration`
- 渲染层仅通过 preload 获取 `app.getVersion`，未暴露任意文件或命令能力
- 文档检查脚本已纳入测试流程，作为文档驱动开发的最小一致性闸门
- 基础阶段未引入高风险 HTML 注入点，renderer 仅渲染静态 React 内容
- 已发现并修复一次类型合同偏差：渲染层全局 API 类型声明缺失，现已通过 `global.d.ts` 和 TS 校验锁定
