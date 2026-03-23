# 快速开始

## 本地开发

1. 安装依赖：`npm install`
2. 启动开发环境：`npm run dev`
3. 打开面板后，在设置页填写：
   - `New API` 站点地址或兼容 `Base URL`
   - `API Key`
   - `Model`
4. 点击 `Test Connection`
5. 保存配置后切换到聊天页开始使用

## 打包本地应用

1. 运行 `npm run make`
2. 在 `release/` 目录查看生成的 `dmg` 与 `zip`
3. 首次在 macOS 打开 unsigned 应用时，若系统拦截，请在系统设置中手动允许

## 当前版本说明

- 首发平台：macOS ARM64
- 交互方式：文字聊天
- 陪伴能力：支持主动关怀提示、快捷回应、可配置静默时段
- 数据：配置与会话均本地保存
- 图片资产：当前内置 SVG 版本，可后续替换为生成式资产
