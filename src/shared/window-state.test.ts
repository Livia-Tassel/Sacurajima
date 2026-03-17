import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeWindowState } from './window-state';

describe('window-state', () => {
  it('falls back to safe bounds when the candidate is out of range', () => {
    const fallback = {
      x: 20,
      y: 40,
      width: 320,
      height: 240,
      visible: true
    };
    const result = sanitizeWindowState(
      {
        x: -2000,
        y: 5000,
        width: 99999,
        height: 99999,
        visible: false
      },
      fallback,
      { x: 0, y: 0, width: 1440, height: 900 }
    );

    assert.deepEqual(result, {
      x: 0,
      y: 0,
      width: 1440,
      height: 900,
      visible: false
    });
  });

  it('preserves compact companion dimensions when a stored width is too small', () => {
    const result = sanitizeWindowState(
      {
        x: 60,
        y: 90,
        width: 40,
        height: 20,
        visible: true
      },
      {
        x: 60,
        y: 90,
        width: 180,
        height: 220,
        visible: true
      },
      { x: 0, y: 0, width: 1440, height: 900 }
    );

    assert.deepEqual(result, {
      x: 60,
      y: 90,
      width: 180,
      height: 220,
      visible: true
    });
  });
});
