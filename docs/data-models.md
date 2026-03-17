# 数据模型

## AppConfigInput

```ts
type ProviderPreset = 'newapi' | 'custom';

type AppConfigInput = {
  providerPreset: ProviderPreset;
  siteUrl?: string;
  baseUrl?: string;
  apiKey: string;
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
  baseUrlNormalized: string;
  model: string;
  systemPrompt: string;
  temperature: number;
  hasApiKey: boolean;
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

## CompanionMood

```ts
type CompanionMood = 'idle' | 'thinking' | 'replying' | 'sleeping' | 'error';
```

## IpcError

```ts
type IpcError = {
  code:
    | 'VALIDATION_ERROR'
    | 'UNAUTHORIZED'
    | 'TIMEOUT'
    | 'NETWORK_ERROR'
    | 'INVALID_RESPONSE'
    | 'NOT_FOUND'
    | 'UNKNOWN_ERROR';
  message: string;
  retriable: boolean;
};
```

