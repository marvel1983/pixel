import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet } from "lucide-react";
import { useWalletBalance } from "@/hooks/use-wallet-balance";

export function ProfileStoreCreditCard() {
  const { t } = useTranslation();
  const { balance, loading, loadFailed, refresh } = useWalletBalance();
  return (
    <Card className="mb-6 border-primary/15 bg-muted/30">
      <CardContent className="pt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Wallet className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">{t("accountPage.storeCreditTitle")}</p>
            {loadFailed && !loading ? (
              <div className="mt-1 space-y-2">
                <p className="text-sm text-destructive">{t("wallet.dataLoadFailed")}</p>
                <Button type="button" variant="outline" size="sm" onClick={() => void refresh()}>{t("wallet.retry")}</Button>
              </div>
            ) : (
              <>
                <p className="text-2xl font-bold tabular-nums">{loading && balance === null ? "…" : `$${(balance ?? 0).toFixed(2)}`}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t("accountPage.storeCreditHint")}</p>
              </>
            )}
          </div>
        </div>
        <Link href="/account/balance">
          <Button variant="secondary" className="w-full sm:w-auto">{t("accountPage.storeCreditManage")}</Button>
        </Link>
      </CardContent>
    </Card>
  );
}
