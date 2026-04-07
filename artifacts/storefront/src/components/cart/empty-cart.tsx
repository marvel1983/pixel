import { Link } from "wouter";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmptyCart() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center mb-6">
        <ShoppingCart className="h-10 w-10 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-bold text-foreground mb-2">
        Your cart is empty
      </h2>
      <p className="text-muted-foreground text-sm mb-6 max-w-sm">
        Looks like you haven't added any products yet. Browse our catalog to
        find the best software deals.
      </p>
      <Link href="/shop">
        <Button size="lg">Return to Shop</Button>
      </Link>
    </div>
  );
}
