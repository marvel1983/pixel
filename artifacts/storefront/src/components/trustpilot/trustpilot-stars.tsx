import { Star, StarHalf } from "lucide-react";

interface TrustpilotStarsProps {
  rating: number;
  size?: "sm" | "md" | "lg";
}

const sizeMap = { sm: "h-3.5 w-3.5", md: "h-4 w-4", lg: "h-5 w-5" };

export function TrustpilotStars({ rating, size = "md" }: TrustpilotStarsProps) {
  const cls = sizeMap[size];
  const fullStars = Math.floor(rating);
  const hasHalf = rating - fullStars >= 0.25 && rating - fullStars < 0.75;
  const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);

  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: fullStars }).map((_, i) => (
        <Star key={`f-${i}`} className={`${cls} fill-green-500 text-green-500`} />
      ))}
      {hasHalf && <StarHalf className={`${cls} fill-green-500 text-green-500`} />}
      {Array.from({ length: emptyStars }).map((_, i) => (
        <Star key={`e-${i}`} className={`${cls} text-gray-300`} />
      ))}
    </div>
  );
}

export function TrustpilotLogo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 font-bold ${className}`}>
      <span className="bg-green-500 text-white px-1 py-0.5 rounded text-xs">★</span>
      <span>Trustpilot</span>
    </span>
  );
}
