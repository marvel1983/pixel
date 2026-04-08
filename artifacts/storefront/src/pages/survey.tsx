import { useState, useEffect } from "react";
import { useParams, useSearch } from "wouter";
import { Star, CheckCircle, AlertTriangle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

const API = import.meta.env.VITE_API_URL ?? "/api";

export default function SurveyPage() {
  const params = useParams<{ token: string }>();
  const search = useSearch();
  const preRating = new URLSearchParams(search).get("r");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [rating, setRating] = useState(preRating ? parseInt(preRating, 10) : 0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [finalRating, setFinalRating] = useState(0);

  useEffect(() => {
    fetch(`${API}/survey/${params.token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else if (data.submitted) { setSubmitted(true); setFinalRating(data.rating ?? 0); }
        else {
          if (data.rating && !preRating) setRating(data.rating);
          if (data.comment) setComment(data.comment);
        }
      })
      .catch(() => setError("Failed to load survey"))
      .finally(() => setLoading(false));
  }, [params.token]);

  const handleSubmit = async () => {
    if (rating < 1) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/survey/${params.token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment: comment.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Submit failed"); return; }
      setSubmitted(true);
      setFinalRating(rating);
    } catch {
      setError("Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" /></div>;
  if (error) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center"><AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-3" /><p className="text-lg font-medium">{error}</p></div>
    </div>
  );

  if (submitted) return <ThankYouView rating={finalRating} />;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 space-y-6">
        <div className="text-center">
          <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Star className="h-7 w-7 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold">How was your experience?</h1>
          <p className="text-muted-foreground mt-1">Your feedback helps us improve</p>
        </div>
        <div className="flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => setRating(n)} onMouseEnter={() => setHoveredStar(n)} onMouseLeave={() => setHoveredStar(0)}
              className="transition-transform hover:scale-110 focus:outline-none">
              <Star className={`h-10 w-10 transition-colors ${n <= (hoveredStar || rating) ? "fill-amber-400 text-amber-400" : "text-gray-300"}`} />
            </button>
          ))}
        </div>
        {rating > 0 && (
          <p className="text-center text-sm font-medium text-muted-foreground">
            {rating <= 2 ? "We're sorry to hear that" : rating === 3 ? "Thanks for the feedback" : rating === 4 ? "Glad you liked it!" : "Awesome! Thank you!"}
          </p>
        )}
        <div>
          <label className="text-sm font-medium mb-1 block">Tell us more (optional)</label>
          <textarea className="w-full border rounded-lg px-3 py-2 text-sm min-h-[100px] resize-y bg-background focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={comment} onChange={(e) => setComment(e.target.value)} placeholder="What went well? What could we improve?" maxLength={2000} />
        </div>
        <Button onClick={handleSubmit} disabled={rating < 1 || submitting} className="w-full" size="lg">
          {submitting ? "Submitting..." : "Submit Feedback"}
        </Button>
      </div>
    </div>
  );
}

function ThankYouView({ rating }: { rating: number }) {
  const isLow = rating <= 2;
  const isHigh = rating >= 5;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center space-y-4">
        <CheckCircle className={`h-16 w-16 mx-auto ${isLow ? "text-amber-500" : "text-green-500"}`} />
        <h1 className="text-2xl font-bold">{isLow ? "We hear you" : "Thank you!"}</h1>
        {isLow && (
          <>
            <p className="text-muted-foreground">We're sorry your experience wasn't great. A support agent will reach out to help resolve any issues.</p>
            <p className="text-sm text-blue-600 font-medium">A support ticket has been created for follow-up.</p>
          </>
        )}
        {!isLow && !isHigh && <p className="text-muted-foreground">Your feedback helps us improve. Thank you for taking the time to share!</p>}
        {isHigh && (
          <>
            <p className="text-muted-foreground">We're thrilled you had a great experience! Would you consider sharing it on Trustpilot?</p>
            <a href="https://www.trustpilot.com" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-green-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-green-700 transition-colors">
              Leave a Trustpilot Review <ExternalLink className="h-4 w-4" />
            </a>
          </>
        )}
        <div className="pt-4">
          <a href="/" className="text-sm text-blue-600 hover:underline">← Back to PixelCodes</a>
        </div>
      </div>
    </div>
  );
}
