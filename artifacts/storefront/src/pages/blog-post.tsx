import { useState, useEffect } from "react";
import { Link, useParams, useLocation } from "wouter";
import { Loader2, Clock, Eye, Tag, ArrowLeft, Share2, Facebook, Twitter } from "lucide-react";
import DOMPurify from "dompurify";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { BlogSidebar } from "@/components/blog/blog-sidebar";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface BlogPostFull {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string | null;
  coverImageUrl: string | null;
  tags: string | null;
  publishedAt: string | null;
  viewCount: number;
  seoTitle: string | null;
  seoDescription: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  authorName: string | null;
}

interface RelatedPost {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  publishedAt: string | null;
}

export default function BlogPostPage() {
  const params = useParams<{ slug: string }>();
  const [, setLocation] = useLocation();
  const [post, setPost] = useState<BlogPostFull | null>(null);
  const [related, setRelated] = useState<RelatedPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPost();
  }, [params.slug]);

  async function loadPost() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/blog/posts/${params.slug}`);
      if (res.ok) {
        const data = await res.json();
        setPost(data.post);
        setRelated(data.related || []);
        if (data.post.seoTitle) document.title = data.post.seoTitle;
        else document.title = `${data.post.title} | PixelCodes Blog`;
      }
    } catch {} finally { setLoading(false); }
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!post) return (
    <div className="container mx-auto px-4 py-12 text-center">
      <h1 className="text-2xl font-bold mb-4">Article Not Found</h1>
      <Link href="/blog"><Button variant="outline"><ArrowLeft className="h-4 w-4 mr-2" /> Back to Blog</Button></Link>
    </div>
  );

  const tagList = post.tags?.split(",").map((t) => t.trim()).filter(Boolean) || [];
  const shareUrl = typeof window !== "undefined" ? window.location.href : "";

  return (
    <div className="container mx-auto px-4 py-6">
      <Breadcrumbs crumbs={[
        { label: "Blog", href: "/blog" },
        ...(post.categoryName ? [{ label: post.categoryName, href: `/blog?category=${post.categorySlug}` }] : []),
        { label: post.title },
      ]} />

      <div className="flex flex-col lg:flex-row gap-8 mt-4">
        <article className="flex-1 max-w-3xl">
          {post.coverImageUrl && (
            <img src={post.coverImageUrl} alt={post.title}
              className="w-full rounded-xl object-cover max-h-96 mb-6" />
          )}

          <header className="mb-6">
            {post.categoryName && (
              <Link href={`/blog?category=${post.categorySlug}`}>
                <Badge variant="secondary" className="mb-3 cursor-pointer hover:bg-primary hover:text-white">
                  {post.categoryName}
                </Badge>
              </Link>
            )}
            <h1 className="text-3xl font-bold mb-3">{post.title}</h1>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              {post.authorName && <span>By {post.authorName}</span>}
              {post.publishedAt && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {new Date(post.publishedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </span>
              )}
              <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> {post.viewCount} views</span>
            </div>
          </header>

          {post.content && (
            <div className="prose prose-lg max-w-none mb-8"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(post.content) }} />
          )}

          {tagList.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap mb-6 border-t pt-6">
              <Tag className="h-4 w-4 text-muted-foreground" />
              {tagList.map((tag) => (
                <Link key={tag} href={`/blog?tag=${encodeURIComponent(tag)}`}>
                  <Badge variant="outline" className="cursor-pointer hover:bg-accent">{tag}</Badge>
                </Link>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3 border-t pt-6 mb-8">
            <span className="text-sm font-medium flex items-center gap-1"><Share2 className="h-4 w-4" /> Share:</span>
            <a href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(post.title)}`}
              target="_blank" rel="noopener" className="p-2 rounded-full hover:bg-accent transition">
              <Twitter className="h-4 w-4" />
            </a>
            <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
              target="_blank" rel="noopener" className="p-2 rounded-full hover:bg-accent transition">
              <Facebook className="h-4 w-4" />
            </a>
          </div>

          {related.length > 0 && (
            <section className="border-t pt-8">
              <h2 className="text-xl font-bold mb-4">Related Articles</h2>
              <div className="grid sm:grid-cols-3 gap-4">
                {related.map((r) => (
                  <Link key={r.id} href={`/blog/${r.slug}`}>
                    <div className="rounded-lg border overflow-hidden hover:shadow-md transition cursor-pointer group">
                      {r.coverImageUrl ? (
                        <img src={r.coverImageUrl} alt={r.title} className="w-full h-32 object-cover" />
                      ) : (
                        <div className="w-full h-32 bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
                          <span className="text-2xl">📝</span>
                        </div>
                      )}
                      <div className="p-3">
                        <h3 className="font-medium text-sm line-clamp-2 group-hover:text-primary transition">{r.title}</h3>
                        {r.publishedAt && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(r.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </article>

        <div className="lg:w-72 shrink-0">
          <BlogSidebar activeCategory={post.categorySlug || ""} activeTag=""
            onCategorySelect={(slug) => setLocation(`/blog?category=${slug}`)}
            onTagSelect={(tag) => setLocation(`/blog?tag=${encodeURIComponent(tag)}`)} />
        </div>
      </div>
    </div>
  );
}
