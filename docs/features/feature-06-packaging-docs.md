# Feature 06: 打包与使用文档

## 目标

提供可用的 macOS 本地打包能力，以及面向最终用户的快速开始与问题排查文档。

## 核心行为

- 生成可分发的应用构建产物
- 提供配置说明、启动说明和故障排查
- 明确当前不包含的能力边界

## 实现约束

- 产物以本地 unsigned macOS 分发为目标
- 图标生成应尽量复用现有品牌资产，避免维护两套视觉来源
- 打包配置与用户文档必须一起提交，避免“能构建但不会用”
- 打包链路优先选择本机可控脚本，不依赖不稳定的上游 builder 二进制

## 实现结果

- 已新增 `docs/quickstart.md` 与 `docs/troubleshooting.md`
- 已新增 `build:icons`、`make`、`make:dir` 脚本
- 已实现 `SVG -> icns` 图标流水线，并将品牌图标覆写进最终 `.app` 包
- 已采用 `@electron/packager + ditto + hdiutil` 生成本地 unsigned `.app/.zip/.dmg`
- 已修正 ZIP 打包对象，确保 ZIP 与 DMG 都以 `Sakurajima.app` 为核心分发内容
- 已在 `release/` 目录生成：
  - `Sakurajima-darwin-arm64/Sakurajima.app`
  - `Sakurajima-0.1.0-arm64.zip`
  - `Sakurajima-0.1.0-arm64.dmg`

## 验证结果

- `npm test`：通过
- `npm run build:icons`：通过
- `npm run make`：通过
- 已确认打包后 `electron.icns` 与生成的品牌 `icon.icns` 校验和一致

## 验收标准

- 本机可完成构建
- 文档可指导用户完成首次配置

## 安全与严谨性审查

- 产物定位为本地 unsigned 分发，文档已明确 Gatekeeper 行为和手动允许方式
- 打包链路不再依赖卡死在安装阶段的上游 builder 二进制，减少交付不可控性
- 图标生成和打包均为本地脚本，输入输出路径固定，避免人工拷贝造成遗漏
- 已验证 `.app` 内实际使用的是仓库生成的品牌图标，而不是默认 Electron 图标
