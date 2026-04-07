import { useEffect, useState, useCallback } from "react";
import { ArrowLeft, Save, Plus, Trash2, GripVertical } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface FaqItem { id: string; question: string; answer: string; categoryLabel: string; isActive: boolean; }

let nextId = 1;
const makeId = () => `faq-${nextId++}`;

export default function FaqEditorPage() {
  const [items, setItems] = useState<FaqItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [, navigate] = useLocation();
  const token = useAuthStore((s) => s.token);

  const api = useCallback(async (path: string, opts?: RequestInit) => {
    const r = await fetch(`${API}${path}`, { ...opts, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...opts?.headers } });
    if (!r.ok) { const e = await r.json().catch(() => ({ error: "Failed" })); alert(e.error); return null; }
    return r.json();
  }, [token]);

  useEffect(() => {
    api("/admin/faqs").then((d) => {
      if (d) setItems(d.faqs.map((f: Record<string, unknown>) => ({ id: makeId(), question: f.question, answer: f.answer, categoryLabel: f.categoryLabel ?? "", isActive: f.isActive })));
    });
  }, [api]);

  const addItem = () => setItems((prev) => [...prev, { id: makeId(), question: "", answer: "", categoryLabel: "", isActive: true }]);
  const remove = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));
  const update = (id: string, field: keyof FaqItem, value: string | boolean) => setItems((prev) => prev.map((i) => i.id === id ? { ...i, [field]: value } : i));

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const oldIdx = prev.findIndex((i) => i.id === active.id);
      const newIdx = prev.findIndex((i) => i.id === over.id);
      return arrayMove(prev, oldIdx, newIdx);
    });
  };

  const save = async () => {
    setSaving(true);
    const faqs = items.filter((i) => i.question.trim() && i.answer.trim()).map((i) => ({
      question: i.question, answer: i.answer, categoryLabel: i.categoryLabel || null, isActive: i.isActive,
    }));
    await api("/admin/faqs/bulk", { method: "PUT", body: JSON.stringify({ faqs }) });
    setSaving(false);
    alert("FAQs saved!");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/admin/pages")}><ArrowLeft className="h-5 w-5" /></button>
          <h1 className="text-2xl font-bold">FAQ Editor</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={addItem}><Plus className="h-4 w-4 mr-1" /> Add Q&A</Button>
          <Button onClick={save} disabled={saving}><Save className="h-4 w-4 mr-1" /> {saving ? "Saving..." : "Save All"}</Button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border bg-white p-12 text-center text-muted-foreground">No FAQ items. Click "Add Q&A" to start.</div>
      ) : (
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">{items.map((item) => <SortableFaq key={item.id} item={item} onUpdate={update} onRemove={remove} />)}</div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

function SortableFaq({ item, onUpdate, onRemove }: { item: FaqItem; onUpdate: (id: string, f: keyof FaqItem, v: string | boolean) => void; onRemove: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <button {...attributes} {...listeners} className="cursor-grab p-1 mt-2 text-muted-foreground"><GripVertical className="h-4 w-4" /></button>
        <div className="flex-1 space-y-2">
          <input className="w-full rounded-md border px-3 py-2 text-sm font-medium" placeholder="Question" value={item.question} onChange={(e) => onUpdate(item.id, "question", e.target.value)} />
          <textarea className="w-full rounded-md border px-3 py-2 text-sm min-h-[80px] resize-y" placeholder="Answer" value={item.answer} onChange={(e) => onUpdate(item.id, "answer", e.target.value)} />
          <div className="flex items-center gap-3">
            <input className="rounded-md border px-3 py-1.5 text-xs w-40" placeholder="Category (optional)" value={item.categoryLabel} onChange={(e) => onUpdate(item.id, "categoryLabel", e.target.value)} />
            <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={item.isActive} onChange={(e) => onUpdate(item.id, "isActive", e.target.checked)} /> Active</label>
          </div>
        </div>
        <button onClick={() => onRemove(item.id)} className="p-1.5 hover:bg-red-50 rounded text-red-500 mt-2"><Trash2 className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
