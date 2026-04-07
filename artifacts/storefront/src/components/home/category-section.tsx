import { Link } from "wouter";
import { ChevronRight } from "lucide-react";
import { ProductCard } from "@/components/product/product-card";
import type { MockProduct } from "@/lib/mock-data";

interface CategorySectionProps {
  title: string;
  categorySlug: string;
  products: MockProduct[];
}

export function CategorySection({
  title,
  categorySlug,
  products,
}: CategorySectionProps) {
  if (products.length === 0) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-foreground">{title}</h2>
        <Link
          href={`/category/${categorySlug}`}
          className="text-sm text-primary font-medium flex items-center gap-1 hover:underline"
        >
          View All
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {products.slice(0, 6).map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
