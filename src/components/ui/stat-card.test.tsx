import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BarChart3, TrendingUp } from 'lucide-react';
import { StatCard } from '@/components/ui/stat-card';

describe('StatCard Component', () => {
  const defaultProps = {
    label: 'Total Projects',
    value: '24',
    caption: 'Active this month',
    icon: BarChart3,
  };

  it('renders all text content', () => {
    render(<StatCard {...defaultProps} />);
    expect(screen.getByText('Total Projects')).toBeInTheDocument();
    expect(screen.getByText('24')).toBeInTheDocument();
    expect(screen.getByText('Active this month')).toBeInTheDocument();
  });

  it('renders the icon', () => {
    const { container } = render(<StatCard {...defaultProps} />);
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(0);
  });

  it('applies accent tone by default', () => {
    const { container } = render(<StatCard {...defaultProps} />);
    // Check for the accent tone styling
    const accentElements = container.querySelectorAll('[class*="accent"]');
    expect(accentElements.length).toBeGreaterThan(0);
  });

  it('applies success tone when specified', () => {
    const { container } = render(<StatCard {...defaultProps} tone="success" />);
    const toneSpan = container.querySelector('.bg-emerald-100');
    expect(toneSpan).toBeInTheDocument();
  });

  it('applies info tone when specified', () => {
    const { container } = render(<StatCard {...defaultProps} tone="info" />);
    const toneSpan = container.querySelector('.bg-sky-100');
    expect(toneSpan).toBeInTheDocument();
  });

  it('renders right slot when provided', () => {
    render(
      <StatCard {...defaultProps} rightSlot={<div data-testid="right-slot">Extra</div>} />,
    );
    expect(screen.getByTestId('right-slot')).toBeInTheDocument();
  });

  it('does not render right slot when not provided', () => {
    const { container } = render(<StatCard {...defaultProps} />);
    // The rightSlot div should not exist
    expect(container.querySelector('[data-testid="right-slot"]')).not.toBeInTheDocument();
  });

  it('renders different icons', () => {
    const { rerender, container: container1 } = render(
      <StatCard {...defaultProps} icon={BarChart3} />,
    );

    rerender(<StatCard {...defaultProps} icon={TrendingUp} />);
    expect(container1.querySelectorAll('svg').length).toBeGreaterThan(0);
  });

  it('renders large number value', () => {
    render(<StatCard {...defaultProps} value="1,234,567" />);
    expect(screen.getByText('1,234,567')).toBeInTheDocument();
  });
});
