import { randomUUID } from 'node:crypto';
import type { ChatEvent } from '../shared/chat';
import type { IpcError, IpcResult } from '../shared/config';
import type { CompanionStateStore } from './companion-state-store';
import {
  hasRecentInteraction,
  hasTemplateCooldownElapsed,
  isWithinQuietHours,
  resolveProactiveIntervalMs,
  sanitizeCompanionPrefs,
  type CompanionEvent,
  type CompanionMood,
  type CompanionPrefs,
  type CompanionPrompt,
  type CompanionPromptAction,
  type CompanionRespondInput
} from '../shared/companion';

type TimerHandle = ReturnType<typeof setTimeout>;

type PromptTemplate = {
  id: string;
  text: string;
  actions: CompanionPromptAction[];
};

type EngineClock = {
  now: () => Date;
  random: () => number;
  setTimeout: (callback: () => void, delayMs: number) => TimerHandle;
  clearTimeout: (timer: TimerHandle) => void;
};

const PROMPT_TIMEOUT_MS = 55_000;
const STARTUP_PROMPT_DELAY_MS = 8_000;
const RECENT_INTERACTION_MINUTES = 12;
const TEMPLATE_COOLDOWN_HOURS = 24;

const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: 'morning-checkin',
    text: '我在这儿陪你。现在的状态怎么样？',
    actions: [
      {
        id: 'morning-okay',
        label: '我还好',
        seedMessage: '我现在状态还可以，想简单聊聊今天的节奏。',
        resultingMood: 'happy'
      },
      {
        id: 'morning-tired',
        label: '有点累',
        seedMessage: '我现在有点疲惫，想听你给我一个温和的节奏建议。',
        resultingMood: 'listening'
      },
      {
        id: 'morning-talk',
        label: '陪我聊聊',
        seedMessage: '我想和你聊聊，我现在需要一点陪伴。',
        resultingMood: 'listening'
      }
    ]
  },
  {
    id: 'midday-breath',
    text: '要不要一起停 1 分钟，做个小小的呼吸整理？',
    actions: [
      {
        id: 'midday-yes',
        label: '现在就做',
        seedMessage: '请带我做一个一分钟的呼吸整理，步骤尽量简单。',
        resultingMood: 'happy'
      },
      {
        id: 'midday-later',
        label: '稍后提醒',
        seedMessage: '我稍后再整理状态，先帮我记录一下我需要休息。',
        resultingMood: 'idle'
      },
      {
        id: 'midday-talk',
        label: '先聊两句',
        seedMessage: '我想先说说我现在的感受，请你听我讲讲。',
        resultingMood: 'listening'
      }
    ]
  },
  {
    id: 'workload-checkin',
    text: '最近信息有点多，要不要先把心里最重的一件事说出来？',
    actions: [
      {
        id: 'workload-one',
        label: '我来说说',
        seedMessage: '我现在最有压力的是这件事：',
        resultingMood: 'listening'
      },
      {
        id: 'workload-light',
        label: '其实还行',
        seedMessage: '我目前压力还可控，帮我做个轻量计划就好。',
        resultingMood: 'happy'
      },
      {
        id: 'workload-silent',
        label: '先安静会儿',
        seedMessage: '我想先安静一下，再继续聊。',
        resultingMood: 'sleepy'
      }
    ]
  },
  {
    id: 'energy-checkin',
    text: '今天你已经很努力了。要不要我帮你做个温柔的收尾？',
    actions: [
      {
        id: 'energy-wrap',
        label: '帮我收尾',
        seedMessage: '请帮我做一个温和的今日收尾步骤，三步以内。',
        resultingMood: 'happy'
      },
      {
        id: 'energy-chat',
        label: '我想倾诉',
        seedMessage: '我想倾诉一下今天让我情绪波动的事情。',
        resultingMood: 'listening'
      },
      {
        id: 'energy-later',
        label: '晚点再说',
        seedMessage: '我晚点再聊，先让我缓一缓。',
        resultingMood: 'idle'
      }
    ]
  },
  {
    id: 'gentle-reminder',
    text: '我还在这里，如果你愿意，我们可以慢慢说。',
    actions: [
      {
        id: 'gentle-open',
        label: '那就聊聊',
        seedMessage: '谢谢你在，我现在想慢慢说说我的状态。',
        resultingMood: 'listening'
      },
      {
        id: 'gentle-ok',
        label: '我还稳得住',
        seedMessage: '我现在还稳得住，帮我保持这个状态。',
        resultingMood: 'happy'
      },
      {
        id: 'gentle-break',
        label: '我先休息',
        seedMessage: '我想先休息一会，之后再继续。',
        resultingMood: 'sleepy'
      }
    ]
  },
  {
    id: 'late-checkin',
    text: '如果你愿意，可以把现在最想说的一句话交给我。',
    actions: [
      {
        id: 'late-say',
        label: '我想说',
        seedMessage: '我现在最想说的一句话是：',
        resultingMood: 'listening'
      },
      {
        id: 'late-thanks',
        label: '谢谢陪伴',
        seedMessage: '谢谢你陪着我，帮我整理一下此刻的情绪。',
        resultingMood: 'happy'
      },
      {
        id: 'late-pass',
        label: '先略过',
        seedMessage: '我先略过这次提醒，晚点再聊。',
        resultingMood: 'idle'
      }
    ]
  }
];

