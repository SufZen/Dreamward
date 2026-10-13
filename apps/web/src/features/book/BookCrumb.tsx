import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useLang } from '@/lib/lang';

/** "‹ My book": the way back to the book's table of contents. */
export function BookCrumb() {
  const { t } = useLang();
  return (
    <Link to="/book" className="inline-flex items-center gap-1 hover:text-foreground">
      <ChevronLeft size={14} className="ltr:rotate-180" /> {t('myBook')}
    </Link>
  );
}
