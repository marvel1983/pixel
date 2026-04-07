import { useState } from "react";
import { Star, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

interface ReviewsSectionProps {
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

const MOCK_REVIEWS = [
  { id: 1, author: "John D.", rating: 5, date: "2025-12-10", text: "Key activated instantly. Great price for a genuine license!", helpful: 24 },
  { id: 2, author: "Sarah M.", rating: 4, date: "2025-11-28", text: "Fast delivery and easy activation. Would buy again.", helpful: 12 },
  { id: 3, author: "Alex K.", rating: 5, date: "2025-11-15", text: "Best deal I've found online. Legitimate key, no issues at all.", helpful: 8 },
];

export function ReviewsSection({ avgRating, reviewCount }: ReviewsSectionProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Customer Reviews</h2>
      <div className="grid gap-6 md:grid-cols-[240px_1fr]">
        <RatingSummary avgRating={avgRating} reviewCount={reviewCount} />
        <div className="space-y-4">
          {MOCK_REVIEWS.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      </div>
      <Separator />
      <ReviewForm />
    </div>
  );
}

function RatingSummary({ avgRating, reviewCount }: { avgRating: number; reviewCount: number }) {
  return (
    <div className="space-y-3">
      <div className="text-center">
        <div className="text-4xl font-bold">{avgRating}</div>
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
              <div
                className="h-full bg-yellow-400 rounded-full"
                style={{ width: `${d.pct}%` }}
              />
            </div>
            <span className="w-8 text-right text-muted-foreground">{d.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewCard({ review }: { review: typeof MOCK_REVIEWS[0] }) {
  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="flex">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={`h-3.5 w-3.5 ${i < review.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`}
              />
            ))}
          </div>
          <span className="text-sm font-medium">{review.author}</span>
        </div>
        <span className="text-xs text-muted-foreground">{review.date}</span>
      </div>
      <p className="text-sm text-muted-foreground mb-2">{review.text}</p>
      <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
        <ThumbsUp className="h-3 w-3" />
        Helpful ({review.helpful})
      </button>
    </div>
  );
}

function ReviewForm() {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const { toast } = useToast();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    toast({ title: "Review submitted", description: "Your review will appear after moderation." });
    (e.target as HTMLFormElement).reset();
    setRating(0);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="text-lg font-semibold">Write a Review</h3>
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
      <div className="grid gap-3 sm:grid-cols-2">
        <Input placeholder="Your name" required />
        <Input type="email" placeholder="Email (not published)" required />
      </div>
      <Textarea placeholder="Write your review..." rows={4} required />
      <Button type="submit" disabled={rating === 0}>
        Submit Review
      </Button>
    </form>
  );
}
