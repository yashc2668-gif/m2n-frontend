import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card } from '@/components/ui/card';

describe('Card Component', () => {
  it('renders children', () => {
    render(<Card>Card Content</Card>);
    expect(screen.getByText('Card Content')).toBeInTheDocument();
  });

  it('applies default styling classes', () => {
    const { container } = render(<Card>Test</Card>);
    const card = container.firstChild as HTMLElement;
    expect(card).toHaveClass('rounded-[calc(var(--radius)+4px)]');
    expect(card).toHaveClass('border');
    expect(card.className).toContain('bg-[var(--surface)]');
  });

  it('accepts custom className', () => {
    const { container } = render(<Card className="custom-class">Test</Card>);
    const card = container.firstChild as HTMLElement;
    expect(card).toHaveClass('custom-class');
  });

  it('renders as a div element', () => {
    const { container } = render(<Card>Test</Card>);
    const div = container.querySelector('div');
    expect(div).toBeInTheDocument();
  });

  it('forwards HTML attributes', () => {
    const { container } = render(
      <Card data-testid="test-card" aria-label="Test Card">
        Test
      </Card>,
    );
    const card = container.querySelector('[data-testid="test-card"]');
    expect(card).toHaveAttribute('aria-label', 'Test Card');
  });

  it('renders nested elements', () => {
    render(
      <Card>
        <h2>Title</h2>
        <p>Content</p>
      </Card>,
    );
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
  });
});
