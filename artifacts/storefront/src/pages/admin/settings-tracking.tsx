import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/auth-store";
import { Loader2, Trash2, ExternalLink, BarChart2, Eye } from "lucide-react";

const API = import.meta.env.VITE_API_URL ?? "/api";

const inputCls = "w-full rounded border border-[#2e3340] bg-[#0f1117] px-3 py-2 text-[13px] text-[#dde4f0] placeholder:text-[#3d5070] focus:border-sky-500/60 focus:outline-none focus:ring-1 focus:ring-sky-500/30";
const labelCls = "block text-[11.5px] font-medium text-[#8fa0bb] mb-1";

interface ProviderMeta {
  type: string;
  label: string;
  color: string;
  placeholder: string;
  idLabel: string;
  hint: string;
  docsUrl: string;
}

const PROVIDERS: ProviderMeta[] = [
  {
    type: "GA4",
    label: "Google Analytics 4",
    color: "#e8710a",
    placeholder: "G-XXXXXXXXXX",
    idLabel: "Measurement ID",
    hint: "Found in Admin → Data Streams → your stream → Measurement ID",
    docsUrl: "https://analytics.google.com",
  },
  {
    type: "GTM",
    label: "Google Tag Manager",
    color: "#4285f4",
    placeholder: "GTM-XXXXXXX",
    idLabel: "Container ID",
    hint: "Found in your GTM workspace header. Manages GA4 + other tags.",
    docsUrl: "https://tagmanager.google.com",
  },
  {
    type: "META_PIXEL",
    label: "Meta Pixel",
    color: "#1877f2",
    placeholder: "1234567890123456",
    idLabel: "Pixel ID",
    hint: "Found in Events Manager → your pixel → Pixel ID",
    docsUrl: "https://business.facebook.com/events_manager",
  },
  {
    type: "TIKTOK",
    label: "TikTok Pixel",
    color: "#010101",
    placeholder: "CXXXXXXXXXXXXXXXXX",
    idLabel: "Pixel ID",
    hint: "Found in TikTok Ads Manager → Assets → Events → Web Events",
    docsUrl: "https://ads.tiktok.com",
  },
  {
    type: "CLARITY",
    label: "Microsoft Clarity",
    color: "#0078d4",
    placeholder: "xxxxxxxxxx",
    idLabel: "Project ID",
    hint: "Found in Clarity dashboard → Settings → Overview → Project ID",
    docsUrl: "https://clarity.microsoft.com",
  },
];

interface ProviderRow {
  type: string;
  trackingId: string;
  isEnabled: boolean;
}

