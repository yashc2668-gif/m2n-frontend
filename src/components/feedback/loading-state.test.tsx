import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LoadingState } from '@/components/feedback/loading-state';

describe('LoadingState Component', () => {
  it('renders with default content', () => {
    render(<LoadingState />);
    expect(screen.getByText('Syncing the control room')).toBeInTheDocument();
    expect(
      screen.getByText('Pulling the latest backend signals and workflow data.'),
    ).toBeInTheDocument();
  });

  it('renders with custom title', () => {
    render(<LoadingState title="Loading..." />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders with custom description', () => {
    render(<LoadingState description="Please wait..." />);
    expect(screen.getByText('Please wait...')).toBeInTheDocument();
  });

  it('renders with both custom title and description', () => {
    render(<LoadingState title="Custom Title" description="Custom Description" />);
    expect(screen.getByText('Custom Title')).toBeInTheDocument();
    expect(screen.getByText('Custom Description')).toBeInTheDocument();
  });

  it('renders spinner animation', () => {
    const { container } = render(<LoadingState />);
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('has proper spacing and layout', () => {
    const { container } = render(<LoadingState />);
    const content = container.querySelector('.space-y-3');
    expect(content).toBeInTheDocument();
  });
});
