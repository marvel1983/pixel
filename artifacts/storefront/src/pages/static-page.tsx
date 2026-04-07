import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import DOMPurify from "dompurify";
import NotFound from "./not-found";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface PageData {
  title: string; content: string | null;
  metaTitle: string | null; metaDescription: string | null;
}

export default function StaticPageView() {
  const [location] = useLocation();
  const slug = location.replace(/^\//, "").replace(/\/$/, "");
  const [page, setPage] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) { setNotFound(true); setLoading(false); return; }
    setLoading(true);
    setNotFound(false);
    fetch(`${API}/pages/${slug}`)
      .then(async (r) => {
        if (!r.ok) { setNotFound(true); return; }
        const d = await r.json();
        setPage(d.page);
        if (d.page.metaTitle) document.title = d.page.metaTitle;
        else document.title = `${d.page.title} - PixelCodes`;
      })
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <div className="max-w-4xl mx-auto px-4 py-12 space-y-4"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-5/6" /></div>;
  if (notFound || !page) return <NotFound />;

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-6">{page.title}</h1>
      {page.content && <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(page.content) }} />}
    </div>
  );
}
