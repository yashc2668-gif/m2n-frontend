import { MutationCache, QueryClient } from '@tanstack/react-query';

import { ApiError } from '@/api/client';

/**
 * Global mutation cache with 409 conflict detection.
 * When a mutation fails with HTTP 409 (optimistic lock conflict),
 * dispatches a custom event so the toast layer can notify the user
 * and invalidates related queries to refetch fresh data.
 */
const mutationCache = new MutationCache({
  onError(error) {
    if (error instanceof ApiError && error.status === 409) {
      window.dispatchEvent(
        new CustomEvent('api:conflict', {
          detail: 'This record was updated by someone else. Please reload and try again.',
        }),
      );
    }
  },
});

export const queryClient = new QueryClient({
  mutationCache,
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30000,
    },
    mutations: {
      retry: 0,
    },
  },
});
