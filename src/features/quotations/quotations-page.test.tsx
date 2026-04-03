import { beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';

import QuotationsPage from '@/features/quotations/quotations-page';
import { stageQuotationContext } from '@/features/quotations/quotation-intake';
import { render, screen, waitFor } from '@/test/render';

const fetchDocumentsMock = vi.fn();
const uploadDocumentMock = vi.fn();
const downloadDocumentMock = vi.fn();
const fetchVendorsMock = vi.fn();
const fetchCompaniesMock = vi.fn();

vi.mock('@/api/documents', () => ({
  fetchDocuments: (...args: unknown[]) => fetchDocumentsMock(...args),
  uploadDocument: (...args: unknown[]) => uploadDocumentMock(...args),
  downloadDocument: (...args: unknown[]) => downloadDocumentMock(...args),
}));

vi.mock('@/api/vendors', () => ({
  fetchVendors: (...args: unknown[]) => fetchVendorsMock(...args),
}));

vi.mock('@/api/companies', () => ({
  fetchCompanies: (...args: unknown[]) => fetchCompaniesMock(...args),
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
    useRouterState: vi.fn(({ select }) => {
      const state = { location: { pathname: '/quotations' } };
      return select ? select(state) : state;
    }),
  };
});

describe('QuotationsPage', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    fetchDocumentsMock.mockResolvedValue([
      {
        id: 1,
        entity_type: 'vendor',
        entity_id: 11,
        storage_key: 'quote-vendor',
        title: 'Marco Vendor Quote',
        document_type: 'quotation',
        current_version_number: 2,
        latest_file_name: 'marco-vendor-quote.pdf',
        latest_file_path: 'documents/vendor/11/quote-vendor/v2/file.pdf',
        latest_mime_type: 'application/pdf',
        latest_file_size: 3000,
        remarks: 'Vendor revision A',
        created_by: 1,
        created_at: '2026-04-01T10:00:00Z',
        updated_at: '2026-04-02T10:00:00Z',
        versions: [
          {
            id: 1,
            document_id: 1,
            version_number: 1,
            file_name: 'marco-vendor-quote-v1.pdf',
            file_path: 'documents/vendor/11/quote-vendor/v1/file.pdf',
            mime_type: 'application/pdf',
            file_size: 2000,
            remarks: 'Initial',
            uploaded_by: 1,
            created_at: '2026-04-01T10:00:00Z',
            updated_at: '2026-04-01T10:00:00Z',
          },
        ],
      },
      {
        id: 2,
        entity_type: 'company',
        entity_id: 21,
        storage_key: 'quote-company',
        title: 'Marco Company Quote',
        document_type: 'quotation',
        current_version_number: 1,
        latest_file_name: 'marco-company-quote.pdf',
        latest_file_path: 'documents/company/21/quote-company/v1/file.pdf',
        latest_mime_type: 'application/pdf',
        latest_file_size: 2800,
        remarks: 'Internal price note',
        created_by: 1,
        created_at: '2026-04-01T10:00:00Z',
        updated_at: '2026-04-02T10:00:00Z',
        versions: [],
      },
    ]);
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
    uploadDocumentMock.mockResolvedValue({
      id: 3,
      entity_type: 'vendor',
      entity_id: 11,
      storage_key: 'quote-upload',
      title: '01 April Quotation - Marco Group - Naini Prayagraj',
      document_type: 'quotation',
      current_version_number: 1,
      latest_file_name: 'marco-upload.pdf',
      latest_file_path: 'documents/vendor/11/quote-upload/v1/file.pdf',
      latest_mime_type: 'application/pdf',
      latest_file_size: 4096,
      remarks: 'Uploaded from test',
      created_by: 1,
      created_at: '2026-04-02T10:00:00Z',
      updated_at: '2026-04-02T10:00:00Z',
      versions: [],
    });
    downloadDocumentMock.mockResolvedValue(new Blob(['pdf']));
  });

  it('requests quotation documents and renders vendor/company labels instead of raw ids', async () => {
    const user = userEvent.setup();
    render(<QuotationsPage />);

    await screen.findByText('Marco Vendor Quote');

    expect(fetchDocumentsMock).toHaveBeenCalledWith('test-token', {
      document_type: 'quotation',
    });
    expect(screen.getAllByText('Marco Group Supplies').length).toBeGreaterThan(0);
    expect(screen.queryByText('Vendor #11')).not.toBeInTheDocument();
    expect(screen.queryByText('Company #21')).not.toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox', { name: /entity scope/i }), 'all');
    expect(screen.getAllByText('Marco Enterpricess').length).toBeGreaterThan(0);
  });

  it('prefills vendor intake context and always uploads with document_type quotation', async () => {
    stageQuotationContext({
      entityType: 'vendor',
      entityId: 11,
      openComposer: true,
    });

    const user = userEvent.setup();
    render(<QuotationsPage />);

    const vendorSelect = await screen.findByRole('combobox', { name: 'Vendor' });
    expect(vendorSelect).toHaveValue('11');

    await user.type(
      screen.getByLabelText('Title'),
      '01 April Quotation - Marco Group - Naini Prayagraj',
    );
    await user.type(screen.getByLabelText('Remarks'), 'Uploaded from test');
    await user.upload(
      screen.getByLabelText('File'),
      new File(['quotation-pdf'], 'marco-upload.pdf', { type: 'application/pdf' }),
    );

    const uploadButtons = screen.getAllByRole('button', { name: /upload quotation/i });
    await user.click(uploadButtons[uploadButtons.length - 1]);

    await waitFor(() => expect(uploadDocumentMock).toHaveBeenCalledTimes(1));
    const payload = uploadDocumentMock.mock.calls[0][1] as FormData;
    expect(payload.get('entity_type')).toBe('vendor');
    expect(payload.get('entity_id')).toBe('11');
    expect(payload.get('document_type')).toBe('quotation');
    expect(payload.get('remarks')).toBe('Uploaded from test');
  }, 15000);
});