function createError(code: IpcError['code'], message: string, retriable: boolean): IpcError {
  return { code, message, retriable };
}

export class CompanionEngine {
  private activePrompt: CompanionPrompt | null = null;
  private mood: CompanionMood = 'idle';
  private started = false;
  private promptTimer: TimerHandle | null = null;
  private dismissTimer: TimerHandle | null = null;
  private moodTimer: TimerHandle | null = null;

  constructor(
    private readonly stateStore: CompanionStateStore,
    private readonly broadcastToRenderers: (event: CompanionEvent) => void,
    private readonly clock: Partial<EngineClock> = {}
  ) {}

  start() {
    if (this.started) {
      return;
    }

    this.started = true;
    const prefs = this.stateStore.getPrefs();
    this.emitState(prefs.proactiveEnabled ? 'idle' : 'sleepy', 'startup');
    this.schedulePrompt(STARTUP_PROMPT_DELAY_MS, 'startup');
  }

  stop() {
    this.started = false;
    this.clearTimer('prompt');
    this.clearTimer('dismiss');
    this.clearTimer('mood');
    this.activePrompt = null;
  }

  listActivities() {
    return this.stateStore.listActivities(10);
  }

  getPrefs() {
    return this.stateStore.getPrefs();
  }

  savePrefs(input: CompanionPrefs): IpcResult<CompanionPrefs> {
    const nextPrefs = sanitizeCompanionPrefs(input);
    const saved = this.stateStore.savePrefs(nextPrefs);

    if (!saved.proactiveEnabled && this.activePrompt) {
      this.dismissActivePrompt('manual', false);
    }

    this.emitState(saved.proactiveEnabled ? 'idle' : 'sleepy', 'prefs-updated');
    this.scheduleNextInterval();

    return {
      ok: true,
      data: saved
    };
  }

  nudge(): IpcResult<{ triggered: boolean }> {
    const now = this.now();
    this.stateStore.noteInteraction(now.toISOString());
    const triggered = this.triggerPrompt('manual-nudge', true);

    return {
      ok: true,
      data: {
        triggered
      }
    };
  }

