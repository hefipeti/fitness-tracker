import { describe, expect, it } from 'vitest';
import {
  clearFailures,
  hashPassword,
  isThrottled,
  recordFailure,
  validatePassword,
  validateUsername,
  verifyPassword,
} from '@/lib/auth-core';

describe('password hashing', () => {
  it('verifies the right password and rejects the wrong one', async () => {
    const hash = await hashPassword('correct horse battery');
    expect(hash.startsWith('scrypt$')).toBe(true);
    expect(await verifyPassword('correct horse battery', hash)).toBe(true);
    expect(await verifyPassword('correct horse batterz', hash)).toBe(false);
    expect(await verifyPassword('', hash)).toBe(false);
  });
  it('salts every hash', async () => {
    expect(await hashPassword('same-password')).not.toBe(await hashPassword('same-password'));
  });
  it('rejects malformed stored hashes instead of throwing', async () => {
    expect(await verifyPassword('x', 'plaintext')).toBe(false);
    expect(await verifyPassword('x', 'scrypt$1$2$3$4')).toBe(false);
    expect(await verifyPassword('x', 'scrypt$16384$8$1$AAAA$AAAA')).toBe(false);
  });
});

describe('credential rules', () => {
  it('enforces password length', () => {
    expect(validatePassword('short')).not.toBeNull();
    expect(validatePassword('longenough')).toBeNull();
    expect(validatePassword('x'.repeat(201))).not.toBeNull();
  });
  it('restricts usernames to a safe charset', () => {
    expect(validateUsername('peti')).toBeNull();
    expect(validateUsername('anna.k-2_x')).toBeNull();
    expect(validateUsername('ab')).not.toBeNull();
    expect(validateUsername('has space')).not.toBeNull();
    expect(validateUsername("o'brien")).not.toBeNull();
    expect(validateUsername('a'.repeat(33))).not.toBeNull();
  });
});

describe('login throttling', () => {
  it('locks after repeated failures and expires with the window', () => {
    const key = `t-${Math.random()}`;
    const t0 = 1_000_000;
    for (let i = 0; i < 7; i++) recordFailure(key, t0);
    expect(isThrottled(key, t0)).toBe(false);
    recordFailure(key, t0);
    expect(isThrottled(key, t0 + 1000)).toBe(true);
    expect(isThrottled(key, t0 + 11 * 60_000)).toBe(false);
  });
  it('clears on success', () => {
    const key = `t-${Math.random()}`;
    for (let i = 0; i < 8; i++) recordFailure(key);
    expect(isThrottled(key)).toBe(true);
    clearFailures(key);
    expect(isThrottled(key)).toBe(false);
  });
});
