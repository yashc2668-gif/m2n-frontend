import { useMemo } from 'react';
import { CheckCircle2, Circle } from 'lucide-react';

import {
  getPasswordStrength,
  PASSWORD_RULES,
  passwordContainsEmail,
  validatePassword,
} from '@/lib/password-validation';

interface PasswordStrengthIndicatorProps {
  password: string;
  email?: string;
  showRules?: boolean;
}

export function PasswordStrengthIndicator({
  password,
  email,
  showRules = true,
}: PasswordStrengthIndicatorProps) {
  const strength = useMemo(() => getPasswordStrength(password), [password]);
  const { passed } = useMemo(() => validatePassword(password), [password]);
  const containsEmail = useMemo(
    () => passwordContainsEmail(password, email ?? ''),
    [password, email],
  );

  if (!password) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-1.5 flex-1 rounded-full transition-colors"
              style={{
                backgroundColor: i < strength.score ? strength.color : 'var(--line, #e5e7eb)',
              }}
            />
          ))}
        </div>
        {strength.label ? (
          <span className="text-xs font-medium" style={{ color: strength.color }}>
            {strength.label}
          </span>
        ) : null}
      </div>

      {showRules ? (
        <ul className="space-y-1">
          {PASSWORD_RULES.map((rule) => {
            const ok = passed.includes(rule.id);
            return (
              <li key={rule.id} className="flex items-center gap-1.5 text-xs">
                {ok ? (
                  <CheckCircle2 className="size-3.5 shrink-0 text-[var(--success,#16a34a)]" />
                ) : (
                  <Circle className="size-3.5 shrink-0 text-[var(--surface-muted,#6b7280)]" />
                )}
                <span className={ok ? 'text-[var(--success,#16a34a)]' : 'text-[var(--surface-muted,#6b7280)]'}>
                  {rule.label}
                </span>
              </li>
            );
          })}
          {containsEmail ? (
            <li className="flex items-center gap-1.5 text-xs text-[var(--danger)]">
              <Circle className="size-3.5 shrink-0" />
              Must not contain your email
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
