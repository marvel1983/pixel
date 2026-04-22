import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Star, ThumbsUp, MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/auth-store";
import { apiFetch } from "@/lib/api-client";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface ApiReview {
  id: number; rating: number; title: string | null; body: string | null;
  helpfulCount: number; createdAt: string; adminReply: string | null;
  adminReplyAt: string | null; author: string; reviewerTier?: string | null;
}

const TIER_COLORS: Record<string, string> = {
  BRONZE: "bg-amber-600 text-white", SILVER: "bg-slate-400 text-white",
  GOLD: "bg-yellow-500 text-white",  PLATINUM: "bg-violet-600 text-white",
};
const TIER_ICONS: Record<string, string> = {
  BRONZE: "🥉", SILVER: "🥈", GOLD: "🥇", PLATINUM: "💎",
};

const DISTRIBUTION = [5,4,3,2,1].map((s) => ({ stars: s, pct: [68,20,7,3,2][[5,4,3,2,1].indexOf(s)] }));
const SUB_RATINGS = [
  { label: "Value for Money", score: 4.7 }, { label: "Delivery Speed", score: 4.9 },
  { label: "Activation Ease", score: 4.6 }, { label: "Product Quality", score: 4.8 },
];

interface ReviewsSectionProps { productId: number; avgRating: number; reviewCount: number; }

export function ReviewsSection({ productId, avgRating, reviewCount }: ReviewsSectionProps) {
  const [list, setList] = useState<ApiReview[]>([]);
  const [apiAvg, setApiAvg] = useState<number | null>(null);
  const [apiCount, setApiCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetch(`${API}/products/${productId}/reviews`)
      .then((r) => r.json())
      .then((d) => {
        setList(Array.isArray(d.reviews) ? d.reviews : []);
        setApiAvg(typeof d.avgRating === "number" ? d.avgRating : parseFloat(d.avgRating) || 0);
        setApiCount(typeof d.reviewCount === "number" ? d.reviewCount : Number(d.reviewCount) || 0);
      })
      .catch(() => { setList([]); setApiAvg(null); setApiCount(null); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [productId]);

  const displayAvg = apiCount !== null && apiCount > 0 ? (apiAvg ?? avgRating) : apiCount === 0 ? 0 : avgRating;
  const displayCount = apiCount !== null ? apiCount : reviewCount;
  const hasReviews = displayCount > 0;

  return (
    <div className="space-y-6">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">
          Customer Reviews {hasReviews && <span className="text-muted-foreground font-normal text-base">({displayCount})</span>}
        </h2>
        <a href="#write-review" className="text-sm font-medium text-primary hover:underline flex items-center gap-1">
          <MessageSquarePlus className="h-4 w-4" /> Write a Review
        </a>
      </div>

      {/* Reviews area */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading reviews…</p>
      ) : hasReviews ? (
        <div className="grid gap-6 md:grid-cols-[220px_1fr]">
          <RatingSummary avgRating={displayAvg} reviewCount={displayCount} />
          <div className="space-y-3">
            {list.map((r) => <ReviewCard key={r.id} review={r} />)}
          </div>
        </div>
      ) : (
        /* Empty state */
        <div className="rounded-xl border border-border bg-card p-10 text-center space-y-3">
          <div className="flex justify-center gap-1 mb-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="h-7 w-7 text-muted-foreground/20" />
            ))}
          </div>
          <p className="font-semibold text-foreground">No reviews yet</p>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Be the first to review this product. Your feedback helps other customers.
          </p>
        </div>
      )}

      {/* Write a review */}
      <div id="write-review">
        <ReviewForm productId={productId} onSubmitted={load} />
      </div>
    </div>
  );
}

function Stars({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" }) {
  const cls = size === "md" ? "h-5 w-5" : "h-3.5 w-3.5";
  return (
    <div className="flex">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`${cls} ${i < Math.round(rating) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/25"}`} />
      ))}
    </div>
  );
}

