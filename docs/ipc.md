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

## `chat.send(message, sessionId)`

- 作用：发起聊天请求
- 入参：
  - `message: string`
  - `sessionId?: string`
- 返回：
  - `ok: true`
  - `data: { sessionId: string }`
  - 通过事件流推送增量内容

## `chat.abort(sessionId)`

- 作用：中止指定会话中的生成请求
- 返回：
  - `ok: true`

## `history.list()`

- 作用：获取会话摘要列表

## `history.get(sessionId)`

- 作用：获取完整会话

## `history.clear(sessionId)`

- 作用：清理单个会话

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
  - `session-updated`
