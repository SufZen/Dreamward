import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Pencil, Check } from 'lucide-react';
import { Badge, Button, Card } from '@dreamward/design-system';
import { useLang, pickLabel } from '@/lib/lang';
import { Icon } from '@/components/Icon';
import { SECTION_TYPES } from '@dreamward/shared';
import { useCategory } from './hooks';
import { SectionRenderer } from './SectionRenderer';
import { SectionEditor } from './SectionEditor';
import { RatingCard } from '@/features/chapter/RatingCard';
import { useCategoryRole } from '@/features/chapter/hooks';

/** Section title — the server's framework-pack wording, else the default pack. */
const sectionLabel = (lang: 'he' | 'en', section: { sectionType: string; labelEn?: string; labelHe?: string }) => {
  const t = SECTION_TYPES.find((s) => s.id === section.sectionType);
  const en = section.labelEn ?? t?.labelEn ?? section.sectionType;
  const he = section.labelHe ?? t?.labelHe ?? section.sectionType;
  return lang === 'he' ? he : en;
};

export function CategoryPage() {
  const { categoryId = '' } = useParams();
  const { lang, t } = useLang();
  const { data, isLoading, isError } = useCategory(categoryId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const role = useCategoryRole(categoryId);

  if (isLoading) return <p className="text-fg-muted">{t('loading')}</p>;
  if (isError || !data) return <p className="text-danger">{t('empty')}</p>;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[color:var(--rz-accent-soft)] text-primary">
          <Icon name={data.icon} size={28} />
        </div>
        <h1 dir="auto" className="text-4xl font-bold">
          {pickLabel(lang, data.labelEn, data.labelHe)}
        </h1>
        {role && (
          <Badge variant={role === 'focus' ? 'accent' : 'neutral'}>
            {role === 'focus' ? (lang === 'he' ? 'מיקוד בפרק' : 'Chapter focus') : lang === 'he' ? 'תחזוקה' : 'Maintenance'}
          </Badge>
        )}
      </header>

      <RatingCard categoryId={categoryId} />

      {data.sections
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((section) => {
          const editing = editingId === section.id;
          return (
            <Card key={section.id} className="p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-primary">{sectionLabel(lang, section)}</h2>
                <Button
                  variant={editing ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setEditingId(editing ? null : section.id)}
                >
                  {editing ? <Check size={14} /> : <Pencil size={14} />}
                  {editing ? (lang === 'he' ? 'סיום' : 'Done') : lang === 'he' ? 'עריכה' : 'Edit'}
                </Button>
              </div>
              {editing ? (
                <SectionEditor section={section} categoryId={categoryId} />
              ) : (
                <SectionRenderer section={section} />
              )}
            </Card>
          );
        })}
    </div>
  );
}
