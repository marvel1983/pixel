import { useRef } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/product/product-card";
import type { MockProduct } from "@/lib/mock-data";

interface BrandPartnerSectionProps {
  brandName: string;
  tagline: string;
  ctaLink: string;
  bgColor: string;
  bannerImage?: string;
  products: MockProduct[];
}

export function BrandPartnerSection({
  brandName,
  tagline,
  ctaLink,
  bgColor,
  bannerImage,
  products,
}: BrandPartnerSectionProps) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);

  if (products.length === 0) return null;

  function scroll(dir: "left" | "right") {
    if (!scrollRef.current) return;
    const amount = 220;
    scrollRef.current.scrollBy({
      left: dir === "left" ? -amount : amount,
      behavior: "smooth",
    });
  }

  return (
    <section className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
      <div
        className={`${bgColor} rounded-lg p-6 flex flex-col justify-end text-white min-h-[200px] relative overflow-hidden`}
      >
        {bannerImage && (
          <>
            <img src={bannerImage} alt={brandName} className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
          </>
        )}
        <div className="relative z-10">
          <h3 className="text-xl font-bold mb-2">{brandName}</h3>
          <p className="text-white/80 text-sm mb-4">{tagline}</p>
          <Link href={ctaLink}>
            <Button
              variant="outline"
              className="border-white text-white hover:bg-white/20 w-fit"
            >
              {t("home.shopBrand", { brand: brandName })}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
      </div>

      <div className="relative group">
        <button
          onClick={() => scroll("left")}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white shadow-md border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Scroll left"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

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

        <button
          onClick={() => scroll("right")}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white shadow-md border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Scroll right"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}
