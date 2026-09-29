import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Chapter, LatestRating, ListItem, Rating } from '@dreamward/shared';
import { api } from '@/lib/api';

export type { Chapter, LatestRating, Rating };

/* ── Current Life Chapter ────────────────────────────────────────────────── */

export const useCurrentChapter = () =>
  useQuery({
    queryKey: ['chapter', 'current'],
    queryFn: () => api.get<{ chapter: Chapter | null }>('/chapters/current').then((r) => r.chapter),
  });

export const useChapters = () => useQuery({ queryKey: ['chapters'], queryFn: () => api.get<Chapter[]>('/chapters') });

export interface ChapterPatch {
  title?: string;
  intention?: string | null;
  focusCategoryIds?: string[];
  maintenanceCategoryIds?: string[];
  notNow?: ListItem[];
  noLongerAcceptable?: ListItem[];
  reviewDate?: number | null;
}

function useInvalidateChapters() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['chapter'] });
    qc.invalidateQueries({ queryKey: ['chapters'] });
  };
}

export function useCreateChapter() {
  const invalidate = useInvalidateChapters();
  return useMutation({
    mutationFn: (vars: ChapterPatch & { title: string }) => api.post<Chapter>('/chapters', vars),
    onSuccess: invalidate,
  });
}

/** Autosave target — does not refetch the list on every keystroke save. */
export function useUpdateChapter(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: ChapterPatch) => api.put<Chapter>(`/chapters/${id}`, patch),
    onSuccess: (ch) => qc.setQueryData(['chapter', 'current'], ch),
  });
}

export function useCloseChapter() {
  const invalidate = useInvalidateChapters();
  return useMutation({
    mutationFn: (vars: { id: string; closingReflection?: string | null }) =>
      api.post<Chapter>(`/chapters/${vars.id}/close`, { closingReflection: vars.closingReflection ?? null }),
    onSuccess: invalidate,
  });
}

/* ── Life wheel ratings ──────────────────────────────────────────────────── */

export const useLatestRatings = () =>
  useQuery({ queryKey: ['ratings', 'latest'], queryFn: () => api.get<LatestRating[]>('/ratings/latest') });

export const useRatingHistory = (categoryId: string) =>
  useQuery({
    queryKey: ['ratings', 'history', categoryId],
    queryFn: () => api.get<Rating[]>(`/ratings?categoryId=${encodeURIComponent(categoryId)}`),
  });

export function useCreateRating() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { categoryId: string; score: number; reality?: string | null; gap?: string | null }) =>
      api.post<Rating>('/ratings', vars),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ratings'] }),
  });
}

/** Focus / maintenance role of a category in the active chapter. */
export function useCategoryRole(categoryId: string): 'focus' | 'maintenance' | null {
  const { data: chapter } = useCurrentChapter();
  if (!chapter) return null;
  if (chapter.focusCategoryIds.includes(categoryId)) return 'focus';
  if (chapter.maintenanceCategoryIds.includes(categoryId)) return 'maintenance';
  return null;
}
