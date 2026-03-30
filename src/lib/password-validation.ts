/**
 * Client-side password policy validation.
 * Mirrors backend rules from app/core/security.py.
 */

export interface PasswordRule {
  id: string;
  label: string;
  test: (password: string) => boolean;
}

export interface PasswordStrength {
  score: number; // 0-4
  label: string;
  color: string;
}

const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', '12345678', '123456789',
  '1234567890', 'qwerty123', 'letmein1', 'welcome1', 'admin123',
  'abc12345', 'monkey123', 'master123', 'dragon123', 'login123',
  'princess1', 'football1', 'shadow123', 'sunshine1', 'trustno1',
  'iloveyou1', 'batman123', 'access123', 'hello123', 'charlie1',
  'donald123', 'password1!', 'qwerty1!', 'changeme', 'changeme1',
  'p@ssw0rd', 'p@ssword1', 'passw0rd', 'passw0rd!', 'welcome1!',
]);

export const PASSWORD_RULES: PasswordRule[] = [
  { id: 'length', label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { id: 'uppercase', label: 'One uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { id: 'number', label: 'One number', test: (p) => /\d/.test(p) },
  { id: 'special', label: 'One special character', test: (p) => /[^A-Za-z0-9]/.test(p) },
  { id: 'common', label: 'Not a common password', test: (p) => !COMMON_PASSWORDS.has(p.toLowerCase()) },
];

export function validatePassword(password: string): { passed: string[]; failed: string[] } {
  const passed: string[] = [];
  const failed: string[] = [];
  for (const rule of PASSWORD_RULES) {
    if (rule.test(password)) {
      passed.push(rule.id);
    } else {
      failed.push(rule.id);
    }
  }
  return { passed, failed };
}

export function isPasswordValid(password: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(password));
}

export function getPasswordStrength(password: string): PasswordStrength {
  if (!password) {
    return { score: 0, label: '', color: '' };
  }

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score++;

  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    score = Math.min(score, 1);
  }

  const levels: PasswordStrength[] = [
    { score: 0, label: 'Very weak', color: 'var(--danger)' },
    { score: 1, label: 'Weak', color: 'var(--danger)' },
    { score: 2, label: 'Fair', color: 'var(--warning, #d97706)' },
    { score: 3, label: 'Good', color: 'var(--info, #2563eb)' },
    { score: 4, label: 'Strong', color: 'var(--success, #16a34a)' },
  ];

  return levels[score];
}

export function passwordContainsEmail(password: string, email: string): boolean {
  if (!email || !password) return false;
  const localPart = email.split('@')[0].toLowerCase();
  return localPart.length >= 4 && password.toLowerCase().includes(localPart);
}
