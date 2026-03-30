import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '@/components/ui/badge';

describe('Badge Component', () => {
  it('renders with default content', () => {
    render(<Badge>Badge Text</Badge>);
    expect(screen.getByText('Badge Text')).toBeInTheDocument();
  });

  it('applies neutral tone by default', () => {
    render(<Badge>Neutral</Badge>);
    const badge = screen.getByText('Neutral');
    expect(badge).toHaveClass('bg-white/70', 'text-[var(--surface-ink)]');
  });

  it('applies success tone', () => {
    render(<Badge tone="success">Success</Badge>);
    const badge = screen.getByText('Success');
    expect(badge).toHaveClass('bg-emerald-100', 'text-emerald-800');
  });

  it('applies warning tone', () => {
    render(<Badge tone="warning">Warning</Badge>);
    const badge = screen.getByText('Warning');
    expect(badge).toHaveClass('bg-amber-100', 'text-amber-800');
  });

  it('applies danger tone', () => {
    render(<Badge tone="danger">Danger</Badge>);
    const badge = screen.getByText('Danger');
    expect(badge).toHaveClass('bg-orange-100', 'text-orange-800');
  });

  it('applies info tone', () => {
    render(<Badge tone="info">Info</Badge>);
    const badge = screen.getByText('Info');
    expect(badge).toHaveClass('bg-sky-100', 'text-sky-800');
  });

  it('applies accent tone', () => {
    render(<Badge tone="accent">Accent</Badge>);
    const badge = screen.getByText('Accent');
    expect(badge).toHaveClass('bg-[var(--accent-soft)]');
  });

  it('accepts custom className', () => {
    render(<Badge className="custom-class">Custom</Badge>);
    const badge = screen.getByText('Custom');
    expect(badge).toHaveClass('custom-class');
  });

  it('renders as span element', () => {
    const { container } = render(<Badge>Badge</Badge>);
    const badge = container.querySelector('span');
    expect(badge).toBeInTheDocument();
  });
});
