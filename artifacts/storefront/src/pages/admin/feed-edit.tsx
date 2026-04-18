import { useState, useEffect } from "react";
import { useParams, useLocation, Link } from "wouter";
import { ArrowLeft, Save, Play, Copy, Eye } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { FeedMappingTable, type FieldMapping } from "@/components/admin/feed-mapping-table";
import { FeedFilterBuilder, type FilterGroup } from "@/components/admin/feed-filter-builder";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface FeedMeta { channelPresets: Record<string, { key: string; label: string; required?: boolean }[]>; productAttributes: { key: string; label: string }[]; filterFields: { key: string; label: string }[] }
interface Feed { id: number; name: string; slug: string; channelType: string; format: string; status: string; targetCountry: string; targetLocale: string; refreshInterval: string; includeVariations: boolean; storeUrl: string; fieldMappings: FieldMapping[]; filterRules: FilterGroup; currencyConfig: { baseCurrency: string; targetCurrency: string; exchangeRate: number; taxOffset: number; rateMode: string }; lastGeneratedAt: string | null; lastRowCount: number | null; lastError: string | null; accessToken: string }

type Tab = "settings" | "mappings" | "filters";

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "CHF", "SEK", "NOK", "DKK"];

export default function FeedEditPage() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const isNew = !params.id || params.id === "new";
  const [feed, setFeed] = useState<Partial<Feed>>({ name: "", channelType: "google_shopping", format: "xml", refreshInterval: "daily", includeVariations: false, storeUrl: "", fieldMappings: [], filterRules: { id: "root", type: "group", condition: "AND", rules: [] }, currencyConfig: { baseCurrency: "USD", targetCurrency: "USD", exchangeRate: 1, taxOffset: 0, rateMode: "manual" } });
  const [meta, setMeta] = useState<FeedMeta | null>(null);
  const [tab, setTab] = useState<Tab>("settings");
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState<{ matched: number; total: number; sample: Record<string, unknown>[] } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const token = useAuthStore((s) => s.token);
  const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  useEffect(() => {
    fetch(`${API}/admin/feeds/meta`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()).then(setMeta);
    if (!isNew) {
      fetch(`${API}/admin/feeds/${params.id}`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()).then((d) => { if (d.feed) setFeed(d.feed); });
    }
  }, [params.id]);

  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      if (isNew) {
        const r = await fetch(`${API}/admin/feeds`, { method: "POST", headers: h, body: JSON.stringify(feed) });
        const d = await r.json();
        if (!r.ok) { setSaveError(d.error ?? `Error ${r.status}`); return; }
        if (d.feed) navigate(`/admin/feeds/${d.feed.id}`);
      } else {
        const r = await fetch(`${API}/admin/feeds/${params.id}`, { method: "PUT", headers: h, body: JSON.stringify(feed) });
        const d = await r.json();
        if (!r.ok) { setSaveError(d.error ?? `Error ${r.status}`); return; }
        if (d.feed) setFeed(d.feed);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Network error");
    } finally { setSaving(false); }
  };

  const generate = async () => {
    if (!feed.id) { alert("Save the feed first before generating."); return; }
    setGenerating(true);
    try {
      const r = await fetch(`${API}/admin/feeds/${feed.id}/generate`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (!r.ok) { alert(`Generation failed: ${d.error ?? r.status}`); return; }
      alert("Feed generation started. Check back in a few seconds.");
    } catch (e) {
      alert(`Network error: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setGenerating(false); }
  };

  const runPreview = async () => {
    if (!feed.id) return;
    setPreviewLoading(true);
    // Save current filter rules first, then preview
    await fetch(`${API}/admin/feeds/${feed.id}`, { method: "PUT", headers: h, body: JSON.stringify({ filterRules: feed.filterRules, currencyConfig: feed.currencyConfig }) });
    const r = await fetch(`${API}/admin/feeds/${feed.id}/preview`, { method: "POST", headers: h, body: "{}" });
    const d = await r.json();
    setPreview(d);
    setPreviewLoading(false);
  };

  const feedUrl = feed.id && feed.accessToken ? `${window.location.origin}/api/feeds/${feed.slug}?token=${feed.accessToken}` : null;
  const channelFields = meta?.channelPresets[feed.channelType ?? "google_shopping"] ?? [];
  const inp = "w-full rounded border border-[#2e3340] bg-[#0c1018] px-3 py-2 text-[13px] text-[#dde4f0] focus:outline-none";

  return (
    <div className="space-y-4 text-[#dde4f0]">
      <div className="flex items-center gap-3">
        <Link to="/admin/feeds"><button className="flex items-center gap-1.5 rounded border border-[#1e3a5f] bg-[#0d2040] px-3 py-1.5 text-[12px] font-medium text-[#a8d4f5] hover:bg-[#112550] transition-colors"><ArrowLeft className="h-3.5 w-3.5" /> Feeds</button></Link>
        <h1 className="text-xl font-bold">{isNew ? "New Feed" : (feed.name || "Edit Feed")}</h1>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-[#2e3340]">
        {(["settings", "mappings", "filters"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-[13px] font-medium capitalize transition-colors border-b-2 -mb-px ${tab === t ? "border-sky-500 text-sky-300" : "border-transparent text-[#5a6a84] hover:text-[#dde4f0]"}`}>{t}</button>
        ))}
      </div>

      {tab === "settings" && (
        <div className="rounded-lg border border-[#2e3340] bg-[#181c24] p-5 space-y-4" style={{boxShadow:"0 2px 8px rgba(0,0,0,0.35)"}}>
          <div className="grid grid-cols-2 gap-4">
            <label className="space-y-1"><span className="text-[11px] uppercase tracking-wider text-[#5a6a84]">Feed Name *</span><input className={inp} value={feed.name ?? ""} onChange={(e) => setFeed((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Google Shopping EN" /></label>
            <label className="space-y-1"><span className="text-[11px] uppercase tracking-wider text-[#5a6a84]">Channel</span>
              <select className={inp} value={feed.channelType ?? "google_shopping"} onChange={(e) => setFeed((f) => ({ ...f, channelType: e.target.value }))}>
                <option value="google_shopping">Google Shopping</option>
                <option value="meta">Meta / Facebook</option>
                <option value="tiktok">TikTok</option>
                <option value="custom">Custom</option>
              </select>
            </label>
            <label className="space-y-1"><span className="text-[11px] uppercase tracking-wider text-[#5a6a84]">Format</span>
              <select className={inp} value={feed.format ?? "xml"} onChange={(e) => setFeed((f) => ({ ...f, format: e.target.value }))}>
                <option value="xml">XML</option>
                <option value="csv">CSV</option>
              </select>
            </label>
            <label className="space-y-1"><span className="text-[11px] uppercase tracking-wider text-[#5a6a84]">Refresh Interval</span>
              <select className={inp} value={feed.refreshInterval ?? "daily"} onChange={(e) => setFeed((f) => ({ ...f, refreshInterval: e.target.value }))}>
                <option value="hourly">Hourly</option>
                <option value="daily">Daily</option>
                <option value="manual">Manual only</option>
              </select>
            </label>
            <label className="space-y-1"><span className="text-[11px] uppercase tracking-wider text-[#5a6a84]">Target Country</span><input className={inp} value={feed.targetCountry ?? "US"} onChange={(e) => setFeed((f) => ({ ...f, targetCountry: e.target.value }))} placeholder="US" /></label>
            <label className="space-y-1"><span className="text-[11px] uppercase tracking-wider text-[#5a6a84]">Store Base URL</span><input className={inp} value={feed.storeUrl ?? ""} onChange={(e) => setFeed((f) => ({ ...f, storeUrl: e.target.value }))} placeholder="https://yourstore.com" /></label>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={feed.includeVariations ?? false} onChange={(e) => setFeed((f) => ({ ...f, includeVariations: e.target.checked }))} className="h-4 w-4 accent-sky-500" />
            <span className="text-[13px]">Include product variations as separate rows</span>
          </label>
          <div className="border-t border-[#2e3340] pt-4 space-y-3">
            <p className="text-[11px] uppercase tracking-wider text-[#5a6a84]">Currency Settings</p>
            <div className="grid grid-cols-3 gap-4">
              {[["Base Currency", "baseCurrency"], ["Target Currency", "targetCurrency"]].map(([label, key]) => (
                <label key={key} className="space-y-1"><span className="text-[11px] text-[#5a6a84]">{label}</span>
                  <select className={inp} value={(feed.currencyConfig as Record<string, string | number>)?.[key] ?? "USD"} onChange={(e) => setFeed((f) => ({ ...f, currencyConfig: { ...(f.currencyConfig ?? {}), [key]: e.target.value } as typeof f.currencyConfig }))}>
                    {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
              ))}
              <label className="space-y-1"><span className="text-[11px] text-[#5a6a84]">Exchange Rate</span>
                <input type="number" step="0.0001" className={inp} value={feed.currencyConfig?.exchangeRate ?? 1} onChange={(e) => setFeed((f) => ({ ...f, currencyConfig: { ...(f.currencyConfig ?? {}), exchangeRate: parseFloat(e.target.value) || 1 } as typeof f.currencyConfig }))} />
              </label>
            </div>
          </div>
          {feedUrl && (
            <div className="border-t border-[#2e3340] pt-4">
              <p className="text-[11px] uppercase tracking-wider text-[#5a6a84] mb-1.5">Feed URL</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-[#0c1018] border border-[#2e3340] px-3 py-2 text-[11px] text-sky-300 break-all">{feedUrl}</code>
                <button onClick={() => navigator.clipboard.writeText(feedUrl)} className="rounded p-2 text-[#5a6a84] hover:bg-[#1a2235] transition-colors"><Copy className="h-4 w-4" /></button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "mappings" && (
        <div className="rounded-lg border border-[#2e3340] bg-[#181c24] p-5" style={{boxShadow:"0 2px 8px rgba(0,0,0,0.35)"}}>
          <FeedMappingTable
            mappings={feed.fieldMappings ?? []}
            channelFields={channelFields}
            productAttributes={meta?.productAttributes ?? []}
            onChange={(fieldMappings) => setFeed((f) => ({ ...f, fieldMappings }))}
          />
        </div>
      )}

      {tab === "filters" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-[#2e3340] bg-[#181c24] p-5" style={{boxShadow:"0 2px 8px rgba(0,0,0,0.35)"}}>
            <FeedFilterBuilder
              value={feed.filterRules ?? { id: "root", type: "group", condition: "AND", rules: [] }}
              onChange={(filterRules) => setFeed((f) => ({ ...f, filterRules }))}
              fields={meta?.filterFields ?? []}
            />
          </div>
          {!isNew && (
            <div className="rounded-lg border border-[#2e3340] bg-[#181c24] p-4" style={{boxShadow:"0 2px 8px rgba(0,0,0,0.35)"}}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[13px] font-semibold">Live Preview</p>
                <button onClick={runPreview} disabled={previewLoading} className="flex items-center gap-1.5 rounded border border-sky-500 bg-sky-600/30 px-3 py-1.5 text-[12px] text-sky-300 hover:bg-sky-600/50 disabled:opacity-40 transition-colors"><Eye className="h-3.5 w-3.5" />{previewLoading ? "Loading..." : "Run Preview"}</button>
              </div>
              {preview && (
                <div className="space-y-2 text-[12.5px]">
                  <p className="text-[#dde4f0]"><span className="font-bold text-emerald-400">{preview.matched}</span> of {preview.total} sampled products match your filters</p>
                  {preview.sample.map((row, i) => (
                    <div key={i} className="rounded border border-[#2e3340] bg-[#0c1018] px-3 py-2 text-[11.5px] text-[#8fa0bb]">
                      {String(row.name)} — {String(row.sku)} — {String(row.price)} — {String(row.availability)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {saveError && <div className="rounded border border-red-500/40 bg-red-900/20 px-3 py-2 text-[12px] text-red-300">{saveError}</div>}
      {saveSuccess && <div className="rounded border border-emerald-500/40 bg-emerald-900/20 px-3 py-2 text-[12px] text-emerald-300">Saved successfully.</div>}
      <div className="flex gap-2">
        <button onClick={save} disabled={saving} className="flex items-center gap-1.5 rounded border border-sky-500 bg-sky-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-sky-500 disabled:opacity-50 transition-colors"><Save className="h-4 w-4" />{saving ? "Saving..." : "Save"}</button>
        {!isNew && <button onClick={generate} disabled={generating} className="flex items-center gap-1.5 rounded border border-emerald-500 bg-emerald-600/30 px-4 py-2 text-[13px] font-semibold text-emerald-300 hover:bg-emerald-600/50 disabled:opacity-50 transition-colors"><Play className="h-4 w-4" />{generating ? "Starting..." : "Generate Now"}</button>}
      </div>
    </div>
  );
}
