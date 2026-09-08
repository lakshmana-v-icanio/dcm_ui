import { QueryClient } from '@tanstack/react-query';

/**
 * Single QueryClient for the app. Defaults tuned for the PC Manager use case:
 *
 * - `staleTime` 30 s so tab-switches don't spam the REST API but data is still fresh.
 * - `refetchOnWindowFocus: false` — schedules don't change without user action here.
 * - `retry: 1` — one silent retry, then surface the error (401/403 handled by app-level UI).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});

export const queryKeys = {
  schedules: {
    all: ['schedules'] as const,
    list: (pageNumber: number, pageSize: number) =>
      ['schedules', 'list', { pageNumber, pageSize }] as const,
    detail: (scheduleId: number) =>
      ['schedules', 'detail', scheduleId] as const,
  },
  products: {
    search: (query: string) => ['products', 'search', query] as const,
  },
  classification: {
    latest: (scheduleId: number) =>
      ['classification', 'latest', scheduleId] as const,
  },
  scheduleSetup: {
    rateTables: (scheduleGid: string) =>
      ['schedule-setup', 'rate-tables', scheduleGid] as const,
    variables: (scheduleGid: string) =>
      ['schedule-setup', 'variables', scheduleGid] as const,
  },
};
