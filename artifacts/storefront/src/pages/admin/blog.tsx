import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Plus, Search, Eye, Pencil, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/auth-store";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface AdminPost {
  id: number;
  title: string;
  slug: string;
  status: string;
  isPublished: boolean;
  publishedAt: string | null;
  scheduledAt: string | null;
  viewCount: number;
  createdAt: string;
  categoryName: string | null;
  authorName: string | null;
}

interface Category { id: number; name: string; slug: string; }

const thBase = "border-b border-r border-[#2a2e3a] bg-[#1e2128] px-2.5 py-[8px] text-[10.5px] font-bold uppercase tracking-widest select-none whitespace-nowrap card-title";
const tableCell = "border-b border-r border-[#1f2840] px-2.5 py-[7px] align-middle text-[12.5px] text-[#dde4f0]";

export default function AdminBlogPage() {
  const { token } = useAuthStore();
  const { toast } = useToast();
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  useEffect(() => {
    fetch(`${API}/admin/blog/categories`, { headers, credentials: "include" })
      .then((r) => r.json()).then((d) => setCategories(d.categories || []))
      .catch(() => {});
  }, []);

  useEffect(() => { loadPosts(); }, [page, statusFilter, categoryFilter]);

  async function loadPosts() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (statusFilter) params.set("status", statusFilter);
      if (categoryFilter) params.set("categoryId", categoryFilter);
      if (search) params.set("search", search);
      const res = await fetch(`${API}/admin/blog/posts?${params}`, { headers, credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts);
        setTotalPages(data.totalPages);
      }
    } catch {} finally { setLoading(false); }
  }

  async function deletePost(id: number) {
    if (!confirm("Delete this post?")) return;
    const res = await fetch(`${API}/admin/blog/posts/${id}`, { method: "DELETE", headers, credentials: "include" });
    if (res.ok) { toast({ title: "Post deleted" }); loadPosts(); }
    else toast({ title: "Failed to delete", variant: "destructive" });
  }

  function handleSearch(e: React.FormEvent) { e.preventDefault(); setPage(1); loadPosts(); }

  const STATUS_FILTERS = [
    { label: "All", value: "" },
    { label: "Published", value: "published" },
    { label: "Draft", value: "draft" },
    { label: "Scheduled", value: "scheduled" },
  ];

  return (
    <div className="space-y-3 text-[#e8edf5]">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-white">Blog Posts</h1>
        <Link href="/admin/blog/new">
          <Button className="bg-sky-600 hover:bg-sky-700 text-white gap-1.5"><Plus className="h-4 w-4" /> New Post</Button>
        </Link>
      </div>

      <div className="flex gap-2.5 flex-wrap items-center">
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            placeholder="Search posts..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-60 h-8 border-[#3d4558] bg-[#0f1117] text-[#e8edf5] placeholder:text-[#6b7280] focus-visible:ring-sky-500/40"
          />
          <Button type="submit" variant="outline" size="icon" className="h-8 w-8 border-[#3d4558] bg-[#1a1f2e] text-[#e8edf5] hover:bg-[#252a38]">
            <Search className="h-4 w-4" />
          </Button>
        </form>
        <div className="flex gap-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => { setStatusFilter(f.value); setPage(1); }}
              className={`h-8 px-3 rounded text-[12px] font-medium transition-colors ${
                statusFilter === f.value
                  ? "bg-[#2a2e3a] text-[#d4a017] border border-[#3d4558]"
                  : "bg-[#1a1f2e] text-[#8fa0bb] border border-[#2e3340] hover:bg-[#252a38] hover:text-[#dde4f0]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {categories.length > 0 && (
          <select
            className="h-8 rounded border border-[#3d4558] bg-[#0f1117] px-2 text-[13px] text-[#e8edf5]"
            value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
          >
            <option value="">All Categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>

      <div className="overflow-x-auto rounded-md border border-[#1e2a40] bg-[#0c1018]" style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }}>
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#8fa0bb]" /></div>
        ) : posts.length === 0 ? (
          <p className="text-center text-[13px] text-[#4a5570] py-12">No posts found.</p>
        ) : (
          <table className="w-full border-collapse text-left" style={{ borderSpacing: 0 }}>
            <thead>
              <tr className="border-b-2 border-[#2a2e3a]" style={{ backgroundColor: "#1e2128" }}>
                <th className={`${thBase} min-w-[220px]`}>Title</th>
                <th className={`${thBase} min-w-[110px] hidden md:table-cell`}>Category</th>
                <th className={`${thBase} w-[110px]`}>Status</th>
                <th className={`${thBase} w-[70px] hidden sm:table-cell`}>Views</th>
                <th className={`${thBase} w-[100px] hidden lg:table-cell`}>Date</th>
                <th className={`${thBase} w-[90px] text-right border-r-0`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((p, idx) => (
                <tr key={p.id} className={`transition-colors duration-75 ${idx % 2 === 0 ? "bg-[#0c1018] hover:bg-[#111825]" : "bg-[#0f1520] hover:bg-[#141e2e]"}`}>
                  <td className={tableCell}>
                    <span className="font-medium text-[#dde4f0]">{p.title}</span>
                    <span className="text-[11px] text-[#8fa0bb] block">/{p.slug}</span>
                  </td>
                  <td className={`${tableCell} hidden md:table-cell text-[#8fa0bb]`}>{p.categoryName || "—"}</td>
                  <td className={tableCell}>
                    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-medium ${
                      p.isPublished
                        ? "border-emerald-500 bg-emerald-500/20 text-emerald-200"
                        : p.status === "scheduled"
                        ? "border-sky-500 bg-sky-500/20 text-sky-200"
                        : "border-[#3d4558] bg-[#1a1f2e] text-[#8fa0bb]"
                    }`}>
                      {p.isPublished ? "Published" : p.status === "scheduled" ? "Scheduled" : "Draft"}
                    </span>
                  </td>
                  <td className={`${tableCell} hidden sm:table-cell`}>
                    <span className="flex items-center gap-1 text-[#8fa0bb]"><Eye className="h-3 w-3" /> {p.viewCount}</span>
                  </td>
                  <td className={`${tableCell} hidden lg:table-cell text-[#8fa0bb]`}>{new Date(p.createdAt).toLocaleDateString()}</td>
                  <td className={`${tableCell} text-right border-r-0`}>
                    <div className="flex justify-end gap-1">
                      <Link href={`/admin/blog/${p.id}`}>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-[#8fa0bb] hover:text-white hover:bg-[#1e2a40]"><Pencil className="h-3.5 w-3.5" /></Button>
                      </Link>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-200 hover:bg-red-500/10" onClick={() => deletePost(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-1.5">
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              onClick={() => setPage(i + 1)}
              className={`h-8 min-w-[32px] px-2 rounded text-[12px] font-medium transition-colors ${
                page === i + 1
                  ? "bg-[#2a2e3a] text-[#d4a017] border border-[#3d4558]"
                  : "bg-[#1a1f2e] text-[#8fa0bb] border border-[#2e3340] hover:bg-[#252a38] hover:text-[#dde4f0]"
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
