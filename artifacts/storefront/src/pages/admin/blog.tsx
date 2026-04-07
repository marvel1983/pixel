import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Plus, Search, Eye, Pencil, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/auth-store";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface AdminPost {
  id: number;
  title: string;
  slug: string;
  isPublished: boolean;
  publishedAt: string | null;
  viewCount: number;
  createdAt: string;
  categoryName: string | null;
  authorName: string | null;
}

interface Category { id: number; name: string; slug: string; }

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Blog Posts</h1>
        <Link href="/admin/blog/new"><Button className="gap-1.5"><Plus className="h-4 w-4" /> New Post</Button></Link>
      </div>

      <div className="flex gap-3 flex-wrap items-center">
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input placeholder="Search posts..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-60" />
          <Button type="submit" variant="outline" size="icon"><Search className="h-4 w-4" /></Button>
        </form>
        <div className="flex gap-1">
          {[{ label: "All", value: "" }, { label: "Published", value: "published" }, { label: "Draft", value: "draft" }].map((f) => (
            <Button key={f.value} variant={statusFilter === f.value ? "default" : "outline"} size="sm"
              onClick={() => { setStatusFilter(f.value); setPage(1); }}>{f.label}</Button>
          ))}
        </div>
        {categories.length > 0 && (
          <select className="rounded-md border px-3 py-1.5 text-sm bg-white"
            value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}>
            <option value="">All Categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>

      <div className="rounded-lg border bg-white overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : posts.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">No posts found.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Category</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium hidden sm:table-cell">Views</th>
                <th className="px-4 py-3 font-medium hidden lg:table-cell">Date</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {posts.map((p) => (
                <tr key={p.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3"><span className="font-medium">{p.title}</span><span className="text-xs text-muted-foreground block">/{p.slug}</span></td>
                  <td className="px-4 py-3 hidden md:table-cell">{p.categoryName || "—"}</td>
                  <td className="px-4 py-3"><Badge variant={p.isPublished ? "default" : "secondary"}>{p.isPublished ? "Published" : "Draft"}</Badge></td>
                  <td className="px-4 py-3 hidden sm:table-cell"><span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {p.viewCount}</span></td>
                  <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">{new Date(p.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Link href={`/admin/blog/${p.id}`}><Button variant="ghost" size="icon" className="h-8 w-8"><Pencil className="h-3.5 w-3.5" /></Button></Link>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => deletePost(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => (
            <Button key={i} variant={page === i + 1 ? "default" : "outline"} size="sm" onClick={() => setPage(i + 1)}>{i + 1}</Button>
          ))}
        </div>
      )}
    </div>
  );
}
