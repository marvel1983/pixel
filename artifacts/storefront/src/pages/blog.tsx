import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Loader2, Clock, Eye, ArrowRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { BlogSidebar } from "@/components/blog/blog-sidebar";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface BlogPostSummary {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  tags: string | null;
  publishedAt: string | null;
  viewCount: number;
  categoryName: string | null;
  categorySlug: string | null;
  authorName: string | null;
}

export default function BlogPage() {
  const [posts, setPosts] = useState<BlogPostSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [activeCategory, setActiveCategory] = useState("");
  const [activeTag, setActiveTag] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  useEffect(() => {
    loadPosts();
  }, [page, activeCategory, activeTag, search]);

  async function loadPosts() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "12" });
      if (activeCategory) params.set("category", activeCategory);
      if (activeTag) params.set("tag", activeTag);
      if (search) params.set("search", search);
      const res = await fetch(`${API}/blog/posts?${params}`);
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts);
        setTotalPages(data.totalPages);
      }
    } catch {} finally { setLoading(false); }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  }

  function selectCategory(slug: string) {
    setActiveCategory(slug === activeCategory ? "" : slug);
    setActiveTag("");
    setPage(1);
  }

  function selectTag(tag: string) {
    setActiveTag(tag === activeTag ? "" : tag);
    setActiveCategory("");
    setPage(1);
  }

  const featured = posts.length > 0 && page === 1 && !search ? posts[0] : null;
  const gridPosts = featured ? posts.slice(1) : posts;

  return (
    <div className="container mx-auto px-4 py-6">
      <Breadcrumbs crumbs={[{ label: "Blog" }]} />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Blog</h1>
          <p className="text-muted-foreground text-sm mt-1">Software tips, guides, and news</p>
        </div>
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input placeholder="Search articles..." value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)} className="w-48" />
          <Button type="submit" variant="outline" size="icon"><Search className="h-4 w-4" /></Button>
        </form>
      </div>

      {featured && <FeaturedPost post={featured} />}

      <div className="flex flex-col lg:flex-row gap-8 mt-8">
        <div className="flex-1">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : gridPosts.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">No articles found.</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {gridPosts.map((post) => <PostCard key={post.id} post={post} />)}
            </div>
          )}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              {Array.from({ length: totalPages }, (_, i) => (
                <Button key={i} variant={page === i + 1 ? "default" : "outline"} size="sm"
                  onClick={() => setPage(i + 1)}>{i + 1}</Button>
              ))}
            </div>
          )}
        </div>
        <div className="lg:w-72 shrink-0">
          <BlogSidebar activeCategory={activeCategory} activeTag={activeTag}
            onCategorySelect={selectCategory} onTagSelect={selectTag} />
        </div>
      </div>
    </div>
  );
}

function FeaturedPost({ post }: { post: BlogPostSummary }) {
  return (
    <Link href={`/blog/${post.slug}`}>
      <div className="relative rounded-xl overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-700 text-white group cursor-pointer">
        <div className="flex flex-col md:flex-row">
          {post.coverImageUrl && (
            <div className="md:w-1/2 h-48 md:h-auto">
              <img src={post.coverImageUrl} alt={post.title}
                className="w-full h-full object-cover" />
            </div>
          )}
          <div className={`p-8 flex flex-col justify-center ${post.coverImageUrl ? "md:w-1/2" : "w-full"}`}>
            {post.categoryName && <Badge className="w-fit mb-3 bg-white/20">{post.categoryName}</Badge>}
            <h2 className="text-2xl font-bold mb-3 group-hover:underline">{post.title}</h2>
            {post.excerpt && <p className="text-white/80 mb-4 line-clamp-2">{post.excerpt}</p>}
            <div className="flex items-center gap-4 text-sm text-white/70">
              {post.publishedAt && <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {formatDate(post.publishedAt)}</span>}
              <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> {post.viewCount} views</span>
            </div>
            <span className="inline-flex items-center gap-1 mt-4 text-sm font-medium">
              Read article <ArrowRight className="h-4 w-4" />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function PostCard({ post }: { post: BlogPostSummary }) {
  return (
    <Link href={`/blog/${post.slug}`}>
      <div className="rounded-lg border bg-card overflow-hidden hover:shadow-md transition cursor-pointer group h-full flex flex-col">
        {post.coverImageUrl ? (
          <img src={post.coverImageUrl} alt={post.title}
            className="w-full h-40 object-cover" />
        ) : (
          <div className="w-full h-40 bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
            <span className="text-4xl">📝</span>
          </div>
        )}
        <div className="p-4 flex flex-col flex-1">
          {post.categoryName && <span className="text-xs text-primary font-medium mb-1">{post.categoryName}</span>}
          <h3 className="font-semibold line-clamp-2 group-hover:text-primary transition mb-2">{post.title}</h3>
          {post.excerpt && <p className="text-sm text-muted-foreground line-clamp-2 mb-3 flex-1">{post.excerpt}</p>}
          <div className="flex items-center justify-between text-xs text-muted-foreground mt-auto">
            {post.publishedAt && <span>{formatDate(post.publishedAt)}</span>}
            <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {post.viewCount}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
