// @ts-nocheck
import { describe, it, expect } from 'bun:test';

// This import will fail until apps/backend/src/calendar/errors.ts is created.
import { classifyGoogleError } from '../errors';

// ---------------------------------------------------------------------------
// classifyGoogleError — pure function, no mocks needed
// ---------------------------------------------------------------------------

describe('classifyGoogleError', () => {
  it('should classify unauthorized_client as auth_invalid (non-recoverable)', () => {
    const err = new Error('unauthorized_client');
    const result = classifyGoogleError(err);

    expect(result.code).toBe('auth_invalid');
    expect(result.recoverable).toBe(false);
    expect(result.message).toMatch(/credenciales/i);
  });

  it('should classify invalid_grant as auth_invalid (non-recoverable)', () => {
    const err = new Error('invalid_grant');
    const result = classifyGoogleError(err);

    expect(result.code).toBe('auth_invalid');
    expect(result.recoverable).toBe(false);
  });

  it('should classify HTTP 403 error as forbidden (non-recoverable)', () => {
    const err = Object.assign(new Error('Forbidden'), { code: 403 });
    const result = classifyGoogleError(err);

    expect(result.code).toBe('forbidden');
    expect(result.recoverable).toBe(false);
  });

  it('should classify HTTP 404 error as not_found (non-recoverable)', () => {
    const err = Object.assign(new Error('Not Found'), { code: 404 });
    const result = classifyGoogleError(err);

    expect(result.code).toBe('not_found');
    expect(result.recoverable).toBe(false);
  });

  it('should classify ECONNREFUSED as network error (recoverable)', () => {
    const err = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:443'), {
      code: 'ECONNREFUSED',
    });
    const result = classifyGoogleError(err);

    expect(result.code).toBe('network');
    expect(result.recoverable).toBe(true);
  });

  it('should classify ETIMEDOUT as network error (recoverable)', () => {
    const err = Object.assign(new Error('connection timed out'), {
      code: 'ETIMEDOUT',
    });
    const result = classifyGoogleError(err);

    expect(result.code).toBe('network');
    expect(result.recoverable).toBe(true);
  });

  it('should classify generic unknown errors as unknown (recoverable)', () => {
    const err = new Error('something unexpected');
    const result = classifyGoogleError(err);

    expect(result.code).toBe('unknown');
    expect(result.recoverable).toBe(true);
  });
});
