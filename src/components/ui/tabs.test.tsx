import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tabs } from '@/components/ui/tabs';

describe('Tabs Component', () => {
  afterEach(() => {
    cleanup();
  });
  const defaultProps = {
    items: [
      { value: 'tab1', label: 'Tab 1' },
      { value: 'tab2', label: 'Tab 2' },
      { value: 'tab3', label: 'Tab 3' },
    ],
    value: 'tab1',
    onChange: vi.fn(),
  };

  it('renders all tab items', () => {
    render(<Tabs {...defaultProps} />);
    expect(screen.getByText('Tab 1')).toBeInTheDocument();
    expect(screen.getByText('Tab 2')).toBeInTheDocument();
    expect(screen.getByText('Tab 3')).toBeInTheDocument();
  });

  it('calls onChange when tab is clicked', async () => {
    const onChange = vi.fn();
    const { container } = render(<Tabs {...defaultProps} onChange={onChange} />);

    const buttons = container.querySelectorAll('button');
    const tab2 = buttons[1];
    await userEvent.click(tab2);

    expect(onChange).toHaveBeenCalledWith('tab2');
  });

  it('renders with icons', () => {
    const itemsWithIcons = [
      { value: 'tab1', label: 'Tab 1', icon: '📊' },
      { value: 'tab2', label: 'Tab 2', icon: '📈' },
    ];
    const { container } = render(<Tabs items={itemsWithIcons} value="tab1" onChange={vi.fn()} />);
    // Just verify the component renders and has buttons
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBe(2);
  });

  it('renders tab buttons', () => {
    const { container } = render(<Tabs {...defaultProps} />);
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBe(3);
  });

  it('handles single tab', () => {
    render(
      <Tabs
        items={[{ value: 'only', label: 'Only Tab' }]}
        value="only"
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Only Tab')).toBeInTheDocument();
  });

  it('highlights active tab with styling', () => {
    const { container } = render(<Tabs {...defaultProps} value="tab2" />);
    const buttons = container.querySelectorAll('button');
    const activeButton = buttons[1]; // Tab 2
    expect(activeButton?.className).toContain('accent');
  });
});
