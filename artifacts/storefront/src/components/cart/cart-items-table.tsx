import { Package, Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCartStore, type CartItem } from "@/stores/cart-store";
import { useCurrencyStore } from "@/stores/currency-store";

export function CartItemsTable() {
  const items = useCartStore((s) => s.items);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const { format } = useCurrencyStore();

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="hidden sm:grid grid-cols-[1fr_120px_140px_100px_40px] gap-4 px-4 py-3 bg-muted/50 text-xs font-semibold text-muted-foreground uppercase">
        <span>Product</span>
        <span className="text-center">Price</span>
        <span className="text-center">Quantity</span>
        <span className="text-right">Subtotal</span>
        <span />
      </div>

      {items.map((item) => (
        <CartRow
          key={item.variantId}
          item={item}
          format={format}
          onUpdateQuantity={updateQuantity}
          onRemove={removeItem}
        />
      ))}
    </div>
  );
}

interface CartRowProps {
  item: CartItem;
  format: (usd: number) => string;
  onUpdateQuantity: (variantId: number, qty: number) => void;
  onRemove: (variantId: number) => void;
}

function CartRow({ item, format, onUpdateQuantity, onRemove }: CartRowProps) {
  const price = parseFloat(item.priceUsd);
  const subtotal = price * item.quantity;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_140px_100px_40px] gap-3 sm:gap-4 px-4 py-4 border-t items-center">
      <div className="flex items-center gap-3">
        <div className="w-14 h-14 rounded bg-muted flex items-center justify-center shrink-0">
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={item.productName}
              className="w-full h-full object-contain rounded"
            />
          ) : (
            <Package className="h-6 w-6 text-muted-foreground/40" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{item.productName}</p>
          <p className="text-xs text-muted-foreground">{item.variantName}</p>
          {item.platform && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {item.platform}
            </span>
          )}
        </div>
      </div>

      <div className="text-sm text-center font-medium">
        {format(price)}
      </div>

      <div className="flex items-center justify-center">
        <div className="flex items-center border rounded">
          <button
            className="px-2 py-1 hover:bg-muted transition-colors"
            onClick={() => onUpdateQuantity(item.variantId, item.quantity - 1)}
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="px-3 py-1 text-sm font-medium min-w-[36px] text-center">
            {item.quantity}
          </span>
          <button
            className="px-2 py-1 hover:bg-muted transition-colors"
            onClick={() => onUpdateQuantity(item.variantId, item.quantity + 1)}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="text-sm text-right font-semibold">
        {format(subtotal)}
      </div>

      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={() => onRemove(item.variantId)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
