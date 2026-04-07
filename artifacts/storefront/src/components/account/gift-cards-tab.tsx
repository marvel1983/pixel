import { useState, useEffect } from "react";
import { Gift, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/stores/auth-store";

const API = import.meta.env.VITE_API_URL ?? "/api";

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  REDEEMED: "bg-blue-100 text-blue-800",
  EXPIRED: "bg-gray-100 text-gray-600",
  DEACTIVATED: "bg-red-100 text-red-800",
};

interface GiftCardRow {
  id: number; code: string; initialAmountUsd: string; balanceUsd: string;
  status: string; recipientEmail: string | null; recipientName: string | null;
  createdAt: string;
}

export function GiftCardsTab() {
  const [cards, setCards] = useState<GiftCardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkCode, setCheckCode] = useState("");
  const [checkResult, setCheckResult] = useState<{ code: string; balanceUsd: string; status: string } | null>(null);
  const [checkError, setCheckError] = useState("");
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (!token) return;
    fetch(`${API}/account/gift-cards`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setCards(d.giftCards || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const handleCheck = async () => {
    if (!checkCode.trim()) return;
    setCheckError("");
    setCheckResult(null);
    try {
      const res = await fetch(`${API}/account/gift-cards/check-balance`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ code: checkCode.trim() }),
      });
      const d = await res.json();
      if (!res.ok) { setCheckError(d.error || "Not found"); return; }
      setCheckResult(d.card);
    } catch { setCheckError("Network error"); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 space-y-3">
          <h3 className="font-semibold">Check Gift Card Balance</h3>
          <div className="flex gap-2">
            <input className="flex-1 rounded-md border px-3 py-2 text-sm font-mono uppercase" value={checkCode}
              onChange={(e) => setCheckCode(e.target.value)} placeholder="GC-XXXX-XXXX-XXXX-XXXX"
              onKeyDown={(e) => e.key === "Enter" && handleCheck()} />
            <Button variant="outline" onClick={handleCheck}><Search className="h-4 w-4 mr-1" /> Check</Button>
          </div>
          {checkError && <p className="text-sm text-red-600">{checkError}</p>}
          {checkResult && (
            <div className="rounded-lg bg-blue-50 p-4 flex items-center justify-between">
              <div>
                <p className="font-mono text-sm">{checkResult.code}</p>
                <Badge variant="secondary" className={STATUS_COLORS[checkResult.status] ?? ""}>{checkResult.status}</Badge>
              </div>
              <p className="text-2xl font-bold text-blue-700">${checkResult.balanceUsd}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="p-4 border-b"><h3 className="font-semibold">Purchased Gift Cards</h3></div>
          {loading ? (
            <div className="p-4 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : cards.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Gift className="h-8 w-8 mx-auto mb-3" />
              <p>No gift cards purchased yet.</p>
            </div>
          ) : (
            <div className="divide-y">
              {cards.map((c) => (
                <div key={c.id} className="p-4 flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="font-mono text-sm font-medium">{c.code}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {c.recipientEmail && <span>To: {c.recipientName || c.recipientEmail}</span>}
                      <span>{new Date(c.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="font-mono font-semibold">${c.balanceUsd} <span className="text-xs text-muted-foreground">/ ${c.initialAmountUsd}</span></p>
                    <Badge variant="secondary" className={STATUS_COLORS[c.status] ?? ""}>{c.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
