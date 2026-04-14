import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Star, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/auth-store";
import { apiFetch } from "@/lib/api-client";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface ApiReview {
  id: number;
  rating: number;
  title: string | null;
  body: string | null;
  helpfulCount: number;
  createdAt: string;
  adminReply: string | null;
  adminReplyAt: string | null;
  author: string;
  reviewerTier?: string | null;
}

const TIER_BADGE_COLORS: Record<string, string> = {
  BRONZE: "bg-amber-600 text-white",
  SILVER: "bg-slate-400 text-white",
  GOLD: "bg-yellow-500 text-white",
  PLATINUM: "bg-violet-600 text-white",
};

const TIER_ICONS: Record<string, string> = {
  BRONZE: "🥉",
  SILVER: "🥈",
  GOLD: "🥇",
  PLATINUM: "💎",
};

interface ReviewsSectionProps {
  productId: number;
  avgRating: number;
  reviewCount: number;
}

const DISTRIBUTION = [
  { stars: 5, pct: 68 },
  { stars: 4, pct: 20 },
  { stars: 3, pct: 7 },
  { stars: 2, pct: 3 },
  { stars: 1, pct: 2 },
];

const SUB_RATINGS = [
  { label: "Value for Money", score: 4.7 },
  { label: "Delivery Speed", score: 4.9 },
  { label: "Activation Ease", score: 4.6 },
  { label: "Product Quality", score: 4.8 },
];

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
      .catch(() => {
        setList([]);
        setApiAvg(null);
        setApiCount(null);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [productId]);

  /** When the API returns zero published reviews, don't fall back to PDP aggregate (avoids "342 reviews" + empty list). */
  const displayAvg =
    apiCount !== null && apiCount > 0 ? apiAvg ?? avgRating : apiCount === 0 ? apiAvg ?? 0 : avgRating;
  const displayCount =
    apiCount !== null && apiCount > 0 ? apiCount : apiCount === 0 ? 0 : reviewCount;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Customer Reviews</h2>
      <div className="grid gap-6 md:grid-cols-[240px_1fr]">
        <RatingSummary avgRating={displayAvg} reviewCount={displayCount} />
        <div className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading reviews…</p>
          ) : list.length === 0 ? (
            <p className="text-sm text-muted-foreground">No published reviews yet. Be the first after moderation approves one.</p>
          ) : (
            list.map((review) => <ReviewCard key={review.id} review={review} />)
          )}
        </div>
      </div>
      <Separator />
      <ReviewForm productId={productId} onSubmitted={load} />
    </div>
  );
}

function RatingSummary({ avgRating, reviewCount }: { avgRating: number; reviewCount: number }) {
  return (
    <div className="space-y-3">
      <div className="text-center">
        <div className="text-4xl font-bold">{avgRating.toFixed(1)}</div>
        <div className="flex justify-center my-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={`h-4 w-4 ${i < Math.round(avgRating) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`}
            />
          ))}
        </div>
        <p className="text-sm text-muted-foreground">{reviewCount} reviews</p>
      </div>
      <div className="space-y-1.5">
        {DISTRIBUTION.map((d) => (
          <div key={d.stars} className="flex items-center gap-2 text-xs">
            <span className="w-3">{d.stars}</span>
            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${d.pct}%` }} />
            </div>
            <span className="w-8 text-right text-muted-foreground">{d.pct}%</span>
          </div>
        ))}
      </div>
      <div className="pt-2 space-y-2">
        {SUB_RATINGS.map((sr) => (
          <div key={sr.label} className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{sr.label}</span>
            <div className="flex items-center gap-1.5">
              <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: `${(sr.score / 5) * 100}%` }} />
              </div>
              <span className="font-medium w-6 text-right">{sr.score}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewCard({ review }: { review: ApiReview }) {
  return (
    <div className="border rounded-lg p-4 space-y-2">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={`h-3.5 w-3.5 ${i < review.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`}
              />
            ))}
          </div>
          <span className="text-sm font-medium">{review.author}</span>
          {review.reviewerTier && TIER_BADGE_COLORS[review.reviewerTier] && (
            <Badge className={`text-xs px-1.5 py-0 ${TIER_BADGE_COLORS[review.reviewerTier]}`}>
              {TIER_ICONS[review.reviewerTier]} {review.reviewerTier}
            </Badge>
          )}
        </div>
        <span className="text-xs text-muted-foreground">{new Date(review.createdAt).toLocaleDateString()}</span>
      </div>
      {review.title && <p className="text-sm font-semibold">{review.title}</p>}
      <p className="text-sm text-muted-foreground">{review.body}</p>
      {review.adminReply && (
        <div className="mt-2 rounded-md bg-muted/60 p-3 text-sm">
          <p className="font-medium text-foreground mb-1">Store reply</p>
          <p className="text-muted-foreground whitespace-pre-wrap">{review.adminReply}</p>
        </div>
      )}
      <button type="button" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
        <ThumbsUp className="h-3 w-3" />
        Helpful ({review.helpfulCount})
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
      <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
        <h3 className="text-lg font-semibold">Write a Review</h3>
        <p className="text-sm text-muted-foreground">
          <Link href="/login" className="text-primary font-medium underline underline-offset-2">
            Sign in
          </Link>{" "}
          to submit a review. It will be checked by our team before it appears on the page.
        </p>
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
        body: JSON.stringify({
          productId,
          rating,
          title: title.trim() || undefined,
          body: body.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({
          title: "Could not submit",
          description: typeof data.error === "string" ? data.error : "Please try again.",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Review submitted",
        description: data.message ?? "Your review will appear after moderation.",
      });
      setRating(0);
      setTitle("");
      setBody("");
      onSubmitted();
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="text-lg font-semibold">Write a Review</h3>
      <p className="text-xs text-muted-foreground">
        Posting as <span className="font-medium text-foreground">{user?.email}</span>. Reviews are moderated before publication.
      </p>
      <div>
        <label className="text-sm font-medium block mb-1">Rating</label>
        <div className="flex gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <button
              key={i}
              type="button"
              onMouseEnter={() => setHover(i + 1)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setRating(i + 1)}
            >
              <Star
                className={`h-6 w-6 cursor-pointer transition-colors ${
                  i < (hover || rating) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"
                }`}
              />
            </button>
          ))}
        </div>
      </div>
      <Input placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
      <Textarea
        placeholder="Write your review..."
        rows={4}
        required
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={5000}
      />
      <Button type="submit" disabled={rating === 0 || submitting}>
        {submitting ? "Submitting…" : "Submit Review"}
      </Button>
    </form>
  );
}
