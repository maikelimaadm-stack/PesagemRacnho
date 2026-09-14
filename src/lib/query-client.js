import { QueryClient } from '@tanstack/react-query';

export const queryClientInstance = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: false,
      networkMode: 'always',
      staleTime: Infinity,
      gcTime: Infinity,
    },
    mutations: {
      retry: false,
      networkMode: 'always',
    },
  },
});
