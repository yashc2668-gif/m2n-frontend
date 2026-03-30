import type { User } from '@/api/types';

export interface UserFactoryOptions {
  id?: number;
  company_id?: number | null;
  full_name?: string;
  email?: string;
  phone?: string | null;
  role?: string;
  is_active?: boolean;
  created_at?: string;
}

export const createUser = (overrides?: UserFactoryOptions): User => ({
  id: overrides?.id ?? 1,
  company_id: overrides?.company_id ?? 1,
  full_name: overrides?.full_name ?? 'Test User',
  email: overrides?.email ?? 'test@example.com',
  phone: overrides?.phone ?? null,
  role: overrides?.role ?? 'admin',
  is_active: overrides?.is_active ?? true,
  created_at: overrides?.created_at ?? '2024-01-01T00:00:00Z',
});

export const createViewerUser = (overrides?: UserFactoryOptions): User =>
  createUser({ role: 'viewer', ...overrides });

export const createProjectManagerUser = (overrides?: UserFactoryOptions): User =>
  createUser({ role: 'project_manager', ...overrides });

export const createAccountantUser = (overrides?: UserFactoryOptions): User =>
  createUser({ role: 'accountant', ...overrides });

export const createContractorUser = (overrides?: UserFactoryOptions): User =>
  createUser({ role: 'contractor', ...overrides });

export const createEngineerUser = (overrides?: UserFactoryOptions): User =>
  createUser({ role: 'engineer', ...overrides });
