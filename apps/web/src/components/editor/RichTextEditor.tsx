import { useEditor, EditorContent } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { Image } from '@tiptap/extension-image';
import { Youtube } from '@tiptap/extension-youtube';
import { useEffect } from 'react';
import { Toolbar } from './Toolbar';

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** hide the toolbar (e.g. tiny inline fields) */
  minimal?: boolean;
}

/** TipTap rich text editor with a toolbar (links, images, youtube, emoji).
 *  Direction-aware via dir="auto". Output HTML is sanitized at render time. */
export function RichTextEditor({ value, onChange, minimal }: Props) {
  const editor = useEditor({
    extensions: [
      // TipTap 3's StarterKit includes Link and Underline. Underline stays off:
      // the toolbar has no button for it and saved content never used <u>.
      StarterKit.configure({
        link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } },
        underline: false,
      }),
      Image.configure({ inline: false, HTMLAttributes: { class: 'rounded-md' } }),
      Youtube.configure({ nocookie: true, controls: true, width: 480, height: 270 }),
    ],
    content: value || '<p></p>',
    // The toolbar reads its active states with useEditorState instead.
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: {
        dir: 'auto',
        class: 'dw-prose min-h-28 max-w-none focus:outline-none',
      },
    },
    onUpdate: ({ editor: ed }) => onChange(ed.getHTML()),
  });

  // Keep editor in sync when value changes externally (e.g. after refetch).
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value && value !== current && !editor.isFocused) {
      // emitUpdate: false — syncing from the server must not echo back as an edit.
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-surface px-4 py-3 transition-colors focus-within:border-primary">
      {editor && !minimal && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}
