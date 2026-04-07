import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProductCard } from "@/components/product/product-card";
import { ListingPagination } from "./listing-pagination";
import type { MockProduct } from "@/lib/mock-data";

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "name-asc", label: "Name A-Z" },
  { value: "name-desc", label: "Name Z-A" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
];

interface ProductGridProps {
  products: MockProduct[];
  totalItems: number;
  currentPage: number;
  totalPages: number;
  sort: string;
  onSortChange: (sort: string) => void;
  onPageChange: (page: number) => void;
}

export function ProductGrid({
  products,
  totalItems,
  currentPage,
  totalPages,
  sort,
  onSortChange,
  onPageChange,
}: ProductGridProps) {
  return (
    <div className="flex-1">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          {totalItems} {totalItems === 1 ? "product" : "products"} found
        </p>
        <Select value={sort} onValueChange={onSortChange}>
          <SelectTrigger className="w-44 h-9">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-lg font-medium text-foreground">
            No products found
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Try adjusting your filters
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <ListingPagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
}
