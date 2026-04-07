import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ProductCard } from "@/components/product/product-card";
import type { MockProduct } from "@/lib/mock-data";

interface RelatedProductsProps {
  products: MockProduct[];
}

export function RelatedProducts({ products }: RelatedProductsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (products.length === 0) return null;

  function scroll(dir: "left" | "right") {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({
      left: dir === "left" ? -220 : 220,
      behavior: "smooth",
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Related Products</h2>
        <div className="flex gap-1">
          <button
            onClick={() => scroll("left")}
            className="w-8 h-8 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => scroll("right")}
            className="w-8 h-8 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-2"
      >
        {products.map((product) => (
          <div
            key={product.id}
            className="min-w-[180px] max-w-[200px] snap-start shrink-0"
          >
            <ProductCard product={product} />
          </div>
        ))}
      </div>
    </div>
  );
}
