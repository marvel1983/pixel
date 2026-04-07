import { Link } from "wouter";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/product/product-card";
import type { MockProduct } from "@/lib/mock-data";

interface BrandPartnerSectionProps {
  brandName: string;
  tagline: string;
  ctaLink: string;
  bgColor: string;
  products: MockProduct[];
}

export function BrandPartnerSection({
  brandName,
  tagline,
  ctaLink,
  bgColor,
  products,
}: BrandPartnerSectionProps) {
  if (products.length === 0) return null;

  return (
    <section className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
      <div
        className={`${bgColor} rounded-lg p-6 flex flex-col justify-center text-white min-h-[200px]`}
      >
        <h3 className="text-xl font-bold mb-2">{brandName}</h3>
        <p className="text-white/80 text-sm mb-4">{tagline}</p>
        <Link href={ctaLink}>
          <Button
            variant="outline"
            className="border-white text-white hover:bg-white/20 w-fit"
          >
            Shop {brandName}
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {products.slice(0, 4).map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
