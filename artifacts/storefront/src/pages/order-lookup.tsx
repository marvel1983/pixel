import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { OrderDetail } from "@/components/orders/order-detail";
import { useToast } from "@/hooks/use-toast";

interface OrderResponse {
  order: {
    orderNumber: string;
    status: string;
    subtotalUsd: string;
    discountUsd: string;
    totalUsd: string;
    paymentMethod: string;
    createdAt: string;
  };
  items: {
    id: number;
    productName: string;
    variantName: string;
    priceUsd: string;
    quantity: number;
  }[];
  licenseKeys: {
    orderItemId: number;
    productName: string;
    variantName: string;
    quantity: number;
    keys: { id: number; value: string; status: string }[];
  }[];
}

export default function OrderLookupPage() {
  const { t } = useTranslation();
  const [orderNumber, setOrderNumber] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OrderResponse | null>(null);
  const [searched, setSearched] = useState(false);
  const { toast } = useToast();

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!orderNumber.trim() || !email.trim()) return;

    setLoading(true);
    setSearched(true);
    setResult(null);

    try {
      const baseUrl = import.meta.env.VITE_API_URL ?? "/api";
      const res = await fetch(`${baseUrl}/orders/lookup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber: orderNumber.trim(), email: email.trim() }),
      });

      if (res.ok) {
        setResult(await res.json());
      } else {
        toast({
          title: t("orderLookup.notFound"),
          description: t("orderLookup.notFoundDesc"),
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: t("orderLookup.lookupFailed"),
        description: t("orderLookup.tryAgain"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <Breadcrumbs crumbs={[{ label: t("orderLookup.title") }]} />

      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">{t("orderLookup.title")}</h1>
        <p className="text-muted-foreground mb-6">{t("orderLookup.subtitle")}</p>

        <form onSubmit={handleSearch} className="border rounded-lg p-5 mb-8 space-y-4">
          <div>
            <Label htmlFor="orderNumber">{t("orderLookup.orderNumber")}</Label>
            <Input
              id="orderNumber"
              placeholder="PC-XXXXXXXX-XXXX"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="email">{t("orderLookup.email")}</Label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("orderLookup.searching")}</>
            ) : (
              <><Search className="h-4 w-4 mr-2" />{t("orderLookup.lookUp")}</>
            )}
          </Button>
        </form>

        {result && (
          <OrderDetail
            order={result.order}
            items={result.items}
            licenseKeys={result.licenseKeys}
          />
        )}

        {searched && !loading && !result && (
          <div className="text-center py-8 text-muted-foreground">
            <Search className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>{t("orderLookup.noOrder")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
