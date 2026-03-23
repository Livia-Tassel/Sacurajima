# 数据模型

## AppConfigInput

```ts
type ProviderPreset = 'newapi' | 'custom';

type AppConfigInput = {
  providerPreset: ProviderPreset;
  siteUrl?: string;
  baseUrl?: string;
  apiKey?: string;
  model: string;
  systemPrompt: string;
  temperature: number;
};
```

## AppConfigView

```ts
type AppConfigView = {
  providerPreset: ProviderPreset;
  siteUrl?: string;
  baseUrl?: string;
  baseUrlNormalized: string;
  model: string;
  systemPrompt: string;
  temperature: number;
  hasApiKey: boolean;
};
```

## ConnectionTestResult

```ts
type ConnectionTestResult = {
  ok: boolean;
  normalizedBaseUrl: string;
  modelCount?: number;
  sampledModels?: string[];
  message: string;
  errorCode?:
    | 'VALIDATION_ERROR'
    | 'MISSING_CONFIG'
    | 'UNAUTHORIZED'
    | 'TIMEOUT'
    | 'NETWORK_ERROR'
    | 'INVALID_RESPONSE'
    | 'UNKNOWN_ERROR';
};
```

## ChatMessage

```ts
type ChatMessage = {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  createdAt: string;
  status?: 'streaming' | 'done' | 'error';
};
```

## SessionSummary

```ts
type SessionSummary = {
  id: string;
  title: string;
  updatedAt: string;
  lastMessagePreview: string;
};
```

## ChatSession

```ts
type ChatSession = {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
};
```

## ChatEvent

```ts
type ChatEvent =
  | { type: 'chat-start'; session: ChatSession }
  | { type: 'chat-delta'; sessionId: string; messageId: string; delta: string }
  | { type: 'chat-complete'; session: ChatSession }
  | { type: 'chat-error'; session: ChatSession; error: IpcError }
  | { type: 'chat-abort'; session: ChatSession };
```

## CompanionMood

```ts
type CompanionMood =
  | 'idle'
  | 'checkin'
  | 'listening'
  | 'thinking'
  | 'happy'
  | 'sleepy'
  | 'error';
```

## CompanionPromptAction

```ts
type CompanionPromptAction = {
  id: string;
  label: string;
  seedMessage: string;
  resultingMood?: CompanionMood;
};
```

## CompanionPrompt

```ts
type CompanionPrompt = {
  id: string;
  templateId: string;
  text: string;
  actions: CompanionPromptAction[];
  createdAt: string;
  expiresAt: string;
};
```

## CompanionEvent

```ts
type CompanionEvent =
  | { type: 'companion-state'; mood: CompanionMood; reason: string }
  | { type: 'companion-prompt'; prompt: CompanionPrompt }
  | { type: 'companion-dismiss'; promptId: string; reason: 'timeout' | 'manual' | 'acted' }
  | {
      type: 'companion-action-result';
      promptId: string;
      action: CompanionPromptAction;
      seedMessage: string;
      mood: CompanionMood;
    };
```

## CompanionPrefs

```ts
type CompanionProactiveLevel = 'low' | 'balanced' | 'active';

type CompanionPrefs = {
  proactiveEnabled: boolean;
  proactiveLevel: CompanionProactiveLevel;
  quietHours: {
    start: string;
    end: string;
  };
};
```

## CompanionActivity

```ts
type CompanionActivity = {
  id: string;
  type: 'prompt' | 'response' | 'dismiss';
  text: string;
  createdAt: string;
  promptId?: string;
  actionId?: string;
  seedMessage?: string;
};
```

## WindowState

```ts
type WindowState = {
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
};
```

## PersistedWindowState

```ts
type PersistedWindowState = {
  companion: WindowState;
  panel: WindowState;
};
```

## IpcError

```ts
type IpcError = {
  code:
    | 'VALIDATION_ERROR'
    | 'MISSING_CONFIG'
    | 'UNAUTHORIZED'
    | 'TIMEOUT'
    | 'NETWORK_ERROR'
    | 'INVALID_RESPONSE'
    | 'NOT_FOUND'
    | 'UNSUPPORTED_ENV'
    | 'UNKNOWN_ERROR';
  message: string;
  retriable: boolean;
};
```
