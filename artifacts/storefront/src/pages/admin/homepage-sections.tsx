import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { GripVertical, Pencil, Layout, Image, ShoppingBag, Sparkles, Star, Type, Package } from "lucide-react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useAuthStore } from "@/stores/auth-store";

const API = import.meta.env.VITE_API_URL ?? "/api";

const inputCls = "w-full rounded border border-[#2e3340] bg-[#0f1117] px-3 py-2 text-[13px] text-[#dde4f0] placeholder:text-[#3d5070] focus:border-sky-500/60 focus:outline-none focus:ring-1 focus:ring-sky-500/30";
const labelCls = "block text-[11.5px] font-medium text-[#8fa0bb] mb-1";

interface Section { id: number; type: string; title: string | null; isEnabled: boolean; sortOrder: number; config: Record<string, unknown> }

const SECTION_ICONS: Record<string, typeof Layout> = {
  HERO_SLIDER: Image, CATEGORY_ROW: Layout, BRAND_SECTIONS: ShoppingBag,
  NEW_ADDITIONS: Sparkles, PRODUCT_SPOTLIGHT: Star, FEATURED_TEXT_BANNER: Type,
  FEATURED_BUNDLES: Package,
};

const SECTION_LABELS: Record<string, string> = {
  HERO_SLIDER: "Hero Slider", CATEGORY_ROW: "Category Row", BRAND_SECTIONS: "Brand Partners",
  NEW_ADDITIONS: "New Additions", PRODUCT_SPOTLIGHT: "Product Spotlight", FEATURED_TEXT_BANNER: "Featured Text Banner",
  FEATURED_BUNDLES: "Featured Bundles",
};

function SortableItem({ section, onEdit, onToggle }: { section: Section; onEdit: (s: Section) => void; onToggle: (s: Section) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: section.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const Icon = SECTION_ICONS[section.type] ?? Layout;
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 rounded-lg border border-[#2e3340] bg-[#181c24] p-3">
      <button {...attributes} {...listeners} className="cursor-grab text-[#5a6a84] hover:text-[#dde4f0]"><GripVertical className="h-5 w-5" /></button>
      <Icon className="h-5 w-5 text-[#5a6a84] shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-[#dde4f0]">{section.title || SECTION_LABELS[section.type]}</p>
        <Badge variant="secondary" className="text-xs mt-0.5">{section.type}</Badge>
      </div>
      <Switch checked={section.isEnabled} onCheckedChange={() => onToggle(section)} />
      <Button variant="ghost" size="icon" onClick={() => onEdit(section)}><Pencil className="h-4 w-4" /></Button>
    </div>
  );
}

export default function HomepageSectionsPage() {
  const token = useAuthStore((s) => s.token);
  const [sections, setSections] = useState<Section[]>([]);
  const [editing, setEditing] = useState<Section | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editConfig, setEditConfig] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const fetchSections = useCallback(() => {
    fetch(`${API}/admin/homepage-sections`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json()).then((d) => setSections(d.sections)).catch(() => {});
  }, [token]);

  useEffect(() => { fetchSections(); }, [fetchSections]);

  const handleDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = sections.findIndex((s) => s.id === active.id);
    const newIdx = sections.findIndex((s) => s.id === over.id);
    const reordered = arrayMove(sections, oldIdx, newIdx);
    setSections(reordered);
    await fetch(`${API}/admin/homepage-sections/reorder`, { method: "PUT", headers, body: JSON.stringify({ order: reordered.map((s) => s.id) }) });
  };

  const toggleSection = async (s: Section) => {
    await fetch(`${API}/admin/homepage-sections/${s.id}`, { method: "PUT", headers, body: JSON.stringify({ isEnabled: !s.isEnabled }) });
    fetchSections();
  };

  const openEdit = (s: Section) => {
    setEditing(s); setEditTitle(s.title ?? "");
    const cfg = s.config ?? {};
    setEditConfig(Object.fromEntries(Object.entries(cfg).map(([k, v]) => [k, String(v ?? "")])));
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    const config: Record<string, unknown> = {};
    Object.entries(editConfig).forEach(([k, v]) => { config[k] = isNaN(Number(v)) || v === "" ? v : Number(v); });
    await fetch(`${API}/admin/homepage-sections/${editing.id}`, { method: "PUT", headers, body: JSON.stringify({ title: editTitle, config }) });
    setSaving(false); setEditing(null); fetchSections();
  };

  const configFields = (type: string): string[] => {
    switch (type) {
      case "NEW_ADDITIONS": return ["limit"];
      case "FEATURED_TEXT_BANNER": return ["text", "link", "buttonText"];
      case "PRODUCT_SPOTLIGHT": return ["productId", "heading"];
      case "HERO_SLIDER": return ["autoplaySpeed", "maxSlides"];
      case "CATEGORY_ROW": return ["maxCategories"];
      case "FEATURED_BUNDLES": return ["limit"];
      default: return [];
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Homepage Sections</h1>
        <p className="text-sm text-[#5a6a84]">Drag to reorder sections. Toggle visibility with the switch.</p>
      </div>
      <DarkCard title="Section Order">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            {sections.map((s) => <SortableItem key={s.id} section={s} onEdit={openEdit} onToggle={toggleSection} />)}
          </SortableContext>
        </DndContext>
        {sections.length === 0 && <p className="text-center py-8 text-[#5a6a84]">Loading sections...</p>}
      </DarkCard>
      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit {editing ? SECTION_LABELS[editing.type] : ""}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className={labelCls}>Display Title</label>
              <input className={inputCls} value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </div>
            {editing && configFields(editing.type).map((field) => (
              <div key={field}>
                <label className={labelCls + " capitalize"}>{field.replace(/([A-Z])/g, " $1")}</label>
                <input className={inputCls} value={editConfig[field] ?? ""} onChange={(e) => setEditConfig({ ...editConfig, [field]: e.target.value })} />
              </div>
            ))}
          </div>
          <DialogFooter>
            <button
              onClick={saveEdit}
              disabled={saving}
              className="flex items-center gap-2 rounded border border-sky-500 bg-sky-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-sky-500 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving..." : "Save"}
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
