import { Gift, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export interface Transaction {
  id: number;
  type: string;
  points: number;
  balanceAfter?: number;
  balance?: number;
  description: string;
  createdAt: string;
  orderId?: number | null;
}

export const PAGE_SIZE = 20;

const TX_TYPE_ICONS: Record<string, string> = {
  EARN: "⬆️", REDEEM: "⬇️", EXPIRE: "❌", EXPIRED: "❌", ADMIN: "⚙️", ADJUST: "⚙️", REFUND: "🔄",
};

const TX_FILTER_OPTIONS = [
  { label: "All", value: "ALL" }, { label: "Earned", value: "EARN" },
  { label: "Redeemed", value: "REDEEM" }, { label: "Expired", value: "EXPIRE" },
  { label: "Adjusted", value: "ADMIN" },
];

function SkeletonRow() {
  return (
    <div className="flex items-center justify-between py-3 animate-pulse">
      <div className="space-y-1.5">
        <div className="h-3.5 w-48 bg-muted rounded" />
        <div className="h-3 w-24 bg-muted rounded" />
        <div className="h-3 w-32 bg-muted rounded" />
      </div>
      <div className="h-4 w-12 bg-muted rounded" />
    </div>
  );
}

interface Props {
  transactions: Transaction[];
  txLoading: boolean;
  txFilter: string;
  page: number;
  totalPages: number;
  onFilterChange: (value: string) => void;
  onPageChange: (page: number) => void;
}

export function LoyaltyTransactionHistory({ transactions, txLoading, txFilter, page, totalPages, onFilterChange, onPageChange }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Gift className="h-4 w-4" /> Transaction History
          </CardTitle>
          <div className="flex flex-wrap gap-1">
            {TX_FILTER_OPTIONS.map((opt) => (
              <button key={opt.value} onClick={() => onFilterChange(opt.value)}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${txFilter === opt.value ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"}`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {txLoading ? (
          <div className="divide-y"><SkeletonRow /><SkeletonRow /><SkeletonRow /></div>
        ) : transactions.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">
            <Gift className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No transactions yet.</p>
            <p className="text-xs mt-1">Start shopping to earn your first points!</p>
          </div>
        ) : (
          <div className="divide-y">
            {transactions.map((tx) => {
              const isPositive = tx.points > 0;
              const balanceAfter = tx.balanceAfter ?? tx.balance;
              return (
                <div key={tx.id} className="flex items-center gap-3 py-3">
                  <span className="text-xl w-7 shrink-0 text-center">{TX_TYPE_ICONS[tx.type] ?? "•"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{tx.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(tx.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                    </p>
                    {balanceAfter != null && <p className="text-xs text-muted-foreground">Balance after: {balanceAfter.toLocaleString()} pts</p>}
                  </div>
                  <span className={`text-sm font-semibold tabular-nums shrink-0 ${isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                    {isPositive ? "+" : ""}{tx.points.toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        {totalPages > 1 && (
          <>
            <Separator className="mt-4 mb-3" />
            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1 || txLoading} className="gap-1">
                <ChevronLeft className="h-4 w-4" /> Previous
              </Button>
              <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page === totalPages || txLoading} className="gap-1">
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
