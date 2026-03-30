import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorState } from '@/components/feedback/error-state';

describe('ErrorState Component', () => {
  const defaultDescription = 'Something went wrong';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders with default title and provided description', () => {
    render(<ErrorState description={defaultDescription} />);
    expect(screen.getByText('This panel needs attention')).toBeInTheDocument();
    expect(screen.getByText(defaultDescription)).toBeInTheDocument();
  });

  it('renders with custom title', () => {
    render(<ErrorState title="Custom Error" description={defaultDescription} />);
    expect(screen.getByText('Custom Error')).toBeInTheDocument();
  });

  it('renders alert icon', () => {
    const { container } = render(<ErrorState description={defaultDescription} />);
    const icon = container.querySelector('svg');
    expect(icon).toBeInTheDocument();
  });

  it('does not render retry button when onRetry is not provided', () => {
    render(<ErrorState description={defaultDescription} />);
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
  });

  it('renders retry button when onRetry is provided', () => {
    const handleRetry = vi.fn();
    render(<ErrorState description={defaultDescription} onRetry={handleRetry} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons.some((btn) => btn.textContent?.match(/retry/i))).toBe(true);
  });

  it('calls onRetry handler when retry button is clicked', async () => {
    const handleRetry = vi.fn();
    render(<ErrorState description={defaultDescription} onRetry={handleRetry} />);

    const retryButton = screen.getByRole('button', { name: /retry/i });
    await userEvent.click(retryButton);

    expect(handleRetry).toHaveBeenCalledOnce();
  });

  it('renders long description text', () => {
    const longDescription =
      'This is a very long description that describes ' +
      'what went wrong in the system and how to recover from it.';
    render(<ErrorState description={longDescription} />);
    expect(screen.getByText(longDescription)).toBeInTheDocument();
  });

  it('has proper layout and spacing', () => {
    const { container } = render(<ErrorState description={defaultDescription} />);
    const card = container.querySelector('.space-y-2');
    expect(card).toBeInTheDocument();
  });
});
