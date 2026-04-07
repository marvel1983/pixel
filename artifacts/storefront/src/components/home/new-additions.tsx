import { ProductCard } from "@/components/product/product-card";
import type { MockProduct } from "@/lib/mock-data";

interface NewAdditionsProps {
  products: MockProduct[];
}

export function NewAdditions({ products }: NewAdditionsProps) {
  if (products.length === 0) return null;

  return (
    <section>
      <h2 className="text-lg font-bold text-foreground mb-4">New Additions</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {products.slice(0, 6).map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
