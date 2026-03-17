# Feature 03: New API 配置引导

## 目标

提供首启引导、New API 优先预设、通用兼容配置、本地加密存储和连接测试。

## 核心行为

- 无配置时进入引导页
- 默认选择 `New API`
- 自动规范化站点地址为兼容基址
- 保存配置时加密 API Key
- 提供模型连通性测试

## 实现约束

- `New API` 模式以站点地址为主输入，自动推导兼容基址
- `Custom` 模式保留完整 `baseUrl` 输入
- 已保存 API Key 不回显；用户留空时沿用旧值
- 连接测试统一请求 `GET /models`，并设置超时

## 实现结果

- 已新增共享配置合同与 `normalizeBaseUrl()`，供 renderer 和 main 共用
- 已实现 `ConfigStore`，负责配置持久化、`safeStorage` 加密、解密与结构化错误返回
- 已通过 preload 暴露 `settings.load()`、`settings.save()`、`settings.testConnection()`
- 已将 panel 主视图切换为配置引导表单，支持 `New API / Custom Compatible` 切换
- 已保存 API Key 后，后续进入设置仅显示“已安全保存”，不回显明文
- 连接测试会返回规范化基址、模型数量和最多 5 个样本模型名
- 启动期配置加载和设置操作已补充异常兜底，不再因 Promise reject 卡死在 busy/loading 态
- 已禁止 Custom 模式直接填写 `/models` 或 `/chat/completions` 终点地址，避免双重路径拼接
- 配置文件损坏时会显式报错，而不是静默回退为空配置

## 验证结果

- `npm run typecheck`：通过
- `npm test`：通过
- `npm run build`：通过
- `npm run dev`：启动通过，主进程、preload、renderer 无启动期报错

## 验收标准

- 可保存并恢复配置
- 可区分认证失败、超时、无效响应和网络错误

## 安全与严谨性审查

- API Key 只在 save/test 请求瞬间存在于 renderer 内存，不在设置读取接口中回传
- 本地保存强依赖 Electron `safeStorage`；若环境不支持加密，保存操作显式失败
- 已补充无效 URL 容错，避免 Base URL 规范化在坏输入下抛出未处理异常
- 连接测试对鉴权失败、超时、非 JSON 响应、错误结构分别给出稳定分类
- 已发现并修正一处错误路径：`safeStorage` 不可用时原本会误报缺少配置，现已修正为 `UNSUPPORTED_ENV`
- `hasApiKey` 现在基于可解密状态而不是密文字段是否存在，避免 UI 谎报“已有 Key”
