import { useEffect, useState, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { ArrowLeft, Save, Code, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import ImageExt from "@tiptap/extension-image";
import Underline from "@tiptap/extension-underline";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface PageData {
  id: number; title: string; slug: string; content: string | null;
  metaTitle: string | null; metaDescription: string | null;
  isPublished: boolean; sortOrder: number;
}

export default function PageEditPage() {
  const [, params] = useRoute("/admin/pages/:id");
  const [, navigate] = useLocation();
  const token = useAuthStore((s) => s.token);
  const [page, setPage] = useState<PageData | null>(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDesc, setMetaDesc] = useState("");
  const [published, setPublished] = useState(true);
  const [sortOrder, setSortOrder] = useState("0");
  const [saving, setSaving] = useState(false);
  const [sourceMode, setSourceMode] = useState(false);
  const [html, setHtml] = useState("");
  const isNew = params?.id === "new";

  const editor = useEditor({
    extensions: [
      StarterKit, Underline,
      Link.configure({ openOnClick: false }),
      ImageExt.configure({ inline: false }),
      Table.configure({ resizable: true }),
      TableRow, TableCell, TableHeader,
    ],
    content: "",
    editorProps: { attributes: { class: "prose prose-sm max-w-none min-h-[300px] p-4 focus:outline-none" } },
  });

  const api = useCallback(async (path: string, opts?: RequestInit) => {
    const r = await fetch(`${API}${path}`, { ...opts, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...opts?.headers } });
    if (!r.ok) { const e = await r.json().catch(() => ({ error: "Failed" })); alert(e.error); return null; }
    return r.json();
  }, [token]);

  useEffect(() => {
    if (isNew || !params?.id) return;
    api(`/admin/pages/${params.id}`).then((d) => {
      if (!d) return;
      const p = d.page;
      setPage(p); setTitle(p.title); setSlug(p.slug);
      setMetaTitle(p.metaTitle ?? ""); setMetaDesc(p.metaDescription ?? "");
      setPublished(p.isPublished); setSortOrder(String(p.sortOrder));
      setHtml(p.content ?? ""); editor?.commands.setContent(p.content ?? "");
    });
  }, [params?.id, isNew, api, editor]);

  const save = async () => {
    if (!title.trim()) return;
    setSaving(true);
    const content = sourceMode ? html : (editor?.getHTML() ?? "");
    const body = { title: title.trim(), slug: slug.trim(), content, metaTitle, metaDescription: metaDesc, isPublished: published, sortOrder: Number(sortOrder) || 0 };
    const r = await api(isNew ? "/admin/pages" : `/admin/pages/${params?.id}`, { method: isNew ? "POST" : "PUT", body: JSON.stringify(body) });
    setSaving(false);
    if (r) navigate("/admin/pages");
  };

  const toggleSource = () => {
    if (sourceMode) { editor?.commands.setContent(html); setSourceMode(false); }
    else { setHtml(editor?.getHTML() ?? ""); setSourceMode(true); }
  };

  const addLink = () => { const url = prompt("Enter URL:"); if (url) editor?.chain().focus().setLink({ href: url }).run(); };
  const addImage = () => { const url = prompt("Enter image URL:"); if (url) editor?.chain().focus().setImage({ src: url }).run(); };
  const addTable = () => { editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/admin/pages")}><ArrowLeft className="h-5 w-5" /></button>
          <h1 className="text-2xl font-bold">{isNew ? "New Page" : `Edit: ${page?.title ?? ""}`}</h1>
        </div>
        <Button onClick={save} disabled={saving || !title.trim()}><Save className="h-4 w-4 mr-1" /> {saving ? "Saving..." : "Save"}</Button>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 space-y-4">
          <div className="rounded-lg border bg-white p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium mb-1">Title *</label>
                <input className="w-full rounded-md border px-3 py-2 text-sm" value={title} onChange={(e) => { setTitle(e.target.value); if (isNew) setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "")); }} /></div>
              <div><label className="block text-sm font-medium mb-1">Slug</label>
                <input className="w-full rounded-md border px-3 py-2 text-sm font-mono" value={slug} onChange={(e) => setSlug(e.target.value)} /></div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium">Content</label>
                <button onClick={toggleSource} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">{sourceMode ? <><Eye className="h-3 w-3" /> Visual</> : <><Code className="h-3 w-3" /> Source</>}</button>
              </div>
              {sourceMode ? (
                <textarea className="w-full rounded-md border px-3 py-2 text-sm font-mono min-h-[300px]" value={html} onChange={(e) => setHtml(e.target.value)} />
              ) : (
                <div className="rounded-md border">
                  <Toolbar editor={editor} onAddLink={addLink} onAddImage={addImage} onAddTable={addTable} />
                  <EditorContent editor={editor} />
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-lg border bg-white p-4 space-y-3">
            <h3 className="font-medium text-sm">Settings</h3>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} /> Published</label>
            <div><label className="block text-xs font-medium mb-1">Sort Order</label>
              <input type="number" className="w-full rounded-md border px-3 py-2 text-sm" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} /></div>
          </div>
          <div className="rounded-lg border bg-white p-4 space-y-3">
            <h3 className="font-medium text-sm">SEO</h3>
            <div><label className="block text-xs font-medium mb-1">Meta Title <span className="text-muted-foreground">({metaTitle.length}/60)</span></label>
              <input className="w-full rounded-md border px-3 py-2 text-sm" value={metaTitle} onChange={(e) => setMetaTitle(e.target.value.slice(0, 60))} maxLength={60} /></div>
            <div><label className="block text-xs font-medium mb-1">Meta Description <span className="text-muted-foreground">({metaDesc.length}/160)</span></label>
              <textarea className="w-full rounded-md border px-3 py-2 text-sm h-20 resize-none" value={metaDesc} onChange={(e) => setMetaDesc(e.target.value.slice(0, 160))} maxLength={160} /></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Toolbar({ editor, onAddLink, onAddImage, onAddTable }: { editor: ReturnType<typeof useEditor>; onAddLink: () => void; onAddImage: () => void; onAddTable: () => void }) {
  if (!editor) return null;
  const b = (active: boolean) => `p-1.5 rounded text-xs ${active ? "bg-blue-100 text-blue-700" : "hover:bg-gray-100"}`;
  return (
    <div className="flex flex-wrap gap-0.5 border-b px-2 py-1.5 bg-gray-50">
      <button className={b(editor.isActive("bold"))} onClick={() => editor.chain().focus().toggleBold().run()}>B</button>
      <button className={b(editor.isActive("italic"))} onClick={() => editor.chain().focus().toggleItalic().run()}>I</button>
      <button className={b(editor.isActive("underline"))} onClick={() => editor.chain().focus().toggleUnderline().run()}>U</button>
      <span className="w-px h-6 bg-gray-200 mx-1" />
      <button className={b(editor.isActive("heading", { level: 1 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>H1</button>
      <button className={b(editor.isActive("heading", { level: 2 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button>
      <button className={b(editor.isActive("heading", { level: 3 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</button>
      <span className="w-px h-6 bg-gray-200 mx-1" />
      <button className={b(editor.isActive("bulletList"))} onClick={() => editor.chain().focus().toggleBulletList().run()}>UL</button>
      <button className={b(editor.isActive("orderedList"))} onClick={() => editor.chain().focus().toggleOrderedList().run()}>OL</button>
      <button className={b(editor.isActive("blockquote"))} onClick={() => editor.chain().focus().toggleBlockquote().run()}>BQ</button>
      <span className="w-px h-6 bg-gray-200 mx-1" />
      <button className={b(false)} onClick={onAddLink}>Link</button>
      <button className={b(false)} onClick={onAddImage}>Img</button>
      <button className={b(false)} onClick={onAddTable}>Table</button>
      <span className="w-px h-6 bg-gray-200 mx-1" />
      <button className={b(false)} onClick={() => editor.chain().focus().undo().run()}>Undo</button>
      <button className={b(false)} onClick={() => editor.chain().focus().redo().run()}>Redo</button>
    </div>
  );
}
