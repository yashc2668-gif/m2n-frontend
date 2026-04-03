import { beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';

import CompaniesPage from '@/features/companies/companies-page';
import { render, screen, waitFor } from '@/test/render';

const fetchCompaniesMock = vi.fn();
const fetchProjectsMock = vi.fn();
const fetchMaterialsMock = vi.fn();
const stageQuotationContextMock = vi.fn();
const navigateMock = vi.fn();

vi.mock('@/api/companies', () => ({
  fetchCompanies: (...args: unknown[]) => fetchCompaniesMock(...args),
}));

vi.mock('@/api/projects', () => ({
  fetchProjects: (...args: unknown[]) => fetchProjectsMock(...args),
}));

vi.mock('@/api/materials', () => ({
  fetchMaterials: (...args: unknown[]) => fetchMaterialsMock(...args),
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
      const state = { location: { pathname: '/companies' } };
      return select ? select(state) : state;
    }),
  };
});

describe('CompaniesPage', () => {
  beforeEach(() => {
    fetchCompaniesMock.mockResolvedValue([
      {
        id: 21,
        name: 'Marco Enterpricess',
        address: 'Naini, Prayagraj',
        gst_number: '09ABCDE1234F1Z5',
        pan_number: 'ABCDE1234F',
        phone: '8888888888',
        email: 'ops@marco.example',
        created_at: '2026-04-01T10:00:00Z',
      },
    ]);
    fetchProjectsMock.mockResolvedValue([]);
    fetchMaterialsMock.mockResolvedValue([]);
    stageQuotationContextMock.mockReset();
    navigateMock.mockReset();
  });

  it('opens company quotation intake from the focused company card', async () => {
    const user = userEvent.setup();
    render(<CompaniesPage />);

    const uploadButton = await screen.findByRole('button', { name: /upload quotation/i });
    await user.click(uploadButton);

    await waitFor(() =>
      expect(stageQuotationContextMock).toHaveBeenCalledWith({
        entityType: 'company',
        entityId: 21,
        openComposer: true,
      }),
    );
    expect(navigateMock).toHaveBeenCalledWith({ to: '/quotations' });
  });
});
