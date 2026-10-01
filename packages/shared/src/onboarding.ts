/* ============================================================================
 * packages/shared — onboarding.ts
 * First-run onboarding ("guided start"). Progress is derived from the book
 * itself; only the status (pending / dismissed / completed) is stored. These
 * pure rules are shared so the api and web agree on "fresh" and on where a
 * returning user resumes.
 * ========================================================================= */
import { z } from 'zod';

export const ONBOARDING_STATUSES = ['pending', 'dismissed', 'completed'] as const;
export type OnboardingStatus = (typeof ONBOARDING_STATUSES)[number];

/** The guided start, in order. IKIGAI is optional. */
export const ONBOARDING_STEPS = ['chapter', 'wheel', 'focus', 'ikigai', 'move'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export const onboardingStatusSchema = z.enum(ONBOARDING_STATUSES);

export const onboardingProgressSchema = z.object({
  hasChapter: z.boolean(),
  focusCount: z.number().int(),
  ratedCount: z.number().int(),
  hasIkigai: z.boolean(),
  hasAction: z.boolean(),
});
export type OnboardingProgress = z.infer<typeof onboardingProgressSchema>;

export const onboardingSchema = z.object({
  status: onboardingStatusSchema,
  /** no active chapter and no goals — the welcome card's audience */
  fresh: z.boolean(),
  progress: onboardingProgressSchema,
});
export type Onboarding = z.infer<typeof onboardingSchema>;

export const updateOnboardingSchema = z.object({ status: onboardingStatusSchema }).strict();

export const onboardingSuggestSchema = z.object({ lang: z.enum(['en', 'he']).optional() });

export function isFreshBook(x: { hasChapter: boolean; goalCount: number }): boolean {
  return !x.hasChapter && x.goalCount === 0;
}

/**
 * Where a returning user resumes: the first step whose data is missing.
 * IKIGAI is optional — once the user has passed it (`ikigaiSeen`), resume
 * skips to the first move.
 */
export function firstOpenStep(p: OnboardingProgress, opts: { ikigaiSeen?: boolean } = {}): OnboardingStep | 'done' {
  if (!p.hasChapter) return 'chapter';
  if (p.ratedCount === 0) return 'wheel';
  if (p.focusCount === 0) return 'focus';
  if (!p.hasIkigai && !opts.ikigaiSeen) return 'ikigai';
  if (!p.hasAction) return 'move';
  return 'done';
}
