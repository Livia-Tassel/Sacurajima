# 故障排查

## 应用无法聊天

- 确认已在设置中保存 `API Key` 和 `Model`
- 确认 `Normalized Base URL` 指向兼容接口，而不是站点首页
- 先点击 `Test Connection`，根据错误提示区分鉴权、超时或返回结构错误

## 测试连接失败

- `UNAUTHORIZED`：检查 Key 是否有效
- `TIMEOUT`：检查网络或目标服务响应时间
- `INVALID_RESPONSE`：目标站点不是标准兼容接口，或返回结构不符合 `/models`
- `NETWORK_ERROR`：目标地址不可达、DNS 异常或 TLS 问题

## 面板或桌宠位置异常

- 应用会自动回退到安全窗口布局
- 若仍异常，可删除用户数据目录中的窗口状态文件后重启

## macOS 打包后无法直接打开

- 当前版本为本地 unsigned 构建
- 若系统阻止启动，请在系统设置中允许该应用，或右键后选择“打开”

