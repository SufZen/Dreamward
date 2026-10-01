import { useState } from 'react';
import { useEditorState, type Editor } from '@tiptap/react';
import {
  Bold,
  Italic,
  Strikethrough,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Link2,
  Image as ImageIcon,
  Youtube as YoutubeIcon,
  Smile,
} from 'lucide-react';
import { cn } from '@dreamward/design-system';
import { useLang } from '@/lib/lang';
import { EmojiPicker } from './EmojiPicker';
import { AssetPickerDialog } from './AssetPickerDialog';

function Btn({ active, onClick, title, children }: { active?: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      // Keep focus and the selection in the editor: a toolbar click must not
      // blur it, or the next keystrokes land on the button.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded text-fg-muted transition-colors hover:bg-surface hover:text-foreground',
        active && 'bg-surface text-primary',
      )}
    >
      {children}
    </button>
  );
}

const Divider = () => <span className="mx-0.5 h-5 w-px bg-border" />;

export function Toolbar({ editor }: { editor: Editor }) {
  const { lang } = useLang();
  const he = lang === 'he';
  const [emoji, setEmoji] = useState(false);
  const [picker, setPicker] = useState(false);
  const [ytOpen, setYtOpen] = useState(false);
  const [ytUrl, setYtUrl] = useState('');
  // Re-render only when a button's active state changes (TipTap 3 no longer
  // re-renders on every transaction).
  const active = useEditorState({
    editor,
    selector: ({ editor: ed }) => ({
      bold: ed.isActive('bold'),
      italic: ed.isActive('italic'),
      strike: ed.isActive('strike'),
      h2: ed.isActive('heading', { level: 2 }),
      h3: ed.isActive('heading', { level: 3 }),
      bulletList: ed.isActive('bulletList'),
      orderedList: ed.isActive('orderedList'),
      blockquote: ed.isActive('blockquote'),
      link: ed.isActive('link'),
    }),
  });

  const setLink = () => {
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt(he ? 'כתובת קישור:' : 'Link URL:', prev ?? 'https://');
    if (url === null) return;
    if (url === '') editor.chain().focus().unsetLink().run();
    else editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const addYoutube = () => {
    const url = ytUrl.trim();
    if (url) editor.chain().focus().setYoutubeVideo({ src: url }).run();
    setYtUrl('');
    setYtOpen(false);
  };

  return (
    <div className="relative flex flex-wrap items-center gap-0.5 border-b border-border pb-2" dir={he ? 'rtl' : 'ltr'}>
      <Btn active={active.bold} onClick={() => editor.chain().focus().toggleBold().run()} title={he ? 'מודגש' : 'Bold'}>
        <Bold size={15} />
      </Btn>
      <Btn active={active.italic} onClick={() => editor.chain().focus().toggleItalic().run()} title={he ? 'נטוי' : 'Italic'}>
        <Italic size={15} />
      </Btn>
      <Btn active={active.strike} onClick={() => editor.chain().focus().toggleStrike().run()} title={he ? 'קו חוצה' : 'Strikethrough'}>
        <Strikethrough size={15} />
      </Btn>
      <Divider />
      <Btn active={active.h2} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title={he ? 'כותרת' : 'Heading'}>
        <Heading2 size={15} />
      </Btn>
      <Btn active={active.h3} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title={he ? 'כותרת משנה' : 'Subheading'}>
        <Heading3 size={15} />
      </Btn>
      <Btn active={active.bulletList} onClick={() => editor.chain().focus().toggleBulletList().run()} title={he ? 'רשימה' : 'Bullet list'}>
        <List size={15} />
      </Btn>
      <Btn active={active.orderedList} onClick={() => editor.chain().focus().toggleOrderedList().run()} title={he ? 'רשימה ממוספרת' : 'Numbered list'}>
        <ListOrdered size={15} />
      </Btn>
      <Btn active={active.blockquote} onClick={() => editor.chain().focus().toggleBlockquote().run()} title={he ? 'ציטוט' : 'Quote'}>
        <Quote size={15} />
      </Btn>
      <Divider />
      <Btn active={active.link} onClick={setLink} title={he ? 'קישור' : 'Link'}>
        <Link2 size={15} />
      </Btn>
      <Btn onClick={() => setPicker(true)} title={he ? 'תמונה' : 'Image'}>
        <ImageIcon size={15} />
      </Btn>
      <Btn active={ytOpen} onClick={() => setYtOpen((v) => !v)} title={he ? 'יוטיוב' : 'YouTube'}>
        <YoutubeIcon size={15} />
      </Btn>
      <Btn active={emoji} onClick={() => setEmoji((v) => !v)} title={he ? 'אימוג׳י' : 'Emoji'}>
        <Smile size={15} />
      </Btn>

      {emoji && (
        <EmojiPicker
          onPick={(ch) => {
            editor.chain().focus().insertContent(ch).run();
            setEmoji(false);
          }}
          onClose={() => setEmoji(false)}
        />
      )}
      {ytOpen && (
        <div className="absolute top-9 z-50 flex gap-1 rounded-md border border-border bg-bg-raised p-2 shadow-rz-3" dir="ltr">
          <input
            autoFocus
            value={ytUrl}
            onChange={(e) => setYtUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addYoutube()}
            placeholder="https://youtube.com/watch?v=…"
            className="w-56 rounded border border-border bg-surface px-2 py-1 text-sm focus:border-primary focus:outline-none"
          />
          <button type="button" onClick={addYoutube} className="rounded bg-primary px-2 text-sm text-[color:var(--rz-accent-fg)]">
            {he ? 'הוסף' : 'Add'}
          </button>
        </div>
      )}
      {picker && (
        <AssetPickerDialog
          onClose={() => setPicker(false)}
          onPick={(a) => {
            editor.chain().focus().setImage({ src: `/media/${a.webPath}`, alt: a.alt ?? '' }).run();
            setPicker(false);
          }}
        />
      )}
    </div>
  );
}
