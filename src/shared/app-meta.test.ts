import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { APP_NAME, createWelcomeHeading } from './app-meta';

describe('app-meta', () => {
  it('formats the welcome heading with the application name', () => {
    assert.equal(createWelcomeHeading('0.1.0'), `${APP_NAME} v0.1.0`);
  });
});