export default function SettingsTrackingTab() {
  const token = useAuthStore((s) => s.token);
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState<Record<string, ProviderRow>>({});
  const [drafts, setDrafts] = useState<Record<string, { trackingId: string; isEnabled: boolean }>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch(`${API}/admin/tracking`, { headers: { Authorization: `Bearer ${token}` }, credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        const map: Record<string, ProviderRow> = {};
        const draftMap: Record<string, { trackingId: string; isEnabled: boolean }> = {};
        for (const row of d.providers ?? []) {
          map[row.type] = row;
          draftMap[row.type] = { trackingId: row.trackingId, isEnabled: row.isEnabled };
        }
        setSaved(map);
        setDrafts(draftMap);
      })
      .finally(() => setLoading(false));
  }, [token]);

  function setDraft(type: string, patch: Partial<{ trackingId: string; isEnabled: boolean }>) {
    setDrafts((d) => ({ ...d, [type]: { ...d[type], ...patch } }));
  }

  async function handleSave(type: string) {
    const draft = drafts[type];
    if (!draft?.trackingId?.trim()) { toast({ title: "Enter a tracking ID first", variant: "destructive" }); return; }
    setSaving((s) => ({ ...s, [type]: true }));
    try {
      const res = await fetch(`${API}/admin/tracking/${type}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
        body: JSON.stringify({ trackingId: draft.trackingId.trim(), isEnabled: draft.isEnabled ?? true }),
      });
      if (!res.ok) throw new Error("Failed");
      setSaved((s) => ({ ...s, [type]: { type, trackingId: draft.trackingId.trim(), isEnabled: draft.isEnabled ?? true } }));
      toast({ title: `${type} saved` });
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    } finally {
      setSaving((s) => ({ ...s, [type]: false }));
    }
  }

  async function handleDelete(type: string) {
    setDeleting((s) => ({ ...s, [type]: true }));
    try {
      await fetch(`${API}/admin/tracking/${type}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      setSaved((s) => { const n = { ...s }; delete n[type]; return n; });
      setDrafts((d) => { const n = { ...d }; delete n[type]; return n; });
      toast({ title: `${type} removed` });
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    } finally {
      setDeleting((s) => ({ ...s, [type]: false }));
    }
  }

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const activeCount = Object.values(saved).filter((r) => r.isEnabled).length;

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="rounded-lg border border-[#2e3340] bg-[#181c24] px-4 py-3 flex items-center gap-3">
        <BarChart2 className="h-5 w-5 text-sky-400 shrink-0" />
        <div>
          <p className="text-[13px] font-semibold text-[#dde4f0]">{activeCount} active provider{activeCount !== 1 ? "s" : ""}</p>
          <p className="text-[11px] text-[#5a6a84]">Scripts load automatically on the storefront. Page view events fire on every route change.</p>
        </div>
      </div>

      {PROVIDERS.map((meta) => {
        const row = saved[meta.type];
        const draft = drafts[meta.type] ?? { trackingId: "", isEnabled: true };
        const isSaving = saving[meta.type];
        const isDeleting = deleting[meta.type];
        const isConfigured = !!row;

        return (
          <div key={meta.type} className="rounded-lg border border-[#2e3340] bg-[#181c24]" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.35)" }}>
            <div className="border-b border-[#2a2e3a] px-4 py-3 bg-[#1e2128] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: meta.color }} />
                <p className="text-[13px] font-bold uppercase tracking-widest text-[#dde4f0]">{meta.label}</p>
                {isConfigured && (
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${draft.isEnabled ? "bg-green-500/15 text-green-400" : "bg-zinc-700 text-zinc-400"}`}>
                    {draft.isEnabled ? "Active" : "Disabled"}
                  </span>
                )}
              </div>
              <a href={meta.docsUrl} target="_blank" rel="noopener noreferrer" className="text-[#5a6a84] hover:text-sky-400 transition-colors">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>

            <div className="px-4 py-4 space-y-4">
              <div>
                <label className={labelCls}>{meta.idLabel}</label>
                <input
                  className={inputCls}
                  value={draft.trackingId}
                  onChange={(e) => setDraft(meta.type, { trackingId: e.target.value })}
                  placeholder={meta.placeholder}
                />
                <p className="mt-1 text-[11px] text-[#5a6a84] flex items-center gap-1">
                  <Eye className="h-3 w-3 shrink-0" /> {meta.hint}
                </p>
              </div>

              {(draft.trackingId || isConfigured) && (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[13px] font-medium text-[#dde4f0]">Enabled</p>
                    <p className="text-[11px] text-[#5a6a84]">Script loads on the storefront when enabled</p>
                  </div>
                  <Switch
                    checked={draft.isEnabled ?? true}
                    onCheckedChange={(v) => setDraft(meta.type, { isEnabled: v })}
                  />
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => handleSave(meta.type)}
                  disabled={isSaving || !draft.trackingId.trim()}
                  className="flex items-center gap-2 rounded border border-sky-500 bg-sky-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-sky-500 disabled:opacity-50 transition-colors"
                >
                  {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isConfigured ? "Update" : "Save"}
                </button>
                {isConfigured && (
                  <button
                    onClick={() => handleDelete(meta.type)}
                    disabled={isDeleting}
                    className="flex items-center gap-2 rounded border border-red-800 bg-red-900/30 px-3 py-2 text-[13px] font-semibold text-red-400 hover:bg-red-900/50 disabled:opacity-50 transition-colors"
                  >
                    {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
