import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { ChevronRight } from "lucide-react";
import { ProductCard } from "@/components/product/product-card";
import type { MockProduct } from "@/lib/mock-data";

interface CategoryRowProps {
  title: string;
  categorySlug: string;
  products: MockProduct[];
}

export function CategoryRow({ title, categorySlug, products }: CategoryRowProps) {
  const { t } = useTranslation();
  if (products.length === 0) return null;
  const row = products.slice(0, 5);

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-foreground leading-tight">{title}</h2>
        <Link
          href={`/category/${categorySlug}`}
          className="flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          {t("common.viewAll")}
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
      {/* Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {row.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}
