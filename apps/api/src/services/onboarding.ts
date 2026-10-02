/* ============================================================================
 * apps/api — services/onboarding.ts
 * First-run onboarding ("guided start"). Progress is derived from the book;
 * only the status lives in user_flags. A missing or unreadable flag means
 * 'pending'.
 * ========================================================================= */
import { count, eq } from 'drizzle-orm';
import { isFreshBook, onboardingStatusSchema, type Onboarding, type OnboardingStatus } from '@dreamward/shared';
import { getDb, schema } from '../db/client';
import { nowMs } from '../lib/id';
import { getActiveChapter, getCurrentIkigai, latestRatings } from './meaning';

const KEY = 'onboarding';

export function getOnboardingStatus(): OnboardingStatus {
  const row = getDb().select().from(schema.userFlags).where(eq(schema.userFlags.key, KEY)).get();
  const parsed = onboardingStatusSchema.safeParse((row?.value as { status?: unknown } | undefined)?.status);
  return parsed.success ? parsed.data : 'pending';
}

export function getOnboarding(): Onboarding {
  const db = getDb();
  const chapter = getActiveChapter();
  const goalCount = db.select({ n: count() }).from(schema.goals).get()?.n ?? 0;
  const actionCount = db.select({ n: count() }).from(schema.actions).get()?.n ?? 0;
  return {
    status: getOnboardingStatus(),
    fresh: isFreshBook({ hasChapter: chapter !== null, goalCount }),
    progress: {
      hasChapter: chapter !== null,
      focusCount: chapter?.focusCategoryIds.length ?? 0,
      ratedCount: latestRatings().filter((r) => r.latest !== null).length,
      hasIkigai: getCurrentIkigai() !== null,
      hasAction: actionCount > 0,
    },
  };
}

export function setOnboardingStatus(status: OnboardingStatus): Onboarding {
  const value = { status };
  getDb()
    .insert(schema.userFlags)
    .values({ key: KEY, value, updatedAt: nowMs() })
    .onConflictDoUpdate({ target: schema.userFlags.key, set: { value, updatedAt: nowMs() } })
    .run();
  return getOnboarding();
}
