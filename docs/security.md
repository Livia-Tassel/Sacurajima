# 安全规范

## 核心原则

- 渲染层最小权限
- 敏感信息最小暴露
- 外部输入显式校验
- 错误信息不泄露机密

## Electron 安全基线

- `nodeIntegration: false`
- `contextIsolation: true`
- `sandbox: true`
- 禁用或限制 `shell.openExternal`
- 所有 IPC 通道白名单化

## 敏感数据处理

- API Key 不明文落盘
- 优先使用 Electron `safeStorage` 存储加密后的 API Key
- 若加密环境不可用，保存操作必须失败并返回明确错误，而不是降级为明文
- 日志中禁止输出完整请求头或 Key
- 配置读取失败时返回安全默认值，不抛出原始敏感内容

## 网络安全

- 只请求用户明确配置的兼容 API 站点
- 为请求设置超时和中止能力
- 对 SSE 流式内容做健壮解析，忽略脏数据段

## 输入校验

- 所有 IPC 入参使用 schema 校验
- URL 规范化后再使用
- 文本输入限制最大长度，避免异常大 payload

## 审查要求

- 每个功能完成后记录一次安全和严谨性审查
- 若发现风险，先修复再提交
