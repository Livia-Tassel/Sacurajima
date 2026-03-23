import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  hasRecentInteraction,
  hasTemplateCooldownElapsed,
  isWithinQuietHours,
  resolveProactiveIntervalMs,
  sanitizeCompanionPrefs
} from './companion';

describe('companion shared rules', () => {
  it('treats cross-midnight windows as quiet hours', () => {
    assert.equal(
      isWithinQuietHours(new Date('2026-03-17T23:30:00'), {
        start: '23:00',
        end: '08:00'
      }),
      true
    );
    assert.equal(
      isWithinQuietHours(new Date('2026-03-17T07:45:00'), {
        start: '23:00',
        end: '08:00'
      }),
      true
    );
    assert.equal(
      isWithinQuietHours(new Date('2026-03-17T12:00:00'), {
        start: '23:00',
        end: '08:00'
      }),
      false
    );
  });

  it('calculates proactive interval with jitter by level', () => {
    assert.equal(resolveProactiveIntervalMs('active', 0), 22 * 60_000);
    assert.equal(resolveProactiveIntervalMs('active', 1), 38 * 60_000);
    assert.equal(resolveProactiveIntervalMs('balanced', 0.5), 45 * 60_000);
    assert.equal(resolveProactiveIntervalMs('low', 0.5), 60 * 60_000);
  });

  it('enforces template cooldown windows', () => {
    assert.equal(hasTemplateCooldownElapsed(undefined, new Date('2026-03-17T10:00:00Z'), 24), true);
    assert.equal(
      hasTemplateCooldownElapsed('2026-03-16T11:00:00Z', new Date('2026-03-17T10:00:00Z'), 24),
      false
    );
    assert.equal(
      hasTemplateCooldownElapsed('2026-03-16T09:59:00Z', new Date('2026-03-17T10:00:00Z'), 24),
      true
    );
  });

  it('detects recent interaction boundaries', () => {
    assert.equal(
      hasRecentInteraction('2026-03-17T09:50:01Z', new Date('2026-03-17T10:00:00Z'), 12),
      true
    );
    assert.equal(
      hasRecentInteraction('2026-03-17T09:47:59Z', new Date('2026-03-17T10:00:00Z'), 12),
      false
    );
    assert.equal(hasRecentInteraction('', new Date('2026-03-17T10:00:00Z'), 12), false);
  });

  it('sanitizes invalid companion preferences', () => {
    const sanitized = sanitizeCompanionPrefs({
      proactiveEnabled: true,
      proactiveLevel: 'active',
      quietHours: {
        start: '99:00',
        end: '25:00'
      }
    });

    assert.deepEqual(sanitized, {
      proactiveEnabled: true,
      proactiveLevel: 'active',
      quietHours: {
        start: '23:00',
        end: '08:00'
      }
    });
  });
});
