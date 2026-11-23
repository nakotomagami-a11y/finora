"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, useState, type ReactNode } from "react";

/** The defaults of the page's request cache: a local app, so no refetch on focus, and no retry of a refusal. */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        staleTime: 15_000,
        // A 4xx answer will not change on a retry; a dropped connection or a 5xx may, once.
        retry: (failureCount, error) => failureCount < 1 && !(error instanceof Error && /^(http_4|bad_request|not_found|forbidden|purpose_blocked)/u.test(error.message)),
      },
    },
  });
}

/** One query client per browser tab, created once. */
export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(createQueryClient);
  // createElement, not JSX, so a unit test can import this file without a JSX transform.
  return createElement(QueryClientProvider, { client }, children);
}
