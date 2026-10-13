/** The product tour, in order. Targets are `data-tour` anchors in the UI. {mod} becomes ⌘K or Ctrl+K. */
export interface TourStep {
  /** data-tour value to spotlight; none = a centred card */
  target?: string;
  /** page to show for this step */
  route?: string;
  title: { he: string; en: string };
  body: { he: string; en: string };
  /** interactive: the step completes when this window event fires */
  waitFor?: 'dw:step-checked' | 'dw:palette-open';
  /** the nudge shown under the text for interactive steps */
  tryIt?: { he: string; en: string };
  art?: 'welcome' | 'finish';
  kind?: 'plain';
}

export const TOUR_STEPS: TourStep[] = [
  {
    route: '/',
    art: 'welcome',
    title: { he: 'ברוך הבא לספר שלך', en: 'Welcome to your book' },
    body: {
      he: 'Dreamward עוזר לך לראות לאן אתה הולך — ולעשות את הצעד הבא. סיור של דקה וחצי, ואפשר לצאת בכל רגע.',
      en: 'Dreamward helps you see where you’re going — and take the next step. A ninety-second tour; leave any time.',
    },
  },
  {
    target: 'nav',
    title: { he: 'שבעה מקומות, לפי סדר השימוש', en: 'Seven places, in the order you use them' },
    body: {
      he: 'היום → הפרק שאתה חי עכשיו → הספר → מטרות וצעדים → יומן → לוחות חזון. מתחת: תחומי המיקוד של הפרק, עם הציון של כל אחד.',
      en: 'Today → the season you’re in → your book → goals and steps → journal → vision boards. Below: your chapter’s focus areas, each with its score.',
    },
  },
  {
    target: 'today-steps',
    route: '/',
    title: { he: 'הצעדים של היום', en: 'Today’s steps' },
    body: {
      he: 'מה שבאיחור, מה להיום, ומה מקרב אותך לתחומי המיקוד — בראש. מסמנים כאן, בלי לעבור עמוד.',
      en: 'What’s overdue, what’s due today, and what moves your focus areas — on top. Check them off right here.',
    },
    waitFor: 'dw:step-checked',
    tryIt: { he: 'נסה: סמן צעד אחד כבוצע', en: 'Try it: check off one step' },
  },
  {
    target: 'quick-add',
    route: '/',
    title: { he: 'לתפוס צעד לפני שהוא בורח', en: 'Catch a step before it slips away' },
    body: {
      he: 'כתוב ולחץ Enter — הצעד נכנס להיום. את הפרטים אפשר להוסיף אחר כך.',
      en: 'Type and press Enter — it lands on today. Details can come later.',
    },
  },
  {
    target: 'journal-line',
    route: '/',
    title: { he: 'שורה אחת ביום', en: 'One line a day' },
    body: {
      he: 'לא צריך רשומה ארוכה. משפט על מה שהיה חשוב היום מספיק — וכך נבנה רצף.',
      en: 'No long entry needed. A sentence about what mattered today is enough — that’s how a streak starts.',
    },
  },
  {
    target: 'search',
    title: { he: 'הכול במרחק {mod}', en: 'Everything is one {mod} away' },
    body: {
      he: 'קפיצה לכל עמוד או תחום, חיפוש מטרה או רשומה ביומן, או הקלדת כותרת והוספה כצעד או כמטרה. גם / פותח.',
      en: 'Jump to any page or area, find a goal or journal entry, or type a title to add it as a step or goal. / opens it too.',
    },
    waitFor: 'dw:palette-open',
    tryIt: { he: 'נסה: לחץ {mod}', en: 'Try it: press {mod}' },
  },
  {
    target: 'nav-chapter',
    title: { he: 'הפרק הנוכחי', en: 'The current chapter' },
    body: {
      he: 'לכל תקופה יש מה שהיא נועדה ליצור. כאן נותנים לה שם, בוחרים 1–5 תחומי מיקוד ומדרגים את גלגל החיים.',
      en: 'Every season is meant to create something. Name it here, pick 1–5 focus areas, and rate your life wheel.',
    },
  },
  {
    target: 'nav-book',
    title: { he: 'הספר שלך', en: 'Your book' },
    body: {
      he: 'החזון, האיקיגאי ושנים-עשר תחומי החיים — כל עמוד במקום אחד. כל תחום מחובר למטרות ולצעדים שלו.',
      en: 'Your vision, IKIGAI and the twelve life areas — every page in one place. Each area connects to its goals and steps.',
    },
  },
  {
    target: 'clarity',
    title: { he: 'Clarity', en: 'Clarity' },
    body: {
      he: 'העוזר האישי בתוך הספר: עוזר לחשוב, מציע צעדים מתוך מה שכתבת, ומלווה את הסקירה השבועית. כל שינוי שלו מחכה לאישור שלך.',
      en: 'The assistant inside your book: thinks with you, suggests steps from what you wrote, and walks the weekly review with you. Every change it suggests waits for your yes.',
    },
  },
  {
    art: 'finish',
    title: { he: 'זהו. הצעד הבא שלך מחכה.', en: 'That’s it. Your next step is waiting.' },
    body: {
      he: 'בסופי שבוע תופיע הזמנה לסקירה שבועית של עשר דקות. את הסיור אפשר לראות שוב מההגדרות או מ-{mod}.',
      en: 'At the weekend you’ll get an invite to a ten-minute weekly review. Replay this tour any time from Settings or {mod}.',
    },
  },
];
