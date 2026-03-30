import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from '@/components/feedback/empty-state';

describe('EmptyState Component', () => {
  it('renders title and description', () => {
    render(
      <EmptyState
        title="No data available"
        description="There are no items to display yet."
      />,
    );

    expect(screen.getByText('No data available')).toBeInTheDocument();
    expect(screen.getByText('There are no items to display yet.')).toBeInTheDocument();
  });

  it('renders decorative SVG illustration', () => {
    const { container } = render(
      <EmptyState
        title="No records"
        description="Start by creating your first record."
      />,
    );

    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('renders with different titles', () => {
    const { rerender } = render(
      <EmptyState title="No projects" description="Create a project to get started." />,
    );

    expect(screen.getByText('No projects')).toBeInTheDocument();

    rerender(
      <EmptyState title="No users" description="Add users to your organization." />,
    );

    expect(screen.getByText('No users')).toBeInTheDocument();
  });

  it('renders with long description text', () => {
    const longDescription =
      'There are no records available in this section. ' +
      'Start by creating your first record using the create button above.';

    render(
      <EmptyState title="Empty Section" description={longDescription} />,
    );

    expect(screen.getByText(longDescription)).toBeInTheDocument();
  });

  it('renders with proper text hierarchy', () => {
    const { container } = render(
      <EmptyState
        title="No items"
        description="Start by creating something."
      />,
    );

    const heading = container.querySelector('h3');
    const paragraph = container.querySelector('p');

    expect(heading).toHaveTextContent('No items');
    expect(paragraph).toHaveTextContent('Start by creating something.');
  });

  it('has proper spacing and layout classes', () => {
    const { container } = render(
      <EmptyState
        title="Empty"
        description="Description"
      />,
    );

    const card = container.querySelector('.p-8');
    expect(card).toBeInTheDocument();

    const spaceContainer = container.querySelector('.space-y-4');
    expect(spaceContainer).toBeInTheDocument();
  });
});
