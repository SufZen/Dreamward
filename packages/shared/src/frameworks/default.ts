/* ============================================================================
 * The default framework pack — original wording written for this project.
 * Twelve broad life areas; in each, what I believe, what I envision, who I am
 * becoming, why it matters and how I will get there.
 * ========================================================================= */
import type { FrameworkPack } from './types';

export const DEFAULT_PACK: FrameworkPack = {
  id: 'dreamward-default',
  name: { en: 'Dreamward life areas', he: 'תחומי החיים של Dreamward' },
  description: {
    en: 'Twelve life areas. In each: what I believe, the life I envision, who I am becoming, why it matters and how I will get there.',
    he: 'שנים-עשר תחומי חיים. בכל אחד: במה אני מאמין, החיים שאני מדמיין, מי אני הופך להיות, למה זה חשוב ואיך אגיע לשם.',
  },
  license: 'CC-BY-SA-4.0',
  categories: {
    health_fitness: { en: 'Health & Energy', he: 'בריאות ואנרגיה' },
    intellectual: { en: 'Mind & Learning', he: 'חשיבה ולמידה' },
    emotional: { en: 'Emotional Wellbeing', he: 'רווחה רגשית' },
    character: { en: 'Character & Values', he: 'אופי וערכים' },
    spiritual: { en: 'Spirit & Meaning', he: 'רוח ומשמעות' },
    love: { en: 'Love & Partnership', he: 'אהבה וזוגיות' },
    parenting: { en: 'Parenting & Family', he: 'הורות ומשפחה' },
    social: { en: 'Friends & Community', he: 'חברים וקהילה' },
    financial: { en: 'Money & Freedom', he: 'כסף וחופש כלכלי' },
    career: { en: 'Work & Contribution', he: 'עבודה ותרומה' },
    sex: { en: 'Intimacy', he: 'אינטימיות' },
    quality_of_life: { en: 'Joy & Lifestyle', he: 'הנאה ואיכות חיים' },
  },
  sectionTypes: {
    premises: { en: 'What I believe', he: 'במה אני מאמין' },
    vision: { en: 'Vision', he: 'חזון' },
    identity: { en: 'Who I am becoming', he: 'מי אני הופך להיות' },
    purpose: { en: 'Why it matters', he: 'למה זה חשוב לי' },
    strategy: { en: 'How I will get there', he: 'איך אגיע לשם' },
    qol_experiences: { en: 'Experiences', he: 'חוויות' },
    qol_environment: { en: 'Surroundings', he: 'הסביבה שלי' },
    qol_materialistic: { en: 'Things I would love to have', he: 'דברים שאשמח שיהיו לי' },
  },
  contentBlocks: {
    cover: { en: 'Cover', he: 'שער' },
    gratitude_intro: { en: 'Gratitude', he: 'הכרת תודה' },
    current_assessments: { en: 'Where I stand today', he: 'איפה אני עומד היום' },
    what_i_want: { en: 'What I want', he: 'מה אני רוצה' },
    what_makes_me_happy: { en: 'What lights me up', he: 'מה מדליק אותי' },
    impl_effective: { en: 'Making it real', he: 'להפוך את זה למציאות' },
    impl_funnel: { en: 'Choosing my focus', he: 'לבחור במה להתמקד' },
    impl_lifestyle: { en: 'Weaving it into daily life', he: 'לשלב את זה בשגרה' },
    impl_stepping_in: { en: 'Living it now', he: 'לחיות את זה כבר עכשיו' },
  },
  visionPrompts: {
    dream_home: { en: 'The home I love living in', he: 'הבית שאני אוהב לחיות בו' },
    ideal_day: { en: 'A perfect ordinary day', he: 'יום רגיל ומושלם' },
    health_fitness: { en: 'How my body feels and moves', he: 'איך הגוף שלי מרגיש ונע' },
    intellectual: { en: 'How I keep growing my mind', he: 'איך אני ממשיך לצמוח בחשיבה' },
    emotions: { en: 'The feelings that fill my days', he: 'הרגשות שממלאים את הימים שלי' },
    character: { en: 'The person I have become', he: 'האדם שהפכתי להיות' },
    spiritual: { en: 'What connects me to something bigger', he: 'מה מחבר אותי למשהו גדול ממני' },
    ideal_relationship: { en: 'The partnership I share', he: 'הזוגיות שאני חולק' },
    family: { en: 'Our family life', he: 'חיי המשפחה שלנו' },
    friendships: { en: 'The people around me', he: 'האנשים שסביבי' },
    financial: { en: 'My financial freedom', he: 'החופש הכלכלי שלי' },
    career: { en: 'Work that matters', he: 'עבודה שיש בה משמעות' },
    lifestyle: { en: 'How I enjoy life', he: 'איך אני נהנה מהחיים' },
    sex: { en: 'Intimacy and closeness', he: 'אינטימיות וקרבה' },
  },
};
