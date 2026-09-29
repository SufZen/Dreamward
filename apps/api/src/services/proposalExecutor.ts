/* ============================================================================
 * apps/api — services/proposalExecutor.ts
 * Executes an approved proposal: zod-validate the payload, run the mutation,
 * return the created/updated row id. Throws with a readable message on
 * failure (stored on the proposal as `error`).
 * ========================================================================= */
import { proposalPayloadSchemas, type ProposalType } from '@dreamward/shared';
import * as m from './mutations';

export function executeProposal(
  type: ProposalType,
  rawPayload: unknown,
  conversationId?: string | null,
  proposalId?: string | null,
): string {
  const schema = proposalPayloadSchemas[type];
  if (!schema) throw new Error(`unknown proposal type: ${type}`);
  const parsed = schema.safeParse(rawPayload);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`invalid payload — ${issues}`);
  }
  const p = parsed.data;

  switch (type) {
    case 'create_goal':
      return m.createGoal(p as Parameters<typeof m.createGoal>[0]);
    case 'update_goal_status':
      return m.updateGoalStatus(p as Parameters<typeof m.updateGoalStatus>[0]);
    case 'create_action':
      return m.createAction({
        ...(p as Parameters<typeof m.createAction>[0]),
        createdBy: 'agent',
        sourceProposalId: proposalId ?? null,
      });
    case 'update_action':
      return m.updateAction(p as Parameters<typeof m.updateAction>[0]);
    case 'complete_action':
      return m.completeAction(p as Parameters<typeof m.completeAction>[0]);
    case 'delete_action':
      return m.deleteAction(p as Parameters<typeof m.deleteAction>[0]);
    case 'create_journal_entry':
      return m.createJournalEntry(p as Parameters<typeof m.createJournalEntry>[0]);
    case 'update_section_content':
      return m.updateSectionContent(p as Parameters<typeof m.updateSectionContent>[0]);
    case 'update_life_vision_answer':
      return m.updateLifeVisionAnswer(p as Parameters<typeof m.updateLifeVisionAnswer>[0]);
    case 'update_content_block':
      return m.updateContentBlock(p as Parameters<typeof m.updateContentBlock>[0]);
    case 'save_memory':
      return m.saveMemory(p as Parameters<typeof m.saveMemory>[0], conversationId);
    case 'complete_weekly_review':
      return m.completeWeeklyReview(p as Parameters<typeof m.completeWeeklyReview>[0], conversationId);
  }
}
