import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBaseUrl } from './config';

describe('config', () => {
  it('adds https and /v1 for newapi root hosts', () => {
    assert.equal(
      normalizeBaseUrl({
        providerPreset: 'newapi',
        siteUrl: 'newapi.example.com',
        baseUrl: ''
      }),
      'https://newapi.example.com/v1'
    );
  });

  it('preserves explicit compatible paths for custom providers', () => {
    assert.equal(
      normalizeBaseUrl({
        providerPreset: 'custom',
        siteUrl: '',
        baseUrl: 'https://gateway.example.com/openai/v1'
      }),
      'https://gateway.example.com/openai/v1'
    );
  });
});

