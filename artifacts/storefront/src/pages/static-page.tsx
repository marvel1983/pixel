import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import DOMPurify from "dompurify";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface PageData {
  title: string; content: string | null;
  metaTitle: string | null; metaDescription: string | null;
}

export default function StaticPageView() {
  const [, params] = useRoute("/page/:slug");
  const [page, setPage] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!params?.slug) return;
    setLoading(true);
    fetch(`${API}/pages/${params.slug}`)
      .then(async (r) => {
        if (!r.ok) { setNotFound(true); return; }
        const d = await r.json();
        setPage(d.page);
        if (d.page.metaTitle) document.title = d.page.metaTitle;
        else document.title = `${d.page.title} - PixelCodes`;
      })
      .finally(() => setLoading(false));
  }, [params?.slug]);

  if (loading) return <div className="max-w-4xl mx-auto px-4 py-12 space-y-4"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-5/6" /></div>;
  if (notFound || !page) return <div className="max-w-4xl mx-auto px-4 py-12 text-center"><h1 className="text-2xl font-bold mb-2">Page Not Found</h1><p className="text-muted-foreground">The page you're looking for doesn't exist.</p></div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-6">{page.title}</h1>
      {page.content && <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(page.content) }} />}
    </div>
  );
}
