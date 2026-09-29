import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Youtube from '@tiptap/extension-youtube';
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
      StarterKit,
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } }),
      Image.configure({ inline: false, HTMLAttributes: { class: 'rounded-md' } }),
      Youtube.configure({ nocookie: true, controls: true, width: 480, height: 270 }),
    ],
    content: value || '<p></p>',
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
      editor.commands.setContent(value, false);
    }
  }, [value, editor]);

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-surface px-4 py-3 transition-colors focus-within:border-primary">
      {editor && !minimal && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}
