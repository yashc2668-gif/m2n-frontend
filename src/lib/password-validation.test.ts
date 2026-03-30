import { describe, expect, it } from 'vitest';

import {
  getPasswordStrength,
  isPasswordValid,
  PASSWORD_RULES,
  passwordContainsEmail,
  validatePassword,
} from '@/lib/password-validation';

describe('validatePassword', () => {
  it('returns all failures for empty string', () => {
    const { passed, failed } = validatePassword('');
    expect(passed).toContain('common');
    expect(failed).toContain('length');
    expect(failed).toContain('uppercase');
    expect(failed).toContain('number');
    expect(failed).toContain('special');
  });

  it('passes all rules for a strong password', () => {
    const { passed, failed } = validatePassword('X7!kqm#Rz2Lp');
    expect(failed).toEqual([]);
    expect(passed).toHaveLength(PASSWORD_RULES.length);
  });

  it('detects missing uppercase', () => {
    const { failed } = validatePassword('test1234!');
    expect(failed).toContain('uppercase');
  });

  it('detects missing number', () => {
    const { failed } = validatePassword('TestPass!');
    expect(failed).toContain('number');
  });

  it('detects missing special character', () => {
    const { failed } = validatePassword('TestPass1');
    expect(failed).toContain('special');
  });

  it('detects common password', () => {
    const { failed } = validatePassword('Passw0rd!');
    expect(failed).toContain('common');
  });

  it('recognises p@ssw0rd as common', () => {
    const { failed } = validatePassword('p@ssw0rd');
    expect(failed).toContain('common');
  });
});

describe('isPasswordValid', () => {
  it('returns false for weak password', () => {
    expect(isPasswordValid('abc')).toBe(false);
  });

  it('returns false for common password', () => {
    expect(isPasswordValid('Passw0rd!')).toBe(false);
  });

  it('returns true for strong unique password', () => {
    expect(isPasswordValid('X7!kqm#Rz2Lp')).toBe(true);
  });
});

describe('getPasswordStrength', () => {
  it('returns empty for no input', () => {
    const strength = getPasswordStrength('');
    expect(strength.score).toBe(0);
    expect(strength.label).toBe('');
  });

  it('returns weak for short password', () => {
    const strength = getPasswordStrength('abc');
    expect(strength.score).toBeLessThanOrEqual(1);
  });

  it('returns strong for long mixed password', () => {
    const strength = getPasswordStrength('X7!kqm#Rz2LpWv');
    expect(strength.score).toBe(4);
    expect(strength.label).toBe('Strong');
  });

  it('caps score for common password', () => {
    const strength = getPasswordStrength('Passw0rd!');
    expect(strength.score).toBeLessThanOrEqual(1);
  });
});

describe('passwordContainsEmail', () => {
  it('detects email local part in password', () => {
    expect(passwordContainsEmail('MyJohndoePass1!', 'johndoe@example.com')).toBe(true);
  });

  it('ignores short email local parts (< 4 chars)', () => {
    expect(passwordContainsEmail('abc123Pass!', 'abc@example.com')).toBe(false);
  });

  it('returns false when no overlap', () => {
    expect(passwordContainsEmail('X7!kqm#Rz2Lp', 'someone@example.com')).toBe(false);
  });

  it('returns false for empty inputs', () => {
    expect(passwordContainsEmail('', 'test@example.com')).toBe(false);
    expect(passwordContainsEmail('SomePass1!', '')).toBe(false);
  });
});
