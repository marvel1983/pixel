import { useEffect, useState, useCallback } from "react";
import { Plus, GripVertical, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/stores/auth-store";
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface Banner {
  id: number; title: string; subtitle: string | null; imageUrl: string | null;
  linkUrl: string | null; position: string; backgroundColor: string | null;
  textColor: string | null; ctaText: string | null; ctaColor: string | null;
  sortOrder: number; isActive: boolean; startsAt: string | null; expiresAt: string | null;
}

type FormData = Omit<Banner, "id" | "sortOrder"> & { sortOrder: string };

const emptyForm: FormData = {
  title: "", subtitle: "", imageUrl: "", linkUrl: "", position: "HOMEPAGE_HERO",
  backgroundColor: "#1e40af", textColor: "#ffffff", ctaText: "Shop Now",
  ctaColor: "#f59e0b", sortOrder: "0", isActive: true, startsAt: null, expiresAt: null,
};

export default function AdminBannersPage() {
  const [rows, setRows] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const token = useAuthStore((s) => s.token);

  const api = useCallback(async (path: string, opts?: RequestInit) => {
    const r = await fetch(`${API}${path}`, { ...opts, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...opts?.headers } });
    if (!r.ok) { const e = await r.json().catch(() => ({ error: "Failed" })); alert(e.error); return null; }
    return r.json();
  }, [token]);

  const load = useCallback(() => {
    setLoading(true);
    api("/admin/banners").then((d) => { if (d) setRows(d.banners); }).finally(() => setLoading(false));
  }, [api]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditId(null); setForm(emptyForm); setModal(true); };
  const openEdit = (b: Banner) => {
    setEditId(b.id);
    setForm({ ...b, sortOrder: String(b.sortOrder) });
    setModal(true);
  };

  const save = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    const body = { ...form, sortOrder: Number(form.sortOrder) || 0 };
    const url = editId ? `/admin/banners/${editId}` : "/admin/banners";
    const method = editId ? "PUT" : "POST";
    const r = await api(url, { method, body: JSON.stringify(body) });
    setSaving(false);
    if (r) { setModal(false); load(); }
  };

  const toggle = async (id: number) => { const r = await api(`/admin/banners/${id}/toggle`, { method: "PATCH" }); if (r) load(); };
  const del = async (id: number) => { if (!confirm("Delete this banner?")) return; const r = await api(`/admin/banners/${id}`, { method: "DELETE" }); if (r) load(); };

  const handleDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = rows.findIndex((r) => r.id === active.id);
    const newIdx = rows.findIndex((r) => r.id === over.id);
    const reordered = arrayMove(rows, oldIdx, newIdx).map((r, i) => ({ ...r, sortOrder: i }));
    setRows(reordered);
    await api("/admin/banners/reorder", { method: "POST", body: JSON.stringify({ ids: reordered.map((r) => r.id) }) });
  };

  const set = (key: keyof FormData, val: unknown) => setForm((p) => ({ ...p, [key]: val }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Banners</h1>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Add Banner</Button>
      </div>

      {loading ? <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div> : rows.length === 0 ? (
        <div className="rounded-lg border bg-white p-12 text-center text-muted-foreground">No banners yet. Click "Add Banner" to create one.</div>
      ) : (
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">{rows.map((b) => <SortableRow key={b.id} banner={b} onEdit={openEdit} onToggle={toggle} onDelete={del} />)}</div>
          </SortableContext>
        </DndContext>
      )}

      {modal && <BannerModal form={form} set={set} editId={editId} saving={saving} onSave={save} onClose={() => setModal(false)} />}
    </div>
  );
}

