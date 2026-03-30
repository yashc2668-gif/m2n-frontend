import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test/render';
import { PermissionGate } from '@/components/shell/permission-gate';

describe('PermissionGate Component', () => {
  it('renders children for authorized users', () => {
    render(
      <PermissionGate>
        <div>Authorized Content</div>
      </PermissionGate>,
    );
    expect(screen.getByText('Authorized Content')).toBeInTheDocument();
  });

  it('component renders without errors', () => {
    const { container } = render(
      <PermissionGate>
        <div>Test Content</div>
      </PermissionGate>,
    );
    expect(container.firstChild).toBeInTheDocument();
  });
});

