import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { deriveSessionTitle } from './chat';

describe('chat', () => {
  it('derives concise session titles from user messages', () => {
    assert.equal(deriveSessionTitle('Hello Sakurajima'), 'Hello Sakurajima');
    assert.equal(
      deriveSessionTitle('This is a much longer title candidate that should be clipped for the sidebar'),
      'This is a much longer title cand...'
    );
  });
});
