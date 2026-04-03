import { beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';

import VendorsPage from '@/features/vendors/vendors-page';
import { render, screen, waitFor } from '@/test/render';

const fetchVendorsMock = vi.fn();
const fetchContractsMock = vi.fn();
const stageQuotationContextMock = vi.fn();
const navigateMock = vi.fn();

vi.mock('@/api/vendors', () => ({
  fetchVendors: (...args: unknown[]) => fetchVendorsMock(...args),
  createVendor: vi.fn(),
  updateVendor: vi.fn(),
}));

vi.mock('@/api/contracts', () => ({
  fetchContracts: (...args: unknown[]) => fetchContractsMock(...args),
}));

vi.mock('@/features/quotations/quotation-intake', () => ({
  stageQuotationContext: (...args: unknown[]) => stageQuotationContextMock(...args),
}));

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router');
  return {
    ...actual,
    Link: ({ children, to, ...props }: { children: React.ReactNode; to: string }) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
    useNavigate: () => navigateMock,
    useRouterState: vi.fn(({ select }) => {
      const state = { location: { pathname: '/vendors' } };
      return select ? select(state) : state;
    }),
  };
});

describe('VendorsPage', () => {
  beforeEach(() => {
    fetchVendorsMock.mockResolvedValue([
      {
        id: 11,
        company_id: 21,
        name: 'Marco Group Supplies',
        code: 'VEN-011',
        vendor_type: 'supplier',
        contact_person: 'Rahul',
        phone: '9999999999',
        email: 'rahul@marco.example',
        gst_number: '09ABCDE1234F1Z5',
        pan_number: 'ABCDE1234F',
        address: 'Naini, Prayagraj',
        lock_version: 1,
        created_at: '2026-04-01T10:00:00Z',
        updated_at: '2026-04-01T10:00:00Z',
      },
    ]);
    fetchContractsMock.mockResolvedValue([]);
    stageQuotationContextMock.mockReset();
    navigateMock.mockReset();
  });

  it('opens vendor quotation intake from the vendors register', async () => {
    const user = userEvent.setup();
    render(<VendorsPage />);

    const uploadButton = await screen.findByRole('button', { name: /upload quote/i });
    await user.click(uploadButton);

    await waitFor(() =>
      expect(stageQuotationContextMock).toHaveBeenCalledWith({
        entityType: 'vendor',
        entityId: 11,
        openComposer: true,
      }),
    );
    expect(navigateMock).toHaveBeenCalledWith({ to: '/quotations' });
  });
});
