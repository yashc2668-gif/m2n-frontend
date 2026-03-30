import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageHeader } from '@/components/ui/page-header';

// Mock useRouterState to avoid router dependency in tests
vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router');
  return {
    ...actual,
    useRouterState: vi.fn(({ select }) => {
      const state = { location: { pathname: '/test' } };
      return select ? select(state) : state;
    }),
  };
});

describe('PageHeader Component', () => {
  const defaultProps = {
    eyebrow: 'Section',
    title: 'Page Title',
    description: 'This is a page description',
    showBreadcrumbs: false,
    breadcrumbs: [], // Empty breadcrumbs to avoid auto-generation
  };

  it('renders title', () => {
    render(<PageHeader {...defaultProps} />);
    const heading = screen.getByText('Page Title');
    expect(heading).toBeInTheDocument();
  });

  it('renders description', () => {
    const { container } = render(<PageHeader {...defaultProps} />);
    // Get the main content area (not breadcrumbs)
    const descriptionText = container.querySelector(
      'p.text-\\[var\\(--surface-muted\\)\\]'
    );
    expect(descriptionText?.textContent).toContain('This is a page description');
  });

  it('renders eyebrow', () => {
    render(<PageHeader {...defaultProps} />);
    // Get all eyebrow elements and check that at least one exists
    const eyebrows = screen.getAllByText('Section');
    expect(eyebrows.length).toBeGreaterThan(0);
  });
});

