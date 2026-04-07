import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Folder, Tag, TrendingUp, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface Category {
  id: number;
  name: string;
  slug: string;
}

interface TagItem {
  name: string;
  count: number;
}

interface RecentPost {
  id: number;
  title: string;
  slug: string;
  publishedAt: string | null;
  coverImageUrl: string | null;
}

interface BlogSidebarProps {
  activeCategory: string;
  activeTag: string;
  onCategorySelect: (slug: string) => void;
  onTagSelect: (tag: string) => void;
}

export function BlogSidebar({ activeCategory, activeTag, onCategorySelect, onTagSelect }: BlogSidebarProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [recentPosts, setRecentPosts] = useState<RecentPost[]>([]);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/blog/categories`).then((r) => r.ok ? r.json() : { categories: [] }),
      fetch(`${API}/blog/tags`).then((r) => r.ok ? r.json() : { tags: [] }),
      fetch(`${API}/blog/posts?limit=5`).then((r) => r.ok ? r.json() : { posts: [] }),
    ]).then(([catData, tagData, postData]) => {
      setCategories(catData.categories || []);
      setTags((tagData.tags || []).slice(0, 15));
      setRecentPosts(postData.posts || []);
    }).catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      {categories.length > 0 && (
        <div>
          <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
            <Folder className="h-4 w-4" /> Categories
          </h3>
          <div className="space-y-1">
            {categories.map((cat) => (
              <button key={cat.id} onClick={() => onCategorySelect(cat.slug)}
                className={`w-full text-left text-sm px-3 py-1.5 rounded-md transition ${activeCategory === cat.slug ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}>
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {recentPosts.length > 0 && (
        <div>
          <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4" /> Recent Posts
          </h3>
          <div className="space-y-3">
            {recentPosts.map((post) => (
              <Link key={post.id} href={`/blog/${post.slug}`}>
                <div className="flex gap-3 group cursor-pointer">
                  {post.coverImageUrl ? (
                    <img src={post.coverImageUrl} alt="" className="w-16 h-12 rounded object-cover shrink-0" />
                  ) : (
                    <div className="w-16 h-12 rounded bg-gradient-to-br from-blue-100 to-indigo-100 shrink-0 flex items-center justify-center text-xs">📝</div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium line-clamp-2 group-hover:text-primary transition">{post.title}</p>
                    {post.publishedAt && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(post.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {tags.length > 0 && (
        <div>
          <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
            <Tag className="h-4 w-4" /> Popular Tags
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <button key={tag.name} onClick={() => onTagSelect(tag.name)}>
                <Badge variant={activeTag === tag.name ? "default" : "outline"}
                  className="cursor-pointer text-xs">{tag.name}</Badge>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
