# Feature 04: 聊天与本地会话

## 目标

实现会话列表、流式聊天、非流式回退、生成中止和本地历史存储。

## 核心行为

- 用户发送消息后生成新会话或追加到现有会话
- 优先流式接收回复
- 流式失败时自动回退
- 允许中止当前生成
- 会话在本地持久化

## 实现约束

- 会话历史保存在本地 JSON store
- 流式事件统一由主进程广播给 renderer
- 非 SSE 响应在同一请求中按普通 JSON completion 解析，不再额外重发
- 中止生成时保留已有部分输出，空占位消息可移除

## 实现结果

- 已新增共享聊天模型、会话标题规则与事件类型定义
- 已实现 `ChatSessionStore`，在本地 JSON 中保存完整会话历史
- 已实现 `ChatService`，负责发送请求、流式解析、普通 JSON 回退、生成中止和错误广播
- preload 已暴露 `chat.*`、`history.*` 与 `events.onChatEvent()`
- panel 已切换为聊天工作区，支持会话列表、新建会话、加载历史、清理当前会话
- renderer 通过事件流增量更新 assistant 消息，不直接触碰主进程网络实现

## 验证结果

- `npm run typecheck`：通过
- `npm test`：通过
- `npm run build`：通过
- `npm run dev`：启动通过，新增 chat/history IPC 未引入启动期错误

## 验收标准

- 会话列表和消息记录可恢复
- 错误态有明确提示

## 安全与严谨性审查

- 聊天请求仍仅在主进程发出，renderer 不直接持有网络能力
- 进行中的请求通过 `AbortController` 管理，终止逻辑不依赖渲染层自我约束
- SSE 解析只接受 `data:` 事件，脏数据和畸形 JSON 会被稳定归类为 `INVALID_RESPONSE`
- 若 assistant 占位消息在失败/中止前没有实际内容，会从历史中移除，避免污染本地会话
- 已补单元测试覆盖会话标题裁剪规则，避免 sidebar 展示不稳定
