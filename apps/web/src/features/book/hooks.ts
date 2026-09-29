import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CATEGORIES } from '@dreamward/shared';
import { api } from '@/lib/api';
import { useLang, pickLabel } from '@/lib/lang';

export interface Category {
  id: string;
  labelEn: string;
  labelHe: string;
  icon: string;
  sortOrder: number;
}

export interface Section {
  id: string;
  categoryId: string;
  labelEn?: string;
  labelHe?: string;
  sectionType: string;
  shape: 'list' | 'statement' | 'rich' | 'composite' | 'identity';
  sortOrder: number;
  content: unknown;
  bodyRichtext: string | null;
  updatedAt: number;
}

export interface CategoryWithSections extends Category {
  sections: Section[];
}

export interface ContentBlock {
  id: string;
  group: string;
  labelEn: string;
  labelHe: string;
  kind: 'rich' | 'list';
  content: unknown;
  bodyRichtext: string | null;
  sortOrder: number;
  updatedAt: number;
}

export interface LifeVisionPrompt {
  id: string;
  question: string;
  labelEn?: string;
  labelHe?: string;
  answerRichtext: string | null;
  sortOrder: number;
  updatedAt: number;
}

export const useCategories = () =>
  // Categories are effectively static for a session — cache 5 min to avoid a
  // refetch on every page navigation.
  useQuery({ queryKey: ['categories'], queryFn: () => api.get<Category[]>('/categories'), staleTime: 5 * 60_000 });

/**
 * Label of a life area in the server's wording (its framework pack), falling
 * back to the default pack until the categories have loaded.
 */
export function useAreaLabel(): (id: string) => string {
  const { lang } = useLang();
  const { data } = useCategories();
  return (id: string) => {
    const c = data?.find((x) => x.id === id) ?? CATEGORIES.find((x) => x.id === id);
    return c ? pickLabel(lang, c.labelEn, c.labelHe) : id;
  };
}

export const useCategory = (id: string) =>
  useQuery({ queryKey: ['category', id], queryFn: () => api.get<CategoryWithSections>(`/categories/${id}`) });

export const useContentBlocks = (group?: string) =>
  useQuery({
    queryKey: ['content-blocks', group ?? 'all'],
    queryFn: () => api.get<ContentBlock[]>(`/content-blocks${group ? `?group=${group}` : ''}`),
  });

export const useContentBlock = (id: string) =>
  useQuery({ queryKey: ['content-block', id], queryFn: () => api.get<ContentBlock>(`/content-blocks/${id}`) });

export const useLifeVision = () =>
  useQuery({ queryKey: ['life-vision'], queryFn: () => api.get<LifeVisionPrompt[]>('/life-vision') });

/** Autosave a section; invalidates its category on success. */
export function useUpdateSection(categoryId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; content?: unknown; bodyRichtext?: string | null }) =>
      api.put<{ ok: true; updatedAt: number }>(`/sections/${vars.id}`, {
        content: vars.content,
        bodyRichtext: vars.bodyRichtext,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['category', categoryId] }),
  });
}

export function useUpdateContentBlock(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { content?: unknown; bodyRichtext?: string | null }) =>
      api.put<{ ok: true; updatedAt: number }>(`/content-blocks/${id}`, vars),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['content-block', id] });
      qc.invalidateQueries({ queryKey: ['content-blocks'] });
    },
  });
}

export function useUpdateLifeVision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; answerRichtext: string | null }) =>
      api.put<{ ok: true; updatedAt: number }>(`/life-vision/${vars.id}`, { answerRichtext: vars.answerRichtext }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['life-vision'] }),
  });
}
