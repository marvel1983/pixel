import { Link, useParams } from "wouter";
import { CheckCircle, Download, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { CartProgress } from "@/components/cart/cart-progress";

export default function OrderCompletePage() {
  const params = useParams<{ orderNumber: string }>();
  const orderNumber = params.orderNumber ?? "";

  return (
    <div className="container mx-auto px-4 py-6">
      <Breadcrumbs
        crumbs={[
          { label: "Cart", href: "/cart" },
          { label: "Checkout", href: "/checkout" },
          { label: "Order Complete" },
        ]}
      />
      <CartProgress step={3} />

      <div className="max-w-lg mx-auto text-center py-8">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="h-10 w-10 text-green-600" />
        </div>

        <h1 className="text-2xl font-bold mb-2">Order Confirmed!</h1>
        <p className="text-muted-foreground mb-2">
          Thank you for your purchase. Your order has been placed successfully.
        </p>
        <p className="text-sm font-medium mb-6">
          Order Number: <span className="text-primary">{orderNumber}</span>
        </p>

        <div className="border rounded-lg p-5 mb-6 text-left">
          <h3 className="font-semibold mb-2">What happens next?</h3>
          <ol className="text-sm text-muted-foreground space-y-2 list-decimal pl-4">
            <li>Your license keys will be delivered to your email within minutes.</li>
            <li>Check your inbox (and spam folder) for the delivery email.</li>
            <li>Follow the activation instructions included in the email.</li>
            <li>If you created an account, you can view keys in your dashboard.</li>
          </ol>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/shop">
            <Button variant="outline">
              <ArrowRight className="h-4 w-4 mr-2" />
              Continue Shopping
            </Button>
          </Link>
          <Button disabled>
            <Download className="h-4 w-4 mr-2" />
            Download Invoice
          </Button>
        </div>
      </div>
    </div>
  );
}
