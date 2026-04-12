import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold, Italic, List, ListOrdered, Heading2, Undo, Redo, Code,
} from "lucide-react";

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export function RichTextEditor({ content, onChange, placeholder }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: placeholder ?? "Write content..." }),
    ],
    content,
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
  });

  if (!editor) return null;

  const btn = (active: boolean) => ({
    padding: "4px 6px",
    borderRadius: 4,
    background: active ? "#1e2a4a" : "transparent",
    color: active ? "#60a5fa" : "#8b94a8",
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
  } as React.CSSProperties);

  return (
    <div style={{ border: "1px solid #252836", borderRadius: 6, overflow: "hidden" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 2, borderBottom: "1px solid #252836", background: "#13161e", padding: "6px 8px" }}>
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} style={btn(editor.isActive("bold"))}>
          <Bold size={14} />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} style={btn(editor.isActive("italic"))}>
          <Italic size={14} />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} style={btn(editor.isActive("heading", { level: 2 }))}>
          <Heading2 size={14} />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} style={btn(editor.isActive("bulletList"))}>
          <List size={14} />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} style={btn(editor.isActive("orderedList"))}>
          <ListOrdered size={14} />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleCodeBlock().run()} style={btn(editor.isActive("codeBlock"))}>
          <Code size={14} />
        </button>
        <div style={{ width: 1, background: "#252836", margin: "2px 4px" }} />
        <button type="button" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} style={btn(false)}>
          <Undo size={14} />
        </button>
        <button type="button" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} style={btn(false)}>
          <Redo size={14} />
        </button>
      </div>
      <EditorContent
        editor={editor}
        style={{ background: "#13161e", color: "#c8d0e0", minHeight: 180, padding: "10px 12px", fontSize: 13 }}
        className="[&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[160px] [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-[#4a5568] [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0"
      />
    </div>
  );
}
