import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { PasswordStrengthIndicator } from '@/components/ui/password-strength-indicator';

describe('PasswordStrengthIndicator Component', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders nothing when password is empty', () => {
    const { container } = render(<PasswordStrengthIndicator password="" />);
    expect(container.firstChild).toBeNull();
  });

  it('displays strength bars', () => {
    render(<PasswordStrengthIndicator password="TestPass123!" />);
    const bars = screen.getByText(/Weak|Fair|Good|Strong/i);
    expect(bars).toBeInTheDocument();
  });

  it('shows strength level text', () => {
    render(<PasswordStrengthIndicator password="TestPass123!" />);
    expect(screen.getByText(/Weak|Fair|Good|Strong/i)).toBeInTheDocument();
  });

  it('renders password rules by default', () => {
    render(<PasswordStrengthIndicator password="TestPassword123!" />);
    expect(screen.getByText(/At least 8 characters/i)).toBeInTheDocument();
    expect(screen.getByText(/One uppercase letter/i)).toBeInTheDocument();
    expect(screen.getByText(/One number/i)).toBeInTheDocument();
  });

  it('hides rules when showRules is false', () => {
    const { container } = render(
      <PasswordStrengthIndicator password="TestPass123!" showRules={false} />,
    );
    const rules = container.querySelector('ul');
    expect(rules).not.toBeInTheDocument();
  });

  it('shows email warning when password contains email local part', () => {
    const { container } = render(
      <PasswordStrengthIndicator password="MyPasswordTest123!" email="test@example.com" />,
    );
    const emailWarnings = container.querySelectorAll('li');
    const hasEmailWarning = Array.from(emailWarnings).some((li) =>
      li.textContent?.includes('Must not contain your email'),
    );
    expect(hasEmailWarning).toBe(true);
  });

  it('hides email warning when password does not contain email', () => {
    const { container } = render(
      <PasswordStrengthIndicator password="SafePassword123!" email="test@example.com" />,
    );
    const emailWarnings = container.querySelectorAll('li');
    const hasEmailWarning = Array.from(emailWarnings).some((li) =>
      li.textContent?.includes('Must not contain your email'),
    );
    expect(hasEmailWarning).toBe(false);
  });

  it('shows warning for common passwords', () => {
    render(<PasswordStrengthIndicator password="password123!" />);
    expect(screen.getByText(/Not a common password/i)).toBeInTheDocument();
  });
});

