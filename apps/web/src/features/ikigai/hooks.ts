import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { IkigaiCircle, IkigaiProfile, IkigaiSuggestRequest } from '@dreamward/shared';
import { api } from '@/lib/api';

export type { IkigaiProfile };

export interface IkigaiState {
  current: IkigaiProfile | null;
  draft: IkigaiProfile | null;
  history: { id: string; statement: string | null; status: string; completedAt: number | null }[];
}

export type IkigaiPatch = Partial<
  Pick<IkigaiProfile, 'items' | 'everyday' | 'statement' | 'confidence' | 'reflections' | 'step'>
>;

export const useIkigai = () => useQuery({ queryKey: ['ikigai'], queryFn: () => api.get<IkigaiState>('/ikigai') });

export function useStartIkigaiDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fromCurrent: boolean) => api.post<IkigaiProfile>('/ikigai/draft', { fromCurrent }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ikigai'] }),
  });
}

/** Autosave target — writes through to the cached draft without a refetch. */
export function useUpdateIkigai(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: IkigaiPatch) => api.put<IkigaiProfile>(`/ikigai/${id}`, patch),
    onSuccess: (p) => qc.setQueryData<IkigaiState>(['ikigai'], (s) => (s ? { ...s, draft: p } : s)),
  });
}

export function useCompleteIkigai() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<IkigaiProfile>(`/ikigai/${id}/complete`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ikigai'] }),
  });
}

export function useDiscardIkigaiDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/ikigai/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ikigai'] }),
  });
}

/** Whether an AI provider is configured (the ✨ suggest buttons hide otherwise). */
export const useAiAvailable = () =>
  useQuery({
    queryKey: ['agent', 'available'],
    queryFn: () => api.get<{ available: boolean }>('/agent/available').then((r) => r.available),
    staleTime: 60_000,
  });

export function useIkigaiSuggest() {
  return useMutation({
    mutationFn: (vars: IkigaiSuggestRequest & { lang: 'he' | 'en' }) =>
      api.post<{ suggestions: string[] }>('/agent/ikigai/suggest', vars).then((r) => r.suggestions),
  });
}

export type { IkigaiCircle };
