import { useId, useRef, useState } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/product/product-card";
import type { MockProduct } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

interface BrandPartnerSectionProps {
  brandName: string;
  tagline: string;
  ctaLink: string;
  bgColor: string;
  bannerImage?: string;
  products: MockProduct[];
}

function BrandPanelBackdrop({ className }: { className?: string }) {
  const pid = useId().replace(/:/g, "");
  const gridUrl = `url(#${pid})`;
  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden>
      <div className="absolute -right-6 top-0 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
      <div className="absolute -left-4 bottom-0 h-48 w-48 rounded-full bg-black/20 blur-3xl" />
      <svg className="absolute inset-0 h-full w-full opacity-[0.12]" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <pattern id={pid} width="8" height="8" patternUnits="userSpaceOnUse">
            <path d="M 8 0 L 0 0 0 8" fill="none" stroke="white" strokeWidth="0.3" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={gridUrl} />
      </svg>
    </div>
  );
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
  const [imgFailed, setImgFailed] = useState(false);

  if (products.length === 0) return null;

  const showImage = Boolean(bannerImage) && !imgFailed;

  function scroll(dir: "left" | "right") {
    if (!scrollRef.current) return;
    const amount = 220;
    scrollRef.current.scrollBy({
      left: dir === "left" ? -amount : amount,
      behavior: "smooth",
    });
  }

  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(240px,280px)_1fr]">
      <div
        className={`${bgColor} relative flex min-h-[200px] flex-col justify-end overflow-hidden rounded-xl p-6 text-white`}
      >
        {showImage ? (
          <>
            <img
              src={bannerImage}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              onError={() => setImgFailed(true)}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent" />
          </>
        ) : (
          <BrandPanelBackdrop />
        )}
        <div className="relative z-10">
          <h3 className="mb-2 text-xl font-bold">{brandName}</h3>
          <p className="mb-4 text-sm text-white/85">{tagline}</p>
          <Link href={ctaLink}>
            <Button variant="outline" className="w-fit border-white text-white hover:bg-white/20">
              {t("home.shopBrand", { brand: brandName })}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => scroll("left")}
          className="absolute left-0 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card/95 shadow-md opacity-90 transition-opacity hover:bg-muted hover:opacity-100"
          aria-label={t("common.previous")}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div
          ref={scrollRef}
          className="scrollbar-hide flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory"
        >
          {products.map((product) => (
            <div key={product.id} className="min-w-[180px] max-w-[200px] shrink-0 snap-start">
              <ProductCard product={product} />
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => scroll("right")}
          className="absolute right-0 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card/95 shadow-md opacity-90 transition-opacity hover:bg-muted hover:opacity-100"
          aria-label={t("common.next")}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}
