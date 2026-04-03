import { beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';

import DocumentsPage from '@/features/documents/documents-page';
import { render, screen, waitFor } from '@/test/render';

const fetchDocumentsMock = vi.fn();
const fetchDocumentsPageMock = vi.fn();
const exportDocumentsMock = vi.fn();
const xhrUploadMock = vi.fn();
const resetUploadMock = vi.fn();

vi.mock('@/api/documents', () => ({
  fetchDocuments: (...args: unknown[]) => fetchDocumentsMock(...args),
  fetchDocumentsPage: (...args: unknown[]) => fetchDocumentsPageMock(...args),
  exportDocuments: (...args: unknown[]) => exportDocumentsMock(...args),
}));

vi.mock('@/components/feedback/upload-progress', () => ({
  UploadProgress: () => null,
  useUploadProgress: () => ({
    progress: null,
    fileName: null,
    isUploading: false,
    upload: xhrUploadMock,
    cancel: vi.fn(),
    reset: resetUploadMock,
  }),
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
      const state = { location: { pathname: '/documents' } };
      return select ? select(state) : state;
    }),
  };
});

describe('DocumentsPage', () => {
  beforeEach(() => {
    fetchDocumentsMock.mockResolvedValue([
      {
        id: 1,
        entity_type: 'contract',
        entity_id: 4,
        storage_key: 'doc-1',
        title: 'Contract Scan',
        document_type: 'scan',
        current_version_number: 1,
        latest_file_name: 'contract.pdf',
        latest_file_path: 'documents/contract/4/doc-1/v1/file.pdf',
        latest_mime_type: 'application/pdf',
        latest_file_size: 1024,
        remarks: null,
        created_by: 1,
        created_at: '2026-04-01T10:00:00Z',
        updated_at: '2026-04-01T10:00:00Z',
        versions: [],
      },
    ]);
    fetchDocumentsPageMock.mockResolvedValue({
      items: [
        {
          id: 1,
          entity_type: 'contract',
          entity_id: 4,
          storage_key: 'doc-1',
          title: 'Contract Scan',
          document_type: 'scan',
          current_version_number: 1,
          latest_file_name: 'contract.pdf',
          latest_file_path: 'documents/contract/4/doc-1/v1/file.pdf',
          latest_mime_type: 'application/pdf',
          latest_file_size: 1024,
          remarks: null,
          created_by: 1,
          created_at: '2026-04-01T10:00:00Z',
          updated_at: '2026-04-01T10:00:00Z',
          versions: [],
        },
      ],
      total: 1,
      page: 1,
      limit: 25,
    });
    exportDocumentsMock.mockResolvedValue(new Blob(['ok']));
    xhrUploadMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 2,
          entity_type: 'vendor',
          entity_id: 11,
          storage_key: 'doc-2',
          title: 'Marco quotation',
          document_type: 'quotation',
          current_version_number: 1,
          latest_file_name: 'marco-quotation.pdf',
          latest_file_path: 'documents/vendor/11/doc-2/v1/file.pdf',
          latest_mime_type: 'application/pdf',
          latest_file_size: 2048,
          remarks: 'April revision',
          created_by: 1,
          created_at: '2026-04-02T10:00:00Z',
          updated_at: '2026-04-02T10:00:00Z',
          versions: [],
        }),
        {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );
    resetUploadMock.mockReset();
  });

  it('shows vendor and company entity options and includes document type plus remarks on upload', async () => {
    const user = userEvent.setup();
    render(<DocumentsPage />);

    await screen.findByRole('button', { name: /upload document/i });

    await user.click(screen.getByRole('button', { name: /upload document/i }));

    const entitySelects = screen.getAllByLabelText('Entity type');
    expect(entitySelects[0]).toHaveTextContent('Vendor');
    expect(entitySelects[0]).toHaveTextContent('Company');
    expect(entitySelects[1]).toHaveTextContent('Vendor');
    expect(entitySelects[1]).toHaveTextContent('Company');

    await user.selectOptions(entitySelects[1], 'vendor');
    await user.type(screen.getByLabelText('Entity ID'), '11');
    await user.type(screen.getByLabelText('Title'), 'Marco quotation');
    await user.type(screen.getByLabelText('Document type'), 'quotation');
    await user.type(screen.getByLabelText('Remarks'), 'April revision');

    const fileInput = screen.getByLabelText('File');
    const file = new File(['quotation-pdf'], 'marco-quotation.pdf', {
      type: 'application/pdf',
    });
    await user.upload(fileInput, file);

    await user.click(screen.getByRole('button', { name: /^upload$/i }));

    await waitFor(() => expect(xhrUploadMock).toHaveBeenCalledTimes(1));
    const uploadedFormData = xhrUploadMock.mock.calls[0][1] as FormData;
    expect(uploadedFormData.get('entity_type')).toBe('vendor');
    expect(uploadedFormData.get('entity_id')).toBe('11');
    expect(uploadedFormData.get('title')).toBe('Marco quotation');
    expect(uploadedFormData.get('document_type')).toBe('quotation');
    expect(uploadedFormData.get('remarks')).toBe('April revision');
    expect(uploadedFormData.get('file')).toBeInstanceOf(File);
  }, 15000);
});
