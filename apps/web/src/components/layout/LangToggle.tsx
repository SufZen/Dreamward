import { Languages } from 'lucide-react';
import { useLang } from '@/lib/lang';

export function LangToggle() {
  const { lang, toggle } = useLang();
  return (
    <button
      onClick={toggle}
      className="inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm text-fg-muted transition-colors hover:bg-surface hover:text-foreground"
      title={lang === 'he' ? 'Switch to English' : 'עבור לעברית'}
    >
      <Languages size={16} />
      <span className="font-mono text-xs uppercase">{lang === 'he' ? 'EN' : 'עב'}</span>
    </button>
  );
}
