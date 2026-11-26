import { useRef } from 'react';
import type { Editor } from '@tiptap/react';
import { NOTE_COLOURS } from '../notes/palette';

interface EditorToolbarProps {
  editor: Editor | null;
  onUploadImage: (file: File) => void;
}

function ToolbarButton({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`editor-toolbar__btn${active ? ' editor-toolbar__btn--active' : ''}`}
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function EditorToolbar({ editor, onUploadImage }: EditorToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!editor) return null;

  const inTable = editor.isActive('table');

  function setCellBackground(colour: string | null) {
    if (editor!.isActive('tableHeader')) {
      editor!.chain().focus().updateAttributes('tableHeader', { backgroundColor: colour }).run();
    } else {
      editor!.chain().focus().updateAttributes('tableCell', { backgroundColor: colour }).run();
    }
  }

  return (
    <div className="editor-toolbar">
      <ToolbarButton
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Bold (Ctrl/Cmd+B)"
      >
        B
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Italic (Ctrl/Cmd+I)"
      >
        I
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive('underline')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        title="Underline (Ctrl/Cmd+U)"
      >
        U
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive('strike')}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        title="Strikethrough"
      >
        S
      </ToolbarButton>

      <span className="editor-toolbar__divider" />

      <ToolbarButton
        active={editor.isActive('heading', { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        title="Heading 1"
      >
        H1
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive('heading', { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        title="Heading 2"
      >
        H2
      </ToolbarButton>

      <span className="editor-toolbar__divider" />

      <ToolbarButton
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        title="Bulleted list"
      >
        •≡
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        title="Numbered list"
      >
        1≡
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive('taskList')}
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        title="Checklist"
      >
        ☑
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive('blockquote')}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        title="Blockquote"
      >
        "
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal rule">
        —
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive('link')}
        onClick={() => {
          const url = window.prompt('Link URL (https://…)');
          if (!url) return;
          editor.chain().focus().setLink({ href: url }).run();
        }}
        title="Insert link"
      >
        🔗
      </ToolbarButton>

      <span className="editor-toolbar__divider" />

      <ToolbarButton
        active={editor.isActive({ textAlign: 'left' })}
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        title="Align left"
      >
        ⟸
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive({ textAlign: 'center' })}
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        title="Align center"
      >
        ⟷
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive({ textAlign: 'right' })}
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        title="Align right"
      >
        ⟹
      </ToolbarButton>

      <span className="editor-toolbar__divider" />

      <ToolbarButton onClick={() => fileInputRef.current?.click()} title="Insert image">
        🖼
      </ToolbarButton>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUploadImage(file);
          e.target.value = '';
        }}
      />
      <ToolbarButton
        onClick={() =>
          editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
        }
        title="Insert table"
      >
        ⊞ Table
      </ToolbarButton>

      {inTable && (
        <>
          <span className="editor-toolbar__divider" />
          <ToolbarButton onClick={() => editor.chain().focus().addRowAfter().run()} title="Add row below">
            +Row
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().deleteRow().run()} title="Delete row">
            −Row
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().addColumnAfter().run()} title="Add column">
            +Col
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().deleteColumn().run()} title="Delete column">
            −Col
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeaderRow().run()}
            title="Toggle header row"
          >
            Header
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().deleteTable().run()} title="Delete table">
            ✕Table
          </ToolbarButton>
          <span className="editor-toolbar__swatches">
            {Object.entries(NOTE_COLOURS).map(([name, hex]) => (
              <button
                key={name}
                type="button"
                className="editor-toolbar__swatch"
                style={{ background: hex }}
                title={name}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setCellBackground(hex)}
              />
            ))}
            <button
              type="button"
              className="editor-toolbar__swatch editor-toolbar__swatch--none"
              title="No fill"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setCellBackground(null)}
            >
              ✕
            </button>
          </span>
        </>
      )}
    </div>
  );
}
