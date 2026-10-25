import { describe, expect, it } from 'vitest';
import { createTokenValue, hashToken } from '@/lib/share-tokens';

describe('createTokenValue', () => {
  it('returns a non-empty URL-safe string', () => {
    const token = createTokenValue();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token.length).toBeGreaterThanOrEqual(32);
  });

  it('returns a unique value on each call', () => {
    const a = createTokenValue();
    const b = createTokenValue();
    expect(a).not.toBe(b);
  });
});

describe('hashToken', () => {
  it('returns a deterministic hex string for the same input', () => {
    const hash1 = hashToken('abc123');
    const hash2 = hashToken('abc123');
    expect(hash1).toBe(hash2);
  });

  it('returns different hashes for different inputs', () => {
    expect(hashToken('abc')).not.toBe(hashToken('xyz'));
  });

  it('returns a hex string', () => {
    expect(hashToken('test')).toMatch(/^[0-9a-f]+$/);
  });
});
