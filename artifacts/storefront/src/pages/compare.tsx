import { useEffect, useState } from "react";
import { Link } from "wouter";
import { GitCompareArrows, Trash2, ShoppingCart, Package, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { useCompareStore } from "@/stores/compare-store";
import { useCartStore } from "@/stores/cart-store";
import { useCurrencyStore } from "@/stores/currency-store";
import { useToast } from "@/hooks/use-toast";
import type { MockProduct } from "@/lib/mock-data";
import { MOCK_PRODUCTS } from "@/lib/mock-data";

const ATTRS: { label: string; render: (p: MockProduct) => React.ReactNode }[] = [
  {
    label: "Image",
    render: (p) => (
      <Link href={`/product/${p.slug}`} className="block">
        <div className="w-20 h-16 mx-auto bg-muted rounded flex items-center justify-center">
          {p.imageUrl ? (
            <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover rounded" />
          ) : (
            <Package className="h-8 w-8 text-muted-foreground/30" />
          )}
        </div>
      </Link>
    ),
  },
  {
    label: "Name",
    render: (p) => (
      <Link href={`/product/${p.slug}`} className="text-sm font-medium hover:text-primary">
        {p.name}
      </Link>
    ),
  },
  {
    label: "Description",
    render: (p) => <span className="text-xs text-muted-foreground">{p.description ?? "—"}</span>,
  },
  {
    label: "Price",
    render: (p) => {
      const v = p.variants[0];
      if (!v) return "—";
      return <PriceCell priceUsd={v.priceUsd} compareAt={v.compareAtPriceUsd} />;
    },
  },
  { label: "Category", render: (p) => <span className="text-sm capitalize">{p.categorySlug.replace(/-/g, " ")}</span> },
  { label: "Platform", render: (p) => <span className="text-sm">{p.variants[0]?.platform ?? "—"}</span> },
  {
    label: "Warranty",
    render: (p) => <span className="text-sm">{p.warranty ?? "—"}</span>,
  },
  {
    label: "Stock",
    render: (p) => {
      const stock = p.variants[0]?.stockCount ?? 0;
      return <Badge variant={stock > 0 ? "default" : "destructive"} className="text-xs">{stock > 0 ? "In Stock" : "Out of Stock"}</Badge>;
    },
  },
  {
    label: "Rating",
    render: (p) => (
      <div className="flex items-center gap-1">
        <Star className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" />
        <span className="text-sm">{p.avgRating}</span>
        <span className="text-xs text-muted-foreground">({p.reviewCount})</span>
      </div>
    ),
  },
  { label: "SKU", render: (p) => <span className="text-xs text-muted-foreground font-mono">{p.variants[0]?.sku ?? "—"}</span> },
];

function PriceCell({ priceUsd, compareAt }: { priceUsd: string; compareAt: string | null }) {
  const format = useCurrencyStore((s) => s.format);
  const price = parseFloat(priceUsd);
  const comp = compareAt ? parseFloat(compareAt) : null;
  return (
    <div>
      <span className="text-sm font-bold">{format(price)}</span>
      {comp && <span className="text-xs text-muted-foreground line-through ml-1">{format(comp)}</span>}
    </div>
  );
}

export default function ComparePage() {
  const { productIds, removeProduct, clearAll } = useCompareStore();
  const addItem = useCartStore((s) => s.addItem);
  const { toast } = useToast();
  const [products, setProducts] = useState<MockProduct[]>([]);

  useEffect(() => {
    if (productIds.length === 0) {
      setProducts([]);
      return;
    }
    const idSet = new Set(productIds);
    setProducts(MOCK_PRODUCTS.filter((p) => idSet.has(p.id)));
  }, [productIds]);

  function handleAddToCart(p: MockProduct) {
    const v = p.variants[0];
    if (!v) return;
    addItem({ variantId: v.id, productId: p.id, productName: p.name, variantName: v.name, imageUrl: p.imageUrl, priceUsd: v.priceUsd, platform: v.platform });
    toast({ title: `${p.name} added to cart` });
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <Breadcrumbs crumbs={[{ label: "Compare Products" }]} />

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <GitCompareArrows className="h-6 w-6" /> Compare Products
          {products.length > 0 && (
            <span className="text-base font-normal text-muted-foreground">({products.length}/4)</span>
          )}
        </h1>
        {products.length > 0 && (
          <Button variant="outline" size="sm" onClick={clearAll}>Clear All</Button>
        )}
      </div>

      {products.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <GitCompareArrows className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg mb-2">No products to compare</p>
          <p className="text-sm mb-4">Add up to 4 products to compare them side by side.</p>
          <Link href="/shop"><Button>Browse Products</Button></Link>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-left p-3 bg-muted/50 border-b w-32 text-sm font-medium">Attribute</th>
                {products.map((p) => (
                  <th key={p.id} className="p-3 bg-muted/50 border-b text-center min-w-[180px]">
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeProduct(p.id)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ATTRS.map((attr) => (
                <tr key={attr.label} className="border-b last:border-b-0">
                  <td className="p-3 text-sm font-medium text-muted-foreground bg-muted/30">{attr.label}</td>
                  {products.map((p) => (
                    <td key={p.id} className="p-3 text-center">{attr.render(p)}</td>
                  ))}
                </tr>
              ))}
              <tr>
                <td className="p-3 text-sm font-medium text-muted-foreground bg-muted/30">Action</td>
                {products.map((p) => (
                  <td key={p.id} className="p-3 text-center">
                    <Button size="sm" onClick={() => handleAddToCart(p)} disabled={!p.variants[0] || p.variants[0].stockCount === 0}>
                      <ShoppingCart className="h-3 w-3 mr-1" /> Add to Cart
                    </Button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
