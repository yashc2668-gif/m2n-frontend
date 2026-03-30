import { useAuth } from '@/app/providers/auth-provider';
import { AppRouterProvider } from '@/app/router/route-tree';
import { queryClient } from '@/lib/query-client';

export function AppRouter() {
  const auth = useAuth();

  return <AppRouterProvider context={{ auth, queryClient }} />;
}