function SortableRow({ banner: b, onEdit, onToggle, onDelete }: { banner: Banner; onEdit: (b: Banner) => void; onToggle: (id: number) => void; onDelete: (id: number) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: b.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 rounded-lg border bg-white p-3 shadow-sm">
      <button {...attributes} {...listeners} className="cursor-grab p-1 text-muted-foreground hover:text-foreground"><GripVertical className="h-4 w-4" /></button>
      <div className="h-12 w-20 rounded border overflow-hidden flex-shrink-0" style={{ backgroundColor: b.backgroundColor ?? "#ddd" }}>
        {b.imageUrl ? <img src={b.imageUrl} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full flex items-center justify-center text-[10px] text-white/60">No image</div>}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{b.title}</p>
        {b.subtitle && <p className="text-xs text-muted-foreground truncate">{b.subtitle}</p>}
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="secondary" className="text-[10px]">{b.position}</Badge>
          <span className="text-[10px] text-muted-foreground">#{b.sortOrder}</span>
        </div>
      </div>
      <button onClick={() => onToggle(b.id)} className={`rounded-full px-2 py-0.5 text-xs font-medium ${b.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{b.isActive ? "Active" : "Inactive"}</button>
      <button className="p-1.5 hover:bg-gray-100 rounded" onClick={() => onEdit(b)}><Pencil className="h-4 w-4" /></button>
      <button className="p-1.5 hover:bg-red-50 rounded text-red-500" onClick={() => onDelete(b.id)}><Trash2 className="h-4 w-4" /></button>
    </div>
  );
}

function BannerModal({ form, set, editId, saving, onSave, onClose }: { form: FormData; set: (k: keyof FormData, v: unknown) => void; editId: number | null; saving: boolean; onSave: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{editId ? "Edit Banner" : "Add Banner"}</h2>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <Field label="Title *"><input className="w-full rounded-md border px-3 py-2 text-sm" value={form.title} onChange={(e) => set("title", e.target.value)} /></Field>
            <Field label="Subtitle"><input className="w-full rounded-md border px-3 py-2 text-sm" value={form.subtitle ?? ""} onChange={(e) => set("subtitle", e.target.value)} /></Field>
            <Field label="Image URL"><input className="w-full rounded-md border px-3 py-2 text-sm" value={form.imageUrl ?? ""} onChange={(e) => set("imageUrl", e.target.value)} placeholder="https://..." /></Field>
            <Field label="Link URL"><input className="w-full rounded-md border px-3 py-2 text-sm" value={form.linkUrl ?? ""} onChange={(e) => set("linkUrl", e.target.value)} placeholder="/products/..." /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="CTA Text"><input className="w-full rounded-md border px-3 py-2 text-sm" value={form.ctaText ?? ""} onChange={(e) => set("ctaText", e.target.value)} /></Field>
              <Field label="CTA Color"><div className="flex gap-2"><input type="color" className="h-9 w-10 rounded border" value={form.ctaColor ?? "#f59e0b"} onChange={(e) => set("ctaColor", e.target.value)} /><input className="flex-1 rounded-md border px-3 py-2 text-sm font-mono" value={form.ctaColor ?? ""} onChange={(e) => set("ctaColor", e.target.value)} /></div></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="BG Color"><div className="flex gap-2"><input type="color" className="h-9 w-10 rounded border" value={form.backgroundColor ?? "#1e40af"} onChange={(e) => set("backgroundColor", e.target.value)} /><input className="flex-1 rounded-md border px-3 py-2 text-sm font-mono" value={form.backgroundColor ?? ""} onChange={(e) => set("backgroundColor", e.target.value)} /></div></Field>
              <Field label="Text Color"><div className="flex gap-2"><input type="color" className="h-9 w-10 rounded border" value={form.textColor ?? "#ffffff"} onChange={(e) => set("textColor", e.target.value)} /><input className="flex-1 rounded-md border px-3 py-2 text-sm font-mono" value={form.textColor ?? ""} onChange={(e) => set("textColor", e.target.value)} /></div></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Position"><select className="w-full rounded-md border px-3 py-2 text-sm" value={form.position} onChange={(e) => set("position", e.target.value)}><option value="HOMEPAGE_HERO">Homepage Hero</option><option value="TOP">Top Bar</option><option value="HOMEPAGE_MIDDLE">Homepage Middle</option><option value="SIDEBAR">Sidebar</option><option value="CATEGORY_TOP">Category Top</option></select></Field>
              <Field label="Sort Order"><input type="number" className="w-full rounded-md border px-3 py-2 text-sm" value={form.sortOrder} onChange={(e) => set("sortOrder", e.target.value)} /></Field>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isActive} onChange={(e) => set("isActive", e.target.checked)} /> Active</label>
          </div>
          <div className="space-y-3">
            <p className="text-sm font-medium">Live Preview</p>
            <div className="rounded-lg overflow-hidden border shadow-sm" style={{ backgroundColor: form.backgroundColor || "#1e40af", color: form.textColor || "#fff" }}>
              {form.imageUrl ? (
                <div className="relative h-48">
                  <img src={form.imageUrl} alt="" className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-black/30 flex flex-col items-center justify-center p-4 text-center">
                    <h3 className="text-xl font-bold mb-1" style={{ color: form.textColor || "#fff" }}>{form.title || "Banner Title"}</h3>
                    {form.subtitle && <p className="text-sm opacity-90">{form.subtitle}</p>}
                    {form.ctaText && <span className="mt-3 inline-block rounded-md px-4 py-1.5 text-sm font-semibold" style={{ backgroundColor: form.ctaColor || "#f59e0b", color: "#fff" }}>{form.ctaText}</span>}
                  </div>
                </div>
              ) : (
                <div className="h-48 flex flex-col items-center justify-center p-4 text-center">
                  <h3 className="text-xl font-bold mb-1">{form.title || "Banner Title"}</h3>
                  {form.subtitle && <p className="text-sm opacity-90">{form.subtitle}</p>}
                  {form.ctaText && <span className="mt-3 inline-block rounded-md px-4 py-1.5 text-sm font-semibold" style={{ backgroundColor: form.ctaColor || "#f59e0b", color: "#fff" }}>{form.ctaText}</span>}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={onSave} disabled={saving || !form.title.trim()}>{saving ? "Saving..." : editId ? "Update Banner" : "Create Banner"}</Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-sm font-medium mb-1">{label}</label>{children}</div>;
}
