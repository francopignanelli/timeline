import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from '../features/auth/auth-provider';
import { router } from './router';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Bounded retries also act as a cost safeguard (COSTS.md).
      retry: 1,
      staleTime: 30_000,
      // Off deliberately: this app is full of long-lived edit forms seeded
      // from query data. A background refetch hands back new object
      // identities, which used to re-trigger those forms' reset effects and
      // wipe whatever the user had already typed (DECISIONS #38). Data here
      // is single-owner and rarely changes elsewhere, so refetching on every
      // window focus bought nothing and cost API calls.
      refetchOnWindowFocus: false,
    },
  },
});

export function AppProviders() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  );
}
