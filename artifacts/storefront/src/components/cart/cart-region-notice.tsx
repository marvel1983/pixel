import { AlertTriangle, X } from "lucide-react";
import { useState } from "react";
import type { CartItem } from "@/stores/cart-store";

interface CartRegionNoticeProps {
  items: CartItem[];
}

export function CartRegionNotice({ items }: CartRegionNoticeProps) {
  const [dismissed, setDismissed] = useState(false);

  const restricted = items.filter(
    (i) => i.regionRestrictions && i.regionRestrictions.length > 0 && !i.regionRestrictions.includes("GLOBAL")
  );

  if (dismissed || restricted.length === 0) return null;

  return (
    <div className="border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Region-Restricted Items</p>
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
            The following items are region-locked and may only be activated in certain regions. Region compatibility will be verified at checkout.
          </p>
          <ul className="mt-2 space-y-1">
            {restricted.map((i) => (
              <li key={`${i.bundleId ?? "s"}-${i.variantId}`} className="text-sm text-amber-700 dark:text-amber-300 flex items-center gap-2">
                <span className="font-medium">{i.productName}</span>
                <span className="text-xs text-amber-500 bg-amber-100 dark:bg-amber-900 px-1.5 py-0.5 rounded">
                  {i.regionRestrictions?.join(", ")} only
                </span>
              </li>
            ))}
          </ul>
        </div>
        <button onClick={() => setDismissed(true)} className="text-amber-500 hover:text-amber-700 dark:hover:text-amber-300">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
