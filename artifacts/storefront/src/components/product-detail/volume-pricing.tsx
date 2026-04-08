import { useState, useEffect } from "react";
import { Package, ChevronDown, ChevronUp } from "lucide-react";
import { useCurrencyStore } from "@/stores/currency-store";
import { Link } from "wouter";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface Tier {
  id: number;
  productId: number | null;
  minQty: number;
  maxQty: number | null;
  discountPercent: string;
}

interface VolumePricingProps {
  productId: number;
  basePrice: string;
}

export function VolumePricing({ productId, basePrice }: VolumePricingProps) {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [expanded, setExpanded] = useState(false);
  const format = useCurrencyStore((s) => s.format);
  const base = parseFloat(basePrice);

  useEffect(() => {
    fetch(`${API}/bulk-pricing/${productId}`)
      .then((r) => r.json())
      .then((d) => { if (d.tiers?.length) setTiers(d.tiers); })
      .catch(() => {});
  }, [productId]);

  if (tiers.length === 0) return null;

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-300">
          <Package className="h-4 w-4" />
          Bulk pricing available — Save up to {Math.max(...tiers.map((t) => parseFloat(t.discountPercent)))}%
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-blue-500" /> : <ChevronDown className="h-4 w-4 text-blue-500" />}
      </button>
      {expanded && (
        <div className="p-3 space-y-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground text-xs">
                <th className="text-left py-1 font-medium">Quantity</th>
                <th className="text-right py-1 font-medium">Discount</th>
                <th className="text-right py-1 font-medium">Unit Price</th>
              </tr>
            </thead>
            <tbody>
              {tiers.map((tier) => {
                const disc = parseFloat(tier.discountPercent);
                const unitPrice = base * (1 - disc / 100);
                const rangeLabel = tier.maxQty ? `${tier.minQty}–${tier.maxQty}` : `${tier.minQty}+`;
                return (
                  <tr key={tier.id} className="border-t">
                    <td className="py-1.5 font-medium">{rangeLabel}</td>
                    <td className="py-1.5 text-right text-green-600 font-medium">-{disc}%</td>
                    <td className="py-1.5 text-right font-semibold">{format(unitPrice)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="pt-2 border-t">
            <Link href="/business" className="text-xs text-blue-600 hover:underline">
              Need 50+ units? Request a custom quote →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
