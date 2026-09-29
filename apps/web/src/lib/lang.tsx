import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Lang = 'he' | 'en';

/** UI chrome strings (content itself is language-agnostic, stored in the DB). */
const STRINGS = {
  appName: { he: 'Dreamward', en: 'Dreamward' },
  dashboard: { he: 'לוח בקרה', en: 'Dashboard' },
  myBook: { he: 'הספר שלי', en: 'My book' },
  cover: { he: 'שער', en: 'Cover' },
  frontMatter: { he: 'פתיחה', en: 'Front Matter' },
  categories: { he: 'קטגוריות', en: 'Categories' },
  lifeVision: { he: 'חיי החלומות', en: 'Dream life' },
  chapter: { he: 'הפרק הנוכחי', en: 'Current Chapter' },
  ikigai: { he: 'איקיגאי', en: 'IKIGAI' },
  implementation: { he: 'יישום', en: 'Implementation' },
  goals: { he: 'מטרות', en: 'Goals' },
  actions: { he: 'פעולות', en: 'Actions' },
  journal: { he: 'יומן', en: 'Journal' },
  moodboard: { he: 'לוח חזון', en: 'Moodboard' },
  gallery: { he: 'גלריה', en: 'Gallery' },
  snapshots: { he: 'תמונות מצב', en: 'Snapshots' },
  settings: { he: 'הגדרות', en: 'Settings' },
  logout: { he: 'התנתקות', en: 'Log out' },
  login: { he: 'התחברות', en: 'Log in' },
  password: { he: 'סיסמה', en: 'Password' },
  saving: { he: 'שומר…', en: 'Saving…' },
  saved: { he: 'נשמר', en: 'Saved' },
  saveError: { he: 'שגיאת שמירה', en: 'Save failed' },
  premises: { he: 'הנחות יסוד', en: 'Premises' },
  vision: { he: 'חזון', en: 'Vision' },
  purpose: { he: 'מטרה', en: 'Purpose' },
  strategy: { he: 'אסטרטגיה', en: 'Strategy' },
  habits: { he: 'הרגלים', en: 'Habits' },
  leverages: { he: 'מנופים', en: 'Leverages' },
  empty: { he: 'הדף הזה עדיין מחכה לך ✨', en: 'This page is waiting for you ✨' },
  loading: { he: 'טוען…', en: 'Loading…' },
} as const;

export type StringKey = keyof typeof STRINGS;

interface LangCtx {
  lang: Lang;
  dir: 'rtl' | 'ltr';
  setLang: (l: Lang) => void;
  toggle: () => void;
  t: (key: StringKey) => string;
}

const Ctx = createContext<LangCtx | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => (localStorage.getItem('dw-lang') as Lang) || 'he');

  const dir: 'rtl' | 'ltr' = lang === 'he' ? 'rtl' : 'ltr';

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    localStorage.setItem('dw-lang', lang);
  }, [lang, dir]);

  const setLang = useCallback((l: Lang) => setLangState(l), []);
  const toggle = useCallback(() => setLangState((l) => (l === 'he' ? 'en' : 'he')), []);
  const t = useCallback((key: StringKey) => STRINGS[key][lang], [lang]);

  const value = useMemo(() => ({ lang, dir, setLang, toggle, t }), [lang, dir, setLang, toggle, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLang(): LangCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useLang must be used within LangProvider');
  return ctx;
}

/** Pick the right label from a bilingual fixed-label object. */
export function pickLabel(lang: Lang, labelEn: string, labelHe: string): string {
  return lang === 'he' ? labelHe : labelEn;
}
