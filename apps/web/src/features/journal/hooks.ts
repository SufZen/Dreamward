import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface JournalEntry {
  id: string;
  entryDate: number;
  title: string | null;
  bodyRichtext: string;
  mood: string | null;
  createdAt: number;
  updatedAt: number;
}

export const useJournal = (q?: string) =>
  useQuery({
    queryKey: ['journal', q ?? ''],
    queryFn: () => api.get<JournalEntry[]>(`/journal${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  });

export const useJournalEntry = (id: string | undefined) =>
  useQuery({
    queryKey: ['journal-entry', id],
    queryFn: () => api.get<JournalEntry>(`/journal/${id}`),
    enabled: !!id,
  });

export function useCreateJournal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<JournalEntry>('/journal', { bodyRichtext: '' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['journal'] }),
  });
}

export function useUpdateJournal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; title?: string | null; bodyRichtext?: string }) =>
      api.put(`/journal/${vars.id}`, { title: vars.title, bodyRichtext: vars.bodyRichtext }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['journal'] });
      qc.invalidateQueries({ queryKey: ['journal-entry', vars.id] });
    },
  });
}

export function useDeleteJournal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/journal/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['journal'] }),
  });
}
