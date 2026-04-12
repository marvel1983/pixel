import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/auth-store";
import { apiFetch } from "@/lib/api-client";
import { Wallet, ArrowUpCircle, ArrowDownCircle, Loader2 } from "lucide-react";

interface WalletTx {
  id: number; type: string; amountUsd: string; balanceAfter: string;
  description: string | null; createdAt: string;
}
interface WalletData {
  wallet: { balanceUsd: string; totalDeposited: string; totalSpent: string };
  transactions: WalletTx[];
}

export function CustomerWallet({ userId }: { userId: number }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const token = useAuthStore((s) => s.token);
  const [data, setData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  const authHeaders = { Authorization: `Bearer ${token}` };

  async function load() {
    try {
      const res = await apiFetch(`/admin/wallet/${userId}`, { headers: authHeaders });
      if (res.ok) setData(await res.json());
    } catch {} finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [userId]);

  async function adjust(type: "TOPUP" | "CREDIT" | "DEBIT") {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0 || !reason.trim()) {
      toast({ title: t("adminWallet.amountReasonRequired"), variant: "destructive" });
      return;
    }
    setAdjusting(true);
    try {
      // Query + JSON body: server merges both; helps proxies and Express 5 mounted routes.
      const qs = new URLSearchParams();
      qs.set("type", type);
      qs.set("amountUsd", String(amt));
      qs.set("reason", reason.trim());
      const payload = { type, amountUsd: amt, reason: reason.trim() };
      const res = await apiFetch(`/admin/wallet/${userId}/adjust?${qs.toString()}`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const iss = body.issues as { formErrors?: string[]; fieldErrors?: Record<string, string[]> } | undefined;
        const detailBits = iss
          ? [...(iss.formErrors ?? []), ...Object.values(iss.fieldErrors ?? {}).flat()]
          : [];
        const hint = typeof body.hint === "string" ? body.hint : "";
        const code = typeof (body as { code?: string }).code === "string" ? (body as { code: string }).code : "";
        const gotJson = body && typeof body === "object" && Object.keys(body as object).length > 0;
        const staleApi = res.status === 400 && gotJson && !code;
        const description =
          [
            hint || detailBits.filter(Boolean).join(" • "),
            code && `[${code}]`,
            staleApi && "API response looks outdated — rebuild and restart the API process, then try again.",
          ]
            .filter(Boolean)
            .join(" ") || undefined;
        toast({
          title: body.error ?? t("adminWallet.adjustFailed"),
          description,
          variant: "destructive",
        });
        return;
      }
      setAmount(""); setReason("");
      toast({ title: t("adminWallet.adjustSuccess") });
      load();
    } catch {
      toast({ title: t("adminWallet.adjustFailed"), variant: "destructive" });
    } finally { setAdjusting(false); }
  }

  if (loading) return <div className="text-center py-4"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>;

  const balance = data?.wallet ? parseFloat(data.wallet.balanceUsd) : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Wallet className="h-5 w-5 text-primary" />
        <span className="text-2xl font-bold">${balance.toFixed(2)}</span>
      </div>
      {data?.wallet && (
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span>{t("adminWallet.deposited", { amount: parseFloat(data.wallet.totalDeposited).toFixed(2) })}</span>
          <span>{t("adminWallet.spent", { amount: parseFloat(data.wallet.totalSpent).toFixed(2) })}</span>
        </div>
      )}
      <div className="flex gap-2 items-end">
        <div className="flex-1 space-y-1">
          <Input type="number" min="0.01" step="0.01" placeholder={t("adminWallet.amountPlaceholder")} value={amount}
            onChange={(e) => setAmount(e.target.value)} className="h-8" />
          <Input placeholder={t("adminWallet.reasonPlaceholder")} value={reason} onChange={(e) => setReason(e.target.value)} className="h-8" />
        </div>
        <div className="flex flex-col gap-1">
          <Button size="sm" variant="default" onClick={() => void adjust("TOPUP")} disabled={adjusting}>
            {t("adminWallet.topUp")}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => void adjust("CREDIT")} disabled={adjusting}>
            {t("adminWallet.creditOnly")}
          </Button>
          <Button size="sm" variant="outline" onClick={() => void adjust("DEBIT")} disabled={adjusting}>
            {t("adminWallet.debit")}
          </Button>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">{t("adminWallet.topUpVsCreditHint")}</p>
      {data?.transactions && data.transactions.length > 0 && (
        <div className="max-h-48 overflow-y-auto text-xs space-y-1 border rounded p-2">
          {data.transactions.slice(0, 20).map((tx) => {
            const isCredit = parseFloat(tx.amountUsd) > 0;
            return (
              <div key={tx.id} className="flex justify-between items-center">
                <div className="flex items-center gap-1">
                  {isCredit ? <ArrowDownCircle className="h-3 w-3 text-green-500" /> : <ArrowUpCircle className="h-3 w-3 text-orange-500" />}
                  <span className="truncate max-w-[200px]">{tx.description || tx.type}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={isCredit ? "text-green-600" : "text-orange-600"}>
                    {isCredit ? "+" : ""}${Math.abs(parseFloat(tx.amountUsd)).toFixed(2)}
                  </span>
                  <Badge variant="outline" className="text-[10px]">{new Date(tx.createdAt).toLocaleDateString()}</Badge>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
