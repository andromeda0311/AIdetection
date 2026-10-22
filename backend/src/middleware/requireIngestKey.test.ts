import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import config from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { requireIngestKey } from './requireIngestKey.js';

function run(headerValue?: string): unknown {
  const req = { get: (name: string) => (name.toLowerCase() === 'x-ingest-key' ? headerValue : undefined) } as Request;
  const next = vi.fn();
  requireIngestKey(req, {} as Response, next);
  return next.mock.calls[0]?.[0];
}

describe('requireIngestKey', () => {
  const original = { key: config.yoloLive.ingestKey, env: config.nodeEnv };

  afterEach(() => {
    config.yoloLive.ingestKey = original.key;
    config.nodeEnv = original.env;
  });

  it('rejects ingest outside development when no key is configured', () => {
    config.yoloLive.ingestKey = '';
    config.nodeEnv = 'production';
    expect(run()).toBeInstanceOf(ApiError);
  });

  it('allows ingest in development when no key is configured', () => {
    config.yoloLive.ingestKey = '';
    config.nodeEnv = 'development';
    expect(run()).toBeUndefined();
  });

  it('accepts the configured key', () => {
    config.yoloLive.ingestKey = 'correct-key';
    config.nodeEnv = 'production';
    expect(run('correct-key')).toBeUndefined();
  });

  it('rejects a missing or wrong key', () => {
    config.yoloLive.ingestKey = 'correct-key';
    config.nodeEnv = 'production';
    expect(run()).toBeInstanceOf(ApiError);
    expect(run('wrong-key')).toBeInstanceOf(ApiError);
    expect(run('correct-key-but-longer')).toBeInstanceOf(ApiError);
  });
});
