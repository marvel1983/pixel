import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, Save, Loader2, Eye, Clock, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/auth-store";
import { RichTextEditor } from "@/components/admin/rich-text-editor";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface Category { id: number; name: string; slug: string; }

export default function BlogEditPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { token } = useAuthStore();
  const { toast } = useToast();
  const isNew = id === "new";

  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const [form, setForm] = useState({
    title: "", slug: "", excerpt: "", content: "",
    coverImageUrl: "", categoryId: "", tags: "",
    status: "draft", seoTitle: "", seoDescription: "",
    scheduledAt: "",
  });

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  useEffect(() => {
    fetch(`${API}/admin/blog/categories`, { headers, credentials: "include" })
      .then((r) => r.json()).then((d) => setCategories(d.categories || []))
      .catch(() => {});

    if (!isNew) {
      fetch(`${API}/admin/blog/posts/${id}`, { headers, credentials: "include" })
        .then((r) => r.json()).then((data) => {
          setForm({
            title: data.title || "", slug: data.slug || "",
            excerpt: data.excerpt || "", content: data.content || "",
            coverImageUrl: data.coverImageUrl || "",
            categoryId: data.categoryId ? String(data.categoryId) : "",
            tags: data.tags || "", status: data.status || "draft",
            seoTitle: data.seoTitle || "", seoDescription: data.seoDescription || "",
            scheduledAt: data.scheduledAt ? new Date(data.scheduledAt).toISOString().slice(0, 16) : "",
          });
        }).catch(() => toast({ title: "Failed to load post", variant: "destructive" }))
        .finally(() => setLoading(false));
    }
  }, [id]);

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function generateSlug(title: string) {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  async function handleSave(status?: string) {
    if (!form.title || !form.slug) {
      toast({ title: "Title and slug are required", variant: "destructive" }); return;
    }
    setSaving(true);
    const body = {
      ...form,
      status: status || form.status,
      categoryId: form.categoryId ? parseInt(form.categoryId) : null,
      scheduledAt: status === "scheduled" && form.scheduledAt ? form.scheduledAt : null,
    };
    try {
      const url = isNew ? `${API}/admin/blog/posts` : `${API}/admin/blog/posts/${id}`;
      const method = isNew ? "POST" : "PUT";
      const res = await fetch(url, { method, headers, credentials: "include", body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      toast({ title: isNew ? "Post created" : "Post updated" });
      if (isNew) setLocation(`/admin/blog/${data.id}`);
      else setForm((prev) => ({ ...prev, status: data.status }));
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Save failed", variant: "destructive" });
    } finally { setSaving(false); }
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const statusLabel = form.status === "published" ? "Published" : form.status === "scheduled" ? "Scheduled" : "Draft";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/admin/blog")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <h1 className="text-xl font-bold">{isNew ? "New Post" : "Edit Post"}</h1>
          <span className="text-xs px-2 py-0.5 rounded bg-muted">{statusLabel}</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleSave("draft")} disabled={saving}>
            <Save className="h-4 w-4 mr-1" /> Draft
          </Button>
          <Button variant="secondary" onClick={() => {
            if (!form.scheduledAt) { toast({ title: "Set a schedule date first", variant: "destructive" }); return; }
            handleSave("scheduled");
          }} disabled={saving}>
            <Clock className="h-4 w-4 mr-1" /> Schedule
          </Button>
          <Button onClick={() => handleSave("published")} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
            Publish
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-lg border bg-white p-4 space-y-3">
            <div>
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => {
                set("title", e.target.value);
                if (isNew) set("slug", generateSlug(e.target.value));
              }} placeholder="Post title" />
            </div>
            <div>
              <Label>Slug</Label>
              <Input value={form.slug} onChange={(e) => set("slug", e.target.value)} placeholder="post-url-slug" />
            </div>
            <div>
              <Label>Excerpt</Label>
              <Textarea value={form.excerpt} onChange={(e) => set("excerpt", e.target.value)}
                placeholder="Brief description..." rows={2} />
            </div>
            <div>
              <Label>Content</Label>
              <RichTextEditor content={form.content} onChange={(html) => set("content", html)}
                placeholder="Write your article content..." />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border bg-white p-4 space-y-3">
            <h3 className="font-semibold text-sm">Post Settings</h3>
            <div>
              <Label>Cover Image URL</Label>
              <Input value={form.coverImageUrl} onChange={(e) => set("coverImageUrl", e.target.value)} placeholder="https://..." />
            </div>
            <div>
              <Label>Category</Label>
              <select className="w-full rounded-md border px-3 py-2 text-sm"
                value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
                <option value="">No category</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Tags (comma separated)</Label>
              <Input value={form.tags} onChange={(e) => set("tags", e.target.value)} placeholder="windows, software, tips" />
            </div>
            <div>
              <Label className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Schedule Date</Label>
              <Input type="datetime-local" value={form.scheduledAt}
                onChange={(e) => set("scheduledAt", e.target.value)} />
            </div>
          </div>

          <div className="rounded-lg border bg-white p-4 space-y-3">
            <h3 className="font-semibold text-sm">SEO</h3>
            <div>
              <Label>SEO Title</Label>
              <Input value={form.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} placeholder="Custom SEO title" />
            </div>
            <div>
              <Label>SEO Description</Label>
              <Textarea value={form.seoDescription} onChange={(e) => set("seoDescription", e.target.value)}
                placeholder="Meta description for search engines..." rows={2} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
