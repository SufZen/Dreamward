import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProposalRow } from '@dreamward/shared';
import { api } from '@/lib/api';

interface ProposalsResponse {
  items: ProposalRow[];
  pendingCount: number;
}

export function usePendingCount() {
  return useQuery({
    queryKey: ['proposals'],
    queryFn: () => api.get<ProposalsResponse>('/proposals?status=pending'),
    refetchInterval: 30_000,
    select: (d) => d.pendingCount,
  });
}

/** Invalidate every feature a proposal could have changed, so the UI updates live. */
function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  for (const key of [
    ['proposals'],
    ['goals'],
    ['goals-summary'],
    ['journal'],
    ['life-vision'],
    ['content-blocks'],
    ['actions'],
    ['categories'],
  ]) {
    qc.invalidateQueries({ queryKey: key });
  }
  qc.invalidateQueries({ queryKey: ['category'] }); // any category detail
}

export function useResolveProposal() {
  const qc = useQueryClient();
  const approve = useMutation({
    mutationFn: (id: string) => api.post<ProposalRow>(`/proposals/${id}/approve`),
    onSuccess: () => invalidateAll(qc),
  });
  const reject = useMutation({
    mutationFn: (id: string) => api.post<ProposalRow>(`/proposals/${id}/reject`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['proposals'] }),
  });
  return { approve, reject };
}
