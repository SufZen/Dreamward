import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, error) => {
        // Never retry auth failures.
        if (error instanceof ApiError && error.status === 401) return false;
        return count < 2;
      },
      refetchOnWindowFocus: false,
    },
  },
});
