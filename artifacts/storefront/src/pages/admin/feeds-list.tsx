import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Plus, RefreshCw, Copy, Play, Trash2, ExternalLink } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface Feed {
  id: number; name: string; slug: string; channelType: string; format: string;
  status: string; lastGeneratedAt: string | null; lastRowCount: number | null;
  lastError: string | null; refreshInterval: string; accessToken: string;
}

const STATUS_STYLE: Record<string, string> = {
  active:     "border-emerald-400/50 bg-emerald-500/20 text-emerald-300",
  inactive:   "border-[#2e3340]      bg-[#181c24]      text-[#5a6a84]",
  generating: "border-sky-400/50     bg-sky-500/20     text-sky-300",
  error:      "border-red-400/50     bg-red-500/20     text-red-300",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider ${STATUS_STYLE[status] ?? STATUS_STYLE.inactive}`}>
      {status === "generating" && <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-pulse" />}
      {status}
    </span>
  );
}

export default function FeedsListPage() {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<Set<number>>(new Set());
  const token = useAuthStore((s) => s.token);
  const h = { Authorization: `Bearer ${token}` };

  const load = () => {
    fetch(`${API}/admin/feeds`, { headers: h }).then((r) => r.json())
      .then((d) => setFeeds(d.feeds ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);
  // Poll while any feed is generating
  useEffect(() => {
    if (!feeds.some((f) => f.status === "generating")) return;
    const iv = setInterval(load, 3000);
    return () => clearInterval(iv);
  }, [feeds]);

  const generate = async (id: number) => {
    setGenerating((s) => new Set(s).add(id));
    await fetch(`${API}/admin/feeds/${id}/generate`, { method: "POST", headers: h });
    setTimeout(load, 1000);
    setGenerating((s) => { const n = new Set(s); n.delete(id); return n; });
  };

  const deleteFeed = async (id: number, name: string) => {
    if (!confirm(`Delete feed "${name}"?`)) return;
    await fetch(`${API}/admin/feeds/${id}`, { method: "DELETE", headers: h });
    load();
  };

  const copyUrl = (feed: Feed) => {
    const url = `${window.location.origin}/api/feeds/${feed.slug}?token=${feed.accessToken}`;
    navigator.clipboard.writeText(url);
  };

  if (loading) return <div className="flex items-center justify-center py-12 text-[#5a6a84]">Loading feeds...</div>;

  return (
    <div className="space-y-4 text-[#dde4f0]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Product Feeds</h1>
          <p className="text-sm text-[#5a6a84]">Generate XML/CSV feeds for Google Shopping, Meta, TikTok, and more</p>
        </div>
        <Link to="/admin/feeds/new">
          <button className="flex items-center gap-1.5 rounded border border-sky-500 bg-sky-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-sky-500 transition-colors">
            <Plus className="h-4 w-4" /> New Feed
          </button>
        </Link>
      </div>

      {feeds.length === 0 ? (
        <div className="rounded-lg border border-[#2e3340] bg-[#181c24] py-16 text-center" style={{boxShadow:"0 2px 8px rgba(0,0,0,0.35)"}}>
          <p className="text-[#5a6a84]">No feeds yet. Create your first product feed to start exporting to marketing channels.</p>
          <Link to="/admin/feeds/new"><button className="mt-4 rounded border border-sky-500 bg-sky-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-sky-500 transition-colors">Create Feed</button></Link>
        </div>
      ) : (
        <div className="rounded-lg border border-[#2e3340] bg-[#181c24] overflow-hidden" style={{boxShadow:"0 2px 8px rgba(0,0,0,0.35)"}}>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-[#1e2128] border-b border-[#2a2e3a]">
                {["Feed Name", "Channel", "Format", "Interval", "Status", "Last Generated", "Rows", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-widest text-white">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {feeds.map((feed, idx) => (
                <tr key={feed.id} className={`border-b border-[#1f2840] ${idx % 2 === 0 ? "bg-[#0c1018]" : "bg-[#0f1520]"}`}>
                  <td className="px-4 py-3 font-medium text-[#dde4f0]">
                    <Link to={`/admin/feeds/${feed.id}`} className="hover:text-sky-400 transition-colors">{feed.name}</Link>
                    {feed.lastError && <p className="text-[11px] text-red-400 mt-0.5 truncate max-w-[200px]" title={feed.lastError}>{feed.lastError}</p>}
                  </td>
                  <td className="px-4 py-3 text-[#8fa0bb] capitalize">{feed.channelType.replace("_", " ")}</td>
                  <td className="px-4 py-3 text-[#8fa0bb] uppercase">{feed.format}</td>
                  <td className="px-4 py-3 text-[#8fa0bb] capitalize">{feed.refreshInterval}</td>
                  <td className="px-4 py-3"><StatusBadge status={feed.status} /></td>
                  <td className="px-4 py-3 text-[#8fa0bb] text-[12px]">{feed.lastGeneratedAt ? new Date(feed.lastGeneratedAt).toLocaleString() : "—"}</td>
                  <td className="px-4 py-3 text-[#8fa0bb] tabular-nums">{feed.lastRowCount ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => generate(feed.id)} disabled={feed.status === "generating" || generating.has(feed.id)} title="Generate" className="rounded p-1.5 text-sky-400 hover:bg-sky-900/30 disabled:opacity-40 transition-colors"><Play className="h-3.5 w-3.5" /></button>
                      <button onClick={() => copyUrl(feed)} title="Copy feed URL" className="rounded p-1.5 text-[#5a6a84] hover:bg-[#1a2235] hover:text-[#dde4f0] transition-colors"><Copy className="h-3.5 w-3.5" /></button>
                      <Link to={`/admin/feeds/${feed.id}`}><button title="Edit" className="rounded p-1.5 text-[#5a6a84] hover:bg-[#1a2235] hover:text-[#dde4f0] transition-colors"><ExternalLink className="h-3.5 w-3.5" /></button></Link>
                      <button onClick={() => deleteFeed(feed.id, feed.name)} title="Delete" className="rounded p-1.5 text-red-400 hover:bg-red-900/30 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