  respond(input: CompanionRespondInput): IpcResult<{ promptId: string; actionId: string }> {
    const prompt = this.activePrompt;
    if (!prompt || prompt.id !== input.promptId) {
      return {
        ok: false,
        error: createError('NOT_FOUND', 'No active companion prompt matched the selected action.', false)
      };
    }

    const action = prompt.actions.find((candidate) => candidate.id === input.actionId);
    if (!action) {
      return {
        ok: false,
        error: createError('VALIDATION_ERROR', 'The selected companion action is invalid.', false)
      };
    }

    const nowIso = this.now().toISOString();
    this.stateStore.noteInteraction(nowIso);
    this.stateStore.addActivity({
      type: 'response',
      text: action.label,
      createdAt: nowIso,
      promptId: prompt.id,
      actionId: action.id,
      seedMessage: action.seedMessage
    });

    const mood = action.resultingMood ?? 'listening';
    this.broadcastToRenderers({
      type: 'companion-action-result',
      promptId: prompt.id,
      action,
      seedMessage: action.seedMessage,
      mood
    });

    this.dismissActivePrompt('acted', false);
    this.emitTransientMood(mood, 'action-result');

    return {
      ok: true,
      data: {
        promptId: prompt.id,
        actionId: action.id
      }
    };
  }

  dismiss(promptId: string): IpcResult<{ promptId: string }> {
    const prompt = this.activePrompt;
    if (!prompt || prompt.id !== promptId) {
      return {
        ok: false,
        error: createError('NOT_FOUND', 'The companion prompt is no longer active.', false)
      };
    }

    this.dismissActivePrompt('manual', true);

    return {
      ok: true,
      data: { promptId }
    };
  }

  handleChatEvent(event: ChatEvent) {
    const nowIso = this.now().toISOString();

    if (event.type === 'chat-start') {
      this.stateStore.noteInteraction(nowIso);
      this.emitState('thinking', 'chat-start');
      return;
    }

    if (event.type === 'chat-complete') {
      this.stateStore.noteInteraction(nowIso);
      this.emitTransientMood('happy', 'chat-complete');
      this.scheduleNextInterval(90_000);
      return;
    }

    if (event.type === 'chat-error') {
      this.stateStore.noteInteraction(nowIso);
      this.emitTransientMood('error', 'chat-error');
      this.scheduleNextInterval(60_000);
      return;
    }

    this.stateStore.noteInteraction(nowIso);
    this.emitState('idle', 'chat-abort');
  }

  private schedulePrompt(delayMs: number, reason: string) {
    this.clearTimer('prompt');
    this.promptTimer = this.setTimer(() => {
      this.promptTimer = null;
      const triggered = this.triggerPrompt(reason, false);
      if (!triggered) {
        this.scheduleNextInterval();
      }
    }, delayMs);
  }

  private scheduleNextInterval(overrideDelayMs?: number) {
    this.clearTimer('prompt');

    if (!this.started) {
      return;
    }

    const prefs = this.stateStore.getPrefs();
    if (!prefs.proactiveEnabled) {
      return;
    }

    const delayMs =
      typeof overrideDelayMs === 'number'
        ? overrideDelayMs
        : resolveProactiveIntervalMs(prefs.proactiveLevel, this.random());

    this.promptTimer = this.setTimer(() => {
      this.promptTimer = null;
      const triggered = this.triggerPrompt('interval', false);
      if (!triggered) {
        this.scheduleNextInterval();
      }
    }, delayMs);
  }

  private triggerPrompt(reason: string, manual: boolean): boolean {
    if (this.activePrompt) {
      return false;
    }

    const now = this.now();
    const prefs = this.stateStore.getPrefs();
    const memory = this.stateStore.getMemory();

    if (!manual && !prefs.proactiveEnabled) {
      this.emitState('sleepy', 'proactive-disabled');
      return false;
    }

    if (!manual && isWithinQuietHours(now, prefs.quietHours)) {
      this.emitState('sleepy', 'quiet-hours');
      this.scheduleNextInterval(20 * 60_000);
      return false;
    }

    if (!manual && reason === 'interval' && hasRecentInteraction(memory.lastInteractionAt, now, RECENT_INTERACTION_MINUTES)) {
      this.scheduleNextInterval(12 * 60_000);
      return false;
    }

    const template = this.pickTemplate(now);
    if (!template) {
      this.emitState('idle', 'template-cooldown');
      this.scheduleNextInterval(45 * 60_000);
      return false;
    }

    const createdAt = now.toISOString();
    const prompt: CompanionPrompt = {
      id: randomUUID(),
      templateId: template.id,
      text: template.text,
      actions: template.actions,
      createdAt,
      expiresAt: new Date(now.getTime() + PROMPT_TIMEOUT_MS).toISOString()
    };

    this.activePrompt = prompt;
    this.stateStore.notePromptShown(template.id, createdAt);
    this.stateStore.addActivity({
      type: 'prompt',
      text: prompt.text,
      createdAt,
      promptId: prompt.id
    });

    this.emitState('checkin', reason);
    this.broadcastToRenderers({
      type: 'companion-prompt',
      prompt
    });

    this.clearTimer('dismiss');
    this.dismissTimer = this.setTimer(() => {
      this.dismissTimer = null;
      this.dismissActivePrompt('timeout', true);
    }, PROMPT_TIMEOUT_MS);

    return true;
  }

