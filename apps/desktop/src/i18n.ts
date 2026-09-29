/* Menu and dialog strings — Hebrew when the OS language is Hebrew. */
import { app } from 'electron';

const en = {
  file: 'File',
  view: 'View',
  open: 'Open %s',
  quit: 'Quit',
  restart: 'Restart',
  openLogs: 'Open logs',
  backupNow: 'Back up now',
  backupDone: 'Backup complete.',
  backupFailed: 'The backup did not complete.',
  openDataFolder: 'Open data folder',
  openBackupsFolder: 'Open backups folder',
  startAtLogin: 'Start at login',
  keepRunning: 'Keep running in the background when closed',
  autoUpdate: 'Update automatically',
  checkUpdates: 'Check for updates…',
  connectAgents: 'Connect your AI agents',
  reportIssue: 'Report a problem',
  engineStopped: 'The Dreamward engine stopped unexpectedly. Your data is safe.',
  engineFailed: 'Dreamward could not start. Your data has not been changed.',
  newerData: 'Your book was last opened with a newer version of Dreamward.',
  newerDataDetail:
    'To protect your data this version will not open it. Install the latest version of Dreamward, or restore a backup from the backups folder (pre-upgrade).',
  secretsUnreadable: 'Dreamward could not unlock its keys from your system keychain.',
  secretsUnreadableDetail:
    'Your book itself is fine. You can quit and try again (for example after unlocking your keychain), or reset the keys — you will then need to sign in to your AI providers again in Settings.',
  resetKeys: 'Reset keys',
  updateReady: 'Dreamward %s is ready to install.',
  updateReadyDetail: 'Your book is backed up before the update, and again automatically before any data upgrade.',
  restartNow: 'Restart now',
  later: 'Later',
  upToDate: 'You have the latest version.',
  updateError: 'Could not check for updates.',
  updateDownloading: 'A new version is downloading. You will be asked to restart when it is ready.',
};

const he: typeof en = {
  file: 'קובץ',
  view: 'תצוגה',
  open: 'פתח את %s',
  quit: 'יציאה',
  restart: 'הפעלה מחדש',
  openLogs: 'פתח יומני מערכת',
  backupNow: 'גבה עכשיו',
  backupDone: 'הגיבוי הושלם.',
  backupFailed: 'הגיבוי לא הושלם.',
  openDataFolder: 'פתח את תיקיית הנתונים',
  openBackupsFolder: 'פתח את תיקיית הגיבויים',
  startAtLogin: 'הפעל עם הכניסה למחשב',
  keepRunning: 'המשך לפעול ברקע כשהחלון נסגר',
  autoUpdate: 'עדכן אוטומטית',
  checkUpdates: 'בדוק עדכונים…',
  connectAgents: 'חיבור סוכני AI',
  reportIssue: 'דווח על בעיה',
  engineStopped: 'המנוע של Dreamward נעצר באופן לא צפוי. הנתונים שלך בטוחים.',
  engineFailed: 'Dreamward לא הצליח לעלות. הנתונים שלך לא שונו.',
  newerData: 'הספר שלך נפתח לאחרונה בגרסה חדשה יותר של Dreamward.',
  newerDataDetail: 'כדי להגן על הנתונים, גרסה זו לא תפתח אותו. התקינו את הגרסה העדכנית, או שחזרו גיבוי מתיקיית הגיבויים (pre-upgrade).',
  secretsUnreadable: 'Dreamward לא הצליח לפתוח את המפתחות שלו ממחזיק המפתחות של המערכת.',
  secretsUnreadableDetail:
    'הספר עצמו תקין. אפשר לצאת ולנסות שוב (למשל אחרי שחרור מחזיק המפתחות), או לאפס את המפתחות — ואז יהיה צורך להתחבר מחדש לספקי ה-AI בהגדרות.',
  resetKeys: 'אפס מפתחות',
  updateReady: 'Dreamward %s מוכן להתקנה.',
  updateReadyDetail: 'הספר שלך מגובה לפני העדכון, ושוב אוטומטית לפני כל שדרוג נתונים.',
  restartNow: 'הפעל מחדש עכשיו',
  later: 'אחר כך',
  upToDate: 'יש לך את הגרסה העדכנית.',
  updateError: 'לא ניתן לבדוק עדכונים.',
  updateDownloading: 'גרסה חדשה בהורדה. תתבקשו להפעיל מחדש כשהיא תהיה מוכנה.',
};

export function t(key: keyof typeof en, arg?: string): string {
  const table = app.getLocale().toLowerCase().startsWith('he') ? he : en;
  return arg === undefined ? table[key] : table[key].replace('%s', arg);
}
