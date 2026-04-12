import { Pencil, X, Check, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";

export interface AdminCategory {
  id: number;
  name: string;
  displayName: string | null;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  parentId: number | null;
  sortOrder: number;
  isActive: boolean;
  showInNav: boolean;
  productCount: number;
}

export interface EditState {
  name: string;
  displayName: string;
  slug: string;
  description: string;
  imageUrl: string;
  sortOrder: number;
  isActive: boolean;
  showInNav: boolean;
  parentId: number | null;
}

interface RowProps {
  cat: AdminCategory;
  isEditing: boolean;
  editState: EditState | null;
  allCats: AdminCategory[];
  saving: boolean;
  onStartEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onToggleNav: () => void;
  onDelete: () => void;
  onEditChange: (updates: Partial<EditState>) => void;
}

const INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  borderRadius: 6,
  border: "1.5px solid #3d6499",
  background: "#1e2d47",
  color: "#ffffff",
  padding: "6px 10px",
  fontSize: 13,
  outline: "none",
  transition: "border-color 0.15s, box-shadow 0.15s",
};

const LABEL_STYLE: React.CSSProperties = {
  display: "block",
  marginBottom: 4,
  fontSize: 11,
  fontWeight: 600,
  color: "#c0cce0",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const TD = { padding: "12px 16px" };
const TD_MUTED: React.CSSProperties = { padding: "12px 16px", color: "#d0d8e8" };
const TD_MONO: React.CSSProperties = { padding: "12px 16px", color: "#a8bcd8", fontFamily: "monospace", fontSize: 12 };

export function CategoryRow({ cat, isEditing, editState, allCats, saving, onStartEdit, onCancel, onSave, onToggleNav, onDelete, onEditChange }: RowProps) {
  if (!isEditing) {
    return (
      <tr style={{ borderBottom: "1px solid #1e2a3a" }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#131c2e")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
        <td style={TD}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {cat.imageUrl && <img src={cat.imageUrl} alt="" style={{ height: 32, width: 32, borderRadius: 4, objectFit: "cover" }} />}
            <div>
              <span style={{ fontWeight: 600, color: "#ffffff" }}>{cat.name}</span>
              {cat.name !== (cat.displayName ?? cat.name) && (
                <span style={{ fontSize: 11, color: "#7a8aaa", marginLeft: 4 }}>(source)</span>
              )}
            </div>
          </div>
        </td>
        <td style={TD_MUTED}>{cat.displayName ?? cat.name}</td>
        <td style={TD}>
          <span style={{ background: "#1e3358", color: "#90b8f0", borderRadius: 12, padding: "2px 10px", fontSize: 12, fontWeight: 700 }}>
            {cat.productCount}
          </span>
        </td>
        <td style={TD_MONO}>{cat.slug}</td>
        <td style={TD_MUTED}>{cat.sortOrder}</td>
        <td style={TD}><Switch checked={cat.showInNav} onCheckedChange={onToggleNav} /></td>
        <td style={TD}>
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={onStartEdit}
              style={{ padding: 6, borderRadius: 6, border: "none", background: "transparent", cursor: "pointer", color: "#90b8f0", transition: "all 0.15s" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#1e3358"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}>
              <Pencil size={14} />
            </button>
            <button onClick={onDelete} disabled={cat.productCount > 0}
              title={cat.productCount > 0 ? "Cannot delete: has products" : "Delete"}
              style={{ padding: 6, borderRadius: 6, border: "none", background: "transparent", cursor: cat.productCount > 0 ? "not-allowed" : "pointer", color: "#f87090", opacity: cat.productCount > 0 ? 0.25 : 1, transition: "all 0.15s" }}
              onMouseEnter={(e) => { if (cat.productCount === 0) (e.currentTarget as HTMLButtonElement).style.background = "#2d1515"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}>
              <Trash2 size={14} />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  if (!editState) return null;

  return (
    <>
      <tr style={{ borderBottom: "1px solid #2a3a52", background: "#0e1828" }}>
        <td style={TD}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#ffffff" }}>{cat.name}</span>
        </td>
        <td style={{ padding: "10px 16px" }}>
          <input style={INPUT_STYLE} value={editState.displayName}
            onChange={(e) => onEditChange({ displayName: e.target.value })}
            placeholder="Display name..." />
        </td>
        <td style={TD}>
          <span style={{ background: "#1e3358", color: "#90b8f0", borderRadius: 12, padding: "2px 10px", fontSize: 12, fontWeight: 700 }}>
            {cat.productCount}
          </span>
        </td>
        <td style={{ padding: "10px 16px" }}>
          <input style={{ ...INPUT_STYLE, fontFamily: "monospace" }} value={editState.slug}
            onChange={(e) => onEditChange({ slug: e.target.value })} />
        </td>
        <td style={{ padding: "10px 16px" }}>
          <input type="number" style={{ ...INPUT_STYLE, width: 64 }} value={editState.sortOrder}
            onChange={(e) => onEditChange({ sortOrder: Number(e.target.value) })} />
        </td>
        <td style={TD}>
          <Switch checked={editState.showInNav} onCheckedChange={(v) => onEditChange({ showInNav: v })} />
        </td>
        <td style={TD}>
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={onSave} disabled={saving}
              style={{ padding: 6, borderRadius: 6, border: "none", background: "transparent", cursor: "pointer", color: "#4ade80", transition: "all 0.15s" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#0a2015")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}>
              <Check size={14} />
            </button>
            <button onClick={onCancel}
              style={{ padding: 6, borderRadius: 6, border: "none", background: "transparent", cursor: "pointer", color: "#c0cce0", transition: "all 0.15s" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#1e2a3a")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}>
              <X size={14} />
            </button>
          </div>
        </td>
      </tr>
      <tr style={{ borderBottom: "1px solid #1e2a3a", background: "#0a1220" }}>
        <td colSpan={7} style={{ padding: "12px 16px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            <div>
              <label style={LABEL_STYLE}>Description</label>
              <textarea style={{ ...INPUT_STYLE, resize: "vertical", height: 60 } as React.CSSProperties}
                value={editState.description}
                onChange={(e) => onEditChange({ description: e.target.value })} />
            </div>
            <div>
              <label style={LABEL_STYLE}>Image URL</label>
              <input style={INPUT_STYLE} value={editState.imageUrl}
                onChange={(e) => onEditChange({ imageUrl: e.target.value })}
                placeholder="https://..." />
            </div>
            <div>
              <label style={LABEL_STYLE}>Parent Category</label>
              <select style={{ ...INPUT_STYLE, cursor: "pointer" }} value={editState.parentId ?? ""}
                onChange={(e) => onEditChange({ parentId: e.target.value ? Number(e.target.value) : null })}>
                <option value="">None (top-level)</option>
                {allCats.filter((c) => c.id !== cat.id).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
        </td>
      </tr>
    </>
  );
}