function RatingSummary({ avgRating, reviewCount }: { avgRating: number; reviewCount: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4 text-center">
      <div>
        <div className="text-5xl font-extrabold text-foreground leading-none">{avgRating.toFixed(1)}</div>
        <div className="flex justify-center my-2"><Stars rating={avgRating} size="md" /></div>
        <p className="text-xs text-muted-foreground">{reviewCount} verified reviews</p>
      </div>
      <div className="space-y-1.5 text-left">
        {DISTRIBUTION.map((d) => (
          <div key={d.stars} className="flex items-center gap-2 text-xs">
            <span className="w-2 text-right text-muted-foreground">{d.stars}</span>
            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400 shrink-0" />
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-yellow-400 rounded-full transition-all" style={{ width: `${d.pct}%` }} />
            </div>
            <span className="w-7 text-right text-muted-foreground">{d.pct}%</span>
          </div>
        ))}
      </div>
      <div className="pt-2 border-t border-border space-y-2 text-left">
        {SUB_RATINGS.map((sr) => (
          <div key={sr.label} className="flex items-center justify-between text-xs gap-2">
            <span className="text-muted-foreground truncate">{sr.label}</span>
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="w-14 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: `${(sr.score / 5) * 100}%` }} />
              </div>
              <span className="font-semibold w-6 text-right">{sr.score}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewCard({ review }: { review: ApiReview }) {
  const initials = review.author.slice(0, 2).toUpperCase();
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
            {initials}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-foreground">{review.author}</span>
              {review.reviewerTier && TIER_COLORS[review.reviewerTier] && (
                <Badge className={`text-[10px] px-1.5 py-0 ${TIER_COLORS[review.reviewerTier]}`}>
                  {TIER_ICONS[review.reviewerTier]} {review.reviewerTier}
                </Badge>
              )}
            </div>
            <Stars rating={review.rating} />
          </div>
        </div>
        <span className="text-[11px] text-muted-foreground shrink-0 mt-1">
          {new Date(review.createdAt).toLocaleDateString()}
        </span>
      </div>
      {review.title && <p className="text-sm font-semibold text-foreground">{review.title}</p>}
      {review.body && <p className="text-sm text-muted-foreground leading-relaxed">{review.body}</p>}
      {review.adminReply && (
        <div className="rounded-lg bg-primary/5 border border-primary/15 p-3 text-sm">
          <p className="font-semibold text-primary text-xs mb-1">Store reply</p>
          <p className="text-muted-foreground text-xs leading-relaxed whitespace-pre-wrap">{review.adminReply}</p>
        </div>
      )}
      <button type="button" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors pt-1">
        <ThumbsUp className="h-3 w-3" /> Helpful ({review.helpfulCount})
      </button>
    </div>
  );
}

function ReviewForm({ productId, onSubmitted }: { productId: number; onSubmitted: () => void }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);

  if (!token) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 flex items-center gap-4">
        <MessageSquarePlus className="h-8 w-8 text-primary/40 shrink-0" />
        <div>
          <p className="font-semibold text-foreground mb-1">Share Your Experience</p>
          <p className="text-sm text-muted-foreground">
            <Link href="/login" className="text-primary font-medium underline underline-offset-2">Sign in</Link>{" "}
            to submit a review. It will be checked by our team before it appears.
          </p>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating < 1 || !body.trim()) return;
    setSubmitting(true);
    try {
      const res = await apiFetch("/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, rating, title: title.trim() || undefined, body: body.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: "Could not submit", description: typeof data.error === "string" ? data.error : "Please try again.", variant: "destructive" });
        return;
      }
      toast({ title: "Review submitted", description: data.message ?? "Your review will appear after moderation." });
      setRating(0); setTitle(""); setBody(""); onSubmitted();
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally { setSubmitting(false); }
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border bg-muted/30 flex items-center gap-2">
        <MessageSquarePlus className="h-4 w-4 text-primary" />
        <h3 className="font-bold text-foreground">Write a Review</h3>
      </div>
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <p className="text-xs text-muted-foreground">
          Posting as <span className="font-semibold text-foreground">{user?.email}</span> · Reviews are moderated before publication.
        </p>
        <div>
          <label className="text-sm font-medium text-foreground block mb-2">Your Rating</label>
          <div className="flex gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <button key={i} type="button" onMouseEnter={() => setHover(i + 1)} onMouseLeave={() => setHover(0)} onClick={() => setRating(i + 1)}>
                <Star className={`h-7 w-7 transition-colors ${i < (hover || rating) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/25 hover:text-yellow-300"}`} />
              </button>
            ))}
          </div>
        </div>
        <Input placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
        <Textarea placeholder="Write your review…" rows={4} required value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} />
        <Button type="submit" disabled={rating === 0 || submitting} className="w-full">
          {submitting ? "Submitting…" : "Submit Review"}
        </Button>
      </form>
    </div>
  );
}
