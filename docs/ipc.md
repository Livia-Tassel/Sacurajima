# IPC 合同

## 设计原则

- 只暴露渲染层真正需要的方法
- 所有输入在主进程校验
- 所有返回结构稳定、可类型化
- 错误码与错误消息分离

## `settings.load()`

- 作用：读取当前配置和 UI 偏好
- 返回：
  - `ok: true`
  - `data: AppConfigView`

## `settings.save(config)`

- 作用：保存配置
- 入参：`AppConfigInput`
- 规则：
  - `apiKey` 为空时，若本地已有已保存 Key，则沿用原值
  - 若本地不存在 Key，则 `apiKey` 为空视为错误
- 返回：
  - `ok: true`
  - `data: AppConfigView`
  - 或 `ok: false`, `error: IpcError`

## `settings.testConnection(config)`

- 作用：使用临时或已保存配置测试连接
- 入参：`ConnectionTestInput`
- 返回：
  - `ok: true`
  - `data: ConnectionTestResult`
  - 或 `ok: false`, `error: IpcError`
- 规则：
  - 使用规范化后的兼容基址请求 `GET /models`
  - 成功时返回模型数量与最多 5 个样本模型名
  - 不泄露完整鉴权头或原始敏感响应

## `chat.send(message, sessionId)`

- 作用：发起聊天请求
- 入参：
  - `message: string`
  - `sessionId?: string`
- 返回：
  - `ok: true`
  - `data: { sessionId: string }`
  - 通过 `events.onChatEvent` 推送增量内容

## `chat.abort(sessionId)`

- 作用：中止指定会话中的生成请求
- 返回：
  - `ok: true`

## `history.list()`

- 作用：获取会话摘要列表
- 返回：
  - `ok: true`
  - `data: SessionSummary[]`

## `history.get(sessionId)`

- 作用：获取完整会话
- 返回：
  - `ok: true`
  - `data: ChatSession`

## `history.clear(sessionId)`

- 作用：清理单个会话
- 返回：
  - `ok: true`
  - `data: { sessionId: string }`

## `window.togglePanel()`

- 作用：切换聊天面板显隐
- 返回：
  - `ok: true`
  - `data: { visible: boolean }`

## `window.showPanel()`

- 作用：显式展示聊天面板并聚焦
- 返回：
  - `ok: true`
  - `data: { visible: true }`

## `events.onChatEvent(callback)`

- 事件类型：
  - `chat-start`
  - `chat-delta`
  - `chat-complete`
  - `chat-error`
  - `chat-abort`