  private pickTemplate(now: Date): PromptTemplate | null {
    const memory = this.stateStore.getMemory();
    const available = PROMPT_TEMPLATES.filter((template) =>
      hasTemplateCooldownElapsed(memory.templateShownAt[template.id], now, TEMPLATE_COOLDOWN_HOURS)
    );

    if (available.length === 0) {
      return null;
    }

    const index = Math.floor(this.random() * available.length);
    return available[index] ?? available[0];
  }

  private dismissActivePrompt(reason: 'timeout' | 'manual' | 'acted', addActivity: boolean) {
    const prompt = this.activePrompt;
    if (!prompt) {
      return;
    }

    this.activePrompt = null;
    this.clearTimer('dismiss');

    if (reason === 'timeout') {
      this.stateStore.incrementIgnored();
    }

    if (addActivity) {
      const nowIso = this.now().toISOString();
      this.stateStore.addActivity({
        type: 'dismiss',
        text: reason === 'timeout' ? 'Companion prompt timed out.' : 'Companion prompt dismissed.',
        createdAt: nowIso,
        promptId: prompt.id
      });
    }

    this.broadcastToRenderers({
      type: 'companion-dismiss',
      promptId: prompt.id,
      reason
    });

    this.emitState(this.stateStore.getPrefs().proactiveEnabled ? 'idle' : 'sleepy', `prompt-dismiss:${reason}`);
    this.scheduleNextInterval();
  }

  private emitState(mood: CompanionMood, reason: string) {
    this.mood = mood;
    this.broadcastToRenderers({
      type: 'companion-state',
      mood,
      reason
    });
  }

  private emitTransientMood(mood: CompanionMood, reason: string) {
    this.emitState(mood, reason);
    this.clearTimer('mood');
    this.moodTimer = this.setTimer(() => {
      this.moodTimer = null;
      if (this.activePrompt) {
        this.emitState('checkin', 'prompt-active');
        return;
      }

      this.emitState(this.stateStore.getPrefs().proactiveEnabled ? 'idle' : 'sleepy', 'transient-reset');
    }, 2_800);
  }

  private now() {
    return this.clock.now ? this.clock.now() : new Date();
  }

  private random() {
    return this.clock.random ? this.clock.random() : Math.random();
  }

  private setTimer(callback: () => void, delayMs: number) {
    return this.clock.setTimeout ? this.clock.setTimeout(callback, delayMs) : setTimeout(callback, delayMs);
  }

  private clearTimer(kind: 'prompt' | 'dismiss' | 'mood') {
    const timer = kind === 'prompt' ? this.promptTimer : kind === 'dismiss' ? this.dismissTimer : this.moodTimer;
    if (!timer) {
      return;
    }

    if (kind === 'prompt') {
      this.promptTimer = null;
    } else if (kind === 'dismiss') {
      this.dismissTimer = null;
    } else {
      this.moodTimer = null;
    }

    if (this.clock.clearTimeout) {
      this.clock.clearTimeout(timer);
    } else {
      clearTimeout(timer);
    }
  }
}
