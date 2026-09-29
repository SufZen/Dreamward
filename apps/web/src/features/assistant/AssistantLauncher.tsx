import { Sparkles } from 'lucide-react';
import { cn } from '@dreamward/design-system';
import { useLang } from '@/lib/lang';
import { useAssistantStore } from './store';
import { usePendingCount } from './useProposals';
import { AssistantPanel } from './AssistantPanel';

export function AssistantLauncher() {
  const { lang } = useLang();
  const { open, openPanel } = useAssistantStore();
  const { data: pending } = usePendingCount();

  return (
    <>
      {!open && (
        <button
          onClick={() => openPanel()}
          title={lang === 'he' ? 'דבר עם חיימי' : 'Chat with Lify'}
          className={cn(
            'fixed bottom-6 z-40 flex h-14 w-14 items-center justify-center rounded-full',
            'bg-primary text-[color:var(--rz-accent-fg)] shadow-glow transition-transform hover:scale-105',
            'end-6',
          )}
        >
          <Sparkles size={24} />
          {!!pending && pending > 0 && (
            <span className="absolute -top-1 -end-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-2xs font-bold text-white">
              {pending}
            </span>
          )}
        </button>
      )}
      <AssistantPanel />
    </>
  );
}
