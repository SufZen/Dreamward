import { useState } from 'react';
import { Check, X, ChevronDown, Sparkles, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import type { ProposalRow, ProposalType } from '@dreamward/shared';
import { Button, cn } from '@dreamward/design-system';
import { useLang } from '@/lib/lang';
import { useResolveProposal } from './useProposals';

const TYPE_LABEL: Record<ProposalType, { he: string; en: string }> = {
  create_goal: { he: 'מטרה חדשה', en: 'New goal' },
  update_goal_status: { he: 'עדכון סטטוס מטרה', en: 'Update goal status' },
  create_action: { he: 'פעולה חדשה', en: 'New action' },
  update_action: { he: 'עדכון פעולה', en: 'Update action' },
  complete_action: { he: 'סיום פעולה', en: 'Complete action' },
  delete_action: { he: 'מחיקת פעולה', en: 'Delete action' },
  create_journal_entry: { he: 'רשומת יומן', en: 'Journal entry' },
  update_section_content: { he: 'עדכון מקטע', en: 'Update section' },
  update_life_vision_answer: { he: 'עדכון תשובת חזון', en: 'Update vision answer' },
  update_content_block: { he: 'עדכון תוכן', en: 'Update content' },
  save_memory: { he: 'שמירת זיכרון', en: 'Save memory' },
  complete_weekly_review: { he: 'סיום סקירה שבועית', en: 'Complete weekly review' },
};

export function ProposalCard({
  proposal,
  onResolved,
}: {
  proposal: ProposalRow;
  onResolved?: (status: ProposalRow['status']) => void;
}) {
  const { lang } = useLang();
  const { approve, reject } = useResolveProposal();
  const [expanded, setExpanded] = useState(false);
  const busy = approve.isPending || reject.isPending;
  const label = TYPE_LABEL[proposal.type]?.[lang] ?? proposal.type;

  const onApprove = async () => {
    const res = await approve.mutateAsync(proposal.id);
    onResolved?.(res.status);
  };
  const onReject = async () => {
    await reject.mutateAsync(proposal.id);
    onResolved?.('rejected');
  };

  const resolved = proposal.status !== 'pending';

  return (
    <div
      className={cn(
        'mt-2 rounded-lg border p-3 text-sm',
        proposal.status === 'pending' && 'border-[color:var(--rz-border-accent)] bg-[color:var(--rz-accent-soft)]',
        proposal.status === 'approved' && 'border-border bg-success-soft',
        proposal.status === 'rejected' && 'border-border bg-surface opacity-70',
        proposal.status === 'failed' && 'border-border bg-danger-soft',
      )}
    >
      <div className="flex items-center gap-2">
        <Sparkles size={14} className="shrink-0 text-primary" />
        <span className="font-mono text-2xs uppercase tracking-wider text-fg-subtle">{label}</span>
        {proposal.status === 'approved' && <CheckCircle2 size={14} className="ms-auto text-success" />}
        {proposal.status === 'rejected' && <XCircle size={14} className="ms-auto text-fg-subtle" />}
        {proposal.status === 'failed' && <AlertTriangle size={14} className="ms-auto text-danger" />}
      </div>

      <p dir="auto" className="mt-1.5 font-medium leading-snug">
        {proposal.summary}
      </p>

      <button
        onClick={() => setExpanded((v) => !v)}
        className="mt-1 inline-flex items-center gap-1 text-xs text-fg-subtle hover:text-fg-muted"
      >
        <ChevronDown size={12} className={cn('transition-transform', expanded && 'rotate-180')} />
        {lang === 'he' ? 'פרטים' : 'Details'}
      </button>
      {expanded && (
        <pre
          dir="ltr"
          className="mt-1 max-h-48 overflow-auto rounded bg-bg-elevated p-2 text-2xs text-fg-muted"
        >
          {JSON.stringify(proposal.payload, null, 2)}
        </pre>
      )}

      {proposal.status === 'failed' && proposal.error && (
        <p className="mt-1 text-xs text-danger">{proposal.error}</p>
      )}

      {!resolved && (
        <div className="mt-2 flex gap-2">
          <Button size="sm" onClick={onApprove} disabled={busy}>
            <Check size={13} /> {lang === 'he' ? 'אשר' : 'Approve'}
          </Button>
          <Button size="sm" variant="ghost" onClick={onReject} disabled={busy}>
            <X size={13} /> {lang === 'he' ? 'דחה' : 'Reject'}
          </Button>
        </div>
      )}
    </div>
  );
}
