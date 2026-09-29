import { Construction } from 'lucide-react';
import { useLang } from '@/lib/lang';

/** Temporary page for routes whose feature epic isn't built yet. */
export function Placeholder({ title }: { title: string }) {
  const { lang } = useLang();
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center text-fg-muted">
      <Construction size={40} className="text-primary" />
      <h1 className="text-2xl font-bold text-foreground">{title}</h1>
      <p className="text-sm">{lang === 'he' ? 'בקרוב — בבנייה' : 'Coming soon — under construction'}</p>
    </div>
  );
}
