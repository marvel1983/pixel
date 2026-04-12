import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { GripVertical, Plus, Pencil, Trash2, Eye, ChevronRight } from "lucide-react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useAuthStore } from "@/stores/auth-store";

const API = import.meta.env.VITE_API_URL ?? "/api";

const inputCls = "w-full rounded border border-[#2e3340] bg-[#0f1117] px-3 py-2 text-[13px] text-[#dde4f0] placeholder:text-[#3d5070] focus:border-sky-500/60 focus:outline-none focus:ring-1 focus:ring-sky-500/30";
const labelCls = "block text-[11.5px] font-medium text-[#8fa0bb] mb-1";

interface Brand {
  id: number; name: string; slug: string; bannerImage: string | null;
  bgColor: string; title: string | null; description: string | null;
  marketingPoints: string[]; productIds: number[];
  isEnabled: boolean; sortOrder: number;
}

function SortableBrand({ brand, onEdit, onDelete, onToggle }: { brand: Brand; onEdit: (b: Brand) => void; onDelete: (id: number) => void; onToggle: (b: Brand) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: brand.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 rounded-lg border border-[#2e3340] bg-[#181c24] p-3">
      <button {...attributes} {...listeners} className="cursor-grab text-[#5a6a84] hover:text-[#dde4f0]"><GripVertical className="h-5 w-5" /></button>
      <div className={`w-10 h-10 rounded-lg ${brand.bgColor} flex items-center justify-center text-white text-xs font-bold shrink-0`}>{brand.name.substring(0, 2).toUpperCase()}</div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-[#dde4f0]">{brand.name}</p>
        <p className="text-xs text-[#5a6a84]">{brand.productIds.length} products</p>
      </div>
      <Badge variant="secondary" className={brand.isEnabled ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>{brand.isEnabled ? "Active" : "Disabled"}</Badge>
      <Switch checked={brand.isEnabled} onCheckedChange={() => onToggle(brand)} />
      <Button variant="ghost" size="icon" onClick={() => onEdit(brand)}><Pencil className="h-4 w-4" /></Button>
      <Button variant="ghost" size="icon" onClick={() => onDelete(brand.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
    </div>
  );
}

const BG_COLORS = ["bg-blue-600", "bg-green-600", "bg-purple-600", "bg-red-600", "bg-orange-600", "bg-indigo-600", "bg-teal-600", "bg-pink-600"];

export default function BrandSectionsPage() {
  const token = useAuthStore((s) => s.token);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [editing, setEditing] = useState<Brand | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [preview, setPreview] = useState<Brand | null>(null);
  const [form, setForm] = useState({ name: "", slug: "", bannerImage: "", bgColor: "bg-blue-600", title: "", description: "", marketingPoints: "", productIds: "" });
  const [saving, setSaving] = useState(false);
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const fetchBrands = useCallback(() => {
    fetch(`${API}/admin/brand-sections`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json()).then((d) => setBrands(d.brands)).catch(() => {});
  }, [token]);

  useEffect(() => { fetchBrands(); }, [fetchBrands]);

  const handleDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = brands.findIndex((b) => b.id === active.id);
    const newIdx = brands.findIndex((b) => b.id === over.id);
    const reordered = arrayMove(brands, oldIdx, newIdx);
    setBrands(reordered);
    await fetch(`${API}/admin/brand-sections/reorder`, { method: "PUT", headers, body: JSON.stringify({ order: reordered.map((b) => b.id) }) });
  };

  const toggleBrand = async (b: Brand) => {
    await fetch(`${API}/admin/brand-sections/${b.id}`, { method: "PUT", headers, body: JSON.stringify({ isEnabled: !b.isEnabled }) });
    fetchBrands();
  };

  const openNew = () => {
    setIsNew(true); setEditing(null);
    setForm({ name: "", slug: "", bannerImage: "", bgColor: "bg-blue-600", title: "", description: "", marketingPoints: "", productIds: "" });
  };

  const openEdit = (b: Brand) => {
    setIsNew(false); setEditing(b);
    setForm({ name: b.name, slug: b.slug, bannerImage: b.bannerImage ?? "", bgColor: b.bgColor, title: b.title ?? "", description: b.description ?? "", marketingPoints: b.marketingPoints.join("\n"), productIds: b.productIds.join(", ") });
  };

  const saveForm = async () => {
    setSaving(true);
    const body = {
      name: form.name, slug: form.slug || form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      bannerImage: form.bannerImage || null, bgColor: form.bgColor, title: form.title || null,
      description: form.description || null,
      marketingPoints: form.marketingPoints.split("\n").filter((l) => l.trim()),
      productIds: form.productIds.split(",").map((s) => parseInt(s.trim())).filter((n) => !isNaN(n)),
    };
    if (isNew) {
      await fetch(`${API}/admin/brand-sections`, { method: "POST", headers, body: JSON.stringify(body) });
    } else if (editing) {
      await fetch(`${API}/admin/brand-sections/${editing.id}`, { method: "PUT", headers, body: JSON.stringify(body) });
    }
    setSaving(false); setEditing(null); setIsNew(false); fetchBrands();
  };

  const deleteBrand = async (id: number) => {
    if (!confirm("Delete this brand section?")) return;
    await fetch(`${API}/admin/brand-sections/${id}`, { method: "DELETE", headers });
    fetchBrands();
  };

  const showModal = isNew || !!editing;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Brand Sections</h1>
          <p className="text-sm text-[#5a6a84]">Manage branded product carousels for the homepage</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 rounded border border-sky-500 bg-sky-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-sky-500 disabled:opacity-50 transition-colors"
        >
          <Plus className="h-4 w-4" />Add Brand
        </button>
      </div>
      <DarkCard title={`Brands (${brands.length})`}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={brands.map((b) => b.id)} strategy={verticalListSortingStrategy}>
            {brands.map((b) => <SortableBrand key={b.id} brand={b} onEdit={openEdit} onDelete={deleteBrand} onToggle={toggleBrand} />)}
          </SortableContext>
        </DndContext>
        {brands.length === 0 && <p className="text-center py-8 text-[#5a6a84]">No brand sections yet. Add one to get started.</p>}
      </DarkCard>
      {preview && (
        <DarkCard title="Preview">
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
            <div className={`${preview.bgColor} rounded-lg p-6 flex flex-col justify-center text-white min-h-[160px]`}>
              <h3 className="text-xl font-bold mb-2">{preview.name}</h3>
              <p className="text-white/80 text-sm mb-4">{preview.description || preview.title || "Explore our collection"}</p>
              <Button variant="outline" className="border-white text-white hover:bg-white/20 w-fit text-sm">Shop {preview.name}<ChevronRight className="h-4 w-4 ml-1" /></Button>
            </div>
            <div className="flex gap-3 overflow-hidden">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="min-w-[160px] rounded-lg border border-[#2e3340] bg-[#0f1117] p-4 text-center">
                  <div className="w-full h-20 bg-[#1e2128] rounded mb-2" />
                  <p className="text-xs text-[#5a6a84]">Product {i}</p>
                </div>
              ))}
            </div>
          </div>
        </DarkCard>
      )}
      <Dialog open={showModal} onOpenChange={() => { setEditing(null); setIsNew(false); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{isNew ? "Add Brand Section" : "Edit Brand Section"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Name</label><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><label className={labelCls}>Slug</label><input className={inputCls} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="auto-generated" /></div>
            </div>
            <div><label className={labelCls}>Banner Image URL</label><input className={inputCls} value={form.bannerImage} onChange={(e) => setForm({ ...form, bannerImage: e.target.value })} placeholder="https://..." /></div>
            <div>
              <label className={labelCls}>Background Color</label>
              <div className="flex gap-2 mt-1">
                {BG_COLORS.map((c) => (
                  <button key={c} className={`w-8 h-8 rounded-lg ${c} ${form.bgColor === c ? "ring-2 ring-offset-2 ring-sky-500" : ""}`} onClick={() => setForm({ ...form, bgColor: c })} />
                ))}
              </div>
            </div>
            <div><label className={labelCls}>Title</label><input className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><label className={labelCls}>Description</label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="mt-1" /></div>
            <div><label className={labelCls}>Marketing Points (one per line)</label><Textarea value={form.marketingPoints} onChange={(e) => setForm({ ...form, marketingPoints: e.target.value })} rows={3} className="mt-1" placeholder={"Official partner\nBest prices\nInstant delivery"} /></div>
            <div><label className={labelCls}>Product IDs (comma-separated)</label><input className={inputCls} value={form.productIds} onChange={(e) => setForm({ ...form, productIds: e.target.value })} placeholder="1, 2, 3" /></div>
            <Button variant="outline" className="w-full" onClick={() => setPreview({ id: 0, name: form.name, slug: form.slug, bannerImage: form.bannerImage || null, bgColor: form.bgColor, title: form.title || null, description: form.description || null, marketingPoints: form.marketingPoints.split("\n").filter(Boolean), productIds: [], isEnabled: true, sortOrder: 0 })}><Eye className="mr-2 h-4 w-4" />Preview</Button>
          </div>
          <DialogFooter>
            <button
              onClick={saveForm}
              disabled={!form.name || saving}
              className="flex items-center gap-2 rounded border border-sky-500 bg-sky-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-sky-500 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving..." : isNew ? "Create Brand" : "Save Changes"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DarkCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[#2e3340] bg-[#181c24]" style={{boxShadow:"0 2px 8px rgba(0,0,0,0.35)"}}>
      <div className="border-b border-[#2a2e3a] px-4 py-3 bg-[#1e2128]">
        <p className="card-title text-[13px] font-bold uppercase tracking-widest">{title}</p>
        {description && <p className="mt-0.5 text-[11px] text-[#5a6a84]">{description}</p>}
      </div>
      <div className="px-4 py-4 space-y-4">{children}</div>
    </div>
  );
}
