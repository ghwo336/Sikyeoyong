'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';

/** LeakCompare.dc.html numbers (demo scene 5). Asked once; a 404 (demo off) is not retried. */
export function useLeakCompare() {
  return useQuery({
    queryKey: ['demo', 'leak-compare'],
    queryFn: () => api.getLeakCompare(),
    retry: false,
  });
}
