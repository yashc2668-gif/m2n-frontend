import type { ReactElement } from 'react';
import { render as rtlRender, type RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import type { AuthContextValue } from '@/app/providers/auth-provider';
import { AuthContext } from '@/app/providers/auth-provider';
import type { User } from '@/api/types';

interface TestProviderProps {
  children: React.ReactNode;
  authContext?: AuthContextValue;
  queryClient?: QueryClient;
}

const createDefaultUser = (): User => ({
  id: 1,
  company_id: 1,
  full_name: 'Test User',
  email: 'test@example.com',
  phone: null,
  role: 'admin',
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
});

const TestProvider = ({ children, authContext, queryClient }: TestProviderProps) => {
  const qc = queryClient || new QueryClient({ defaultOptions: { queries: { retry: false } } });

  const defaultAuthContext: AuthContextValue = authContext || {
    accessToken: 'test-token',
    hasSession: true,
    isAuthenticated: true,
    isBootstrapping: false,
    user: createDefaultUser(),
    login: async () => {
      throw new Error('Not implemented in tests');
    },
    logout: async () => {
      // Mock logout
    },
  };

  return (
    <AuthContext.Provider value={defaultAuthContext}>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </AuthContext.Provider>
  );
};

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  authContext?: AuthContextValue;
  queryClient?: QueryClient;
}

export function renderWithProviders(
  ui: ReactElement,
  {
    authContext,
    queryClient,
    ...renderOptions
  }: CustomRenderOptions = {},
) {
  return rtlRender(ui, {
    wrapper: ({ children }) => (
      <TestProvider authContext={authContext} queryClient={queryClient}>
        {children}
      </TestProvider>
    ),
    ...renderOptions,
  });
}

export * from '@testing-library/react';
export { renderWithProviders as render };
