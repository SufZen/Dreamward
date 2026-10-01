import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CategorySection, Onboarding, OnboardingStatus } from '@dreamward/shared';
import { api } from '@/lib/api';

export type { Onboarding };

export const useOnboarding = () =>
  useQuery({ queryKey: ['onboarding'], queryFn: () => api.get<Onboarding>('/onboarding') });

export function useSetOnboardingStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (status: OnboardingStatus) => api.put<Onboarding>('/onboarding', { status }),
    onSuccess: (o) => qc.setQueryData(['onboarding'], o),
  });
}

/** Clarity's three first-move ideas (one-shot; nothing is written). */
export function useOnboardingSuggest() {
  return useMutation({
    mutationFn: (lang: 'he' | 'en') =>
      api.post<{ suggestions: string[] }>('/agent/onboarding/suggest', { lang }).then((r) => r.suggestions),
  });
}

/** The strategy section of a life area — where a first move links to. */
export async function strategySectionId(categoryId: string): Promise<string | null> {
  try {
    const c = await api.get<{ sections: CategorySection[] }>(`/categories/${encodeURIComponent(categoryId)}`);
    return c.sections.find((s) => s.sectionType === 'strategy')?.id ?? null;
  } catch {
    return null;
  }
}
