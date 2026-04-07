import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";

const API = import.meta.env.VITE_API_URL ?? "/api";

export default function DiscountBulkPage() {
  const [prefix, setPrefix] = useState("");
  const [length, setLength] = useState(8);
  const [quantity, setQuantity] = useState(10);
  const [discountType, setDiscountType] = useState<"PERCENTAGE" | "FIXED">("PERCENTAGE");
  const [discountValue, setDiscountValue] = useState("");
  const [minOrderUsd, setMinOrderUsd] = useState("");
  const [maxDiscountUsd, setMaxDiscountUsd] = useState("");
  const [usageLimit, setUsageLimit] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ generated: number; codes: string[] } | null>(null);
  const [, navigate] = useLocation();
  const token = useAuthStore((s) => s.token);

  const generate = async () => {
    if (!discountValue) return;
    setGenerating(true);
    const res = await fetch(`${API}/admin/discounts/bulk`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prefix, length, quantity, discountType, discountValue, minOrderUsd: minOrderUsd || null, maxDiscountUsd: maxDiscountUsd || null, usageLimit: usageLimit || null, expiresAt: expiresAt || null }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Generation failed" }));
      alert(err.error || "Failed to generate codes");
      setGenerating(false);
      return;
    }
    const data = await res.json();
    setResult(data);
    setGenerating(false);
  };

  const downloadCsv = () => {
    if (!result) return;
    const csv = "code\n" + result.codes.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "discount-codes.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/discounts")}><ArrowLeft className="h-4 w-4" /></Button>
        <h1 className="text-2xl font-bold">Bulk Generate Codes</h1>
      </div>

      <div className="rounded-lg border bg-white p-6 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div><label className="block text-sm font-medium mb-1">Prefix</label><input className="w-full rounded-md border px-3 py-2 text-sm font-mono uppercase" maxLength={10} value={prefix} onChange={(e) => setPrefix(e.target.value.toUpperCase())} placeholder="e.g. PROMO" /></div>
          <div><label className="block text-sm font-medium mb-1">Code Length</label><input type="number" min={4} max={20} className="w-full rounded-md border px-3 py-2 text-sm" value={length} onChange={(e) => setLength(Number(e.target.value))} /></div>
          <div><label className="block text-sm font-medium mb-1">Quantity (max 1000)</label><input type="number" min={1} max={1000} className="w-full rounded-md border px-3 py-2 text-sm" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} /></div>
        </div>

        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm"><input type="radio" checked={discountType === "PERCENTAGE"} onChange={() => setDiscountType("PERCENTAGE")} /> Percentage (%)</label>
          <label className="flex items-center gap-2 text-sm"><input type="radio" checked={discountType === "FIXED"} onChange={() => setDiscountType("FIXED")} /> Fixed ($)</label>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <div><label className="block text-sm font-medium mb-1">Value *</label><input type="number" className="w-full rounded-md border px-3 py-2 text-sm" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} /></div>
          <div><label className="block text-sm font-medium mb-1">Min Order ($)</label><input type="number" className="w-full rounded-md border px-3 py-2 text-sm" value={minOrderUsd} onChange={(e) => setMinOrderUsd(e.target.value)} /></div>
          <div><label className="block text-sm font-medium mb-1">Max Discount ($)</label><input type="number" className="w-full rounded-md border px-3 py-2 text-sm" value={maxDiscountUsd} onChange={(e) => setMaxDiscountUsd(e.target.value)} /></div>
          <div><label className="block text-sm font-medium mb-1">Max Uses Each</label><input type="number" className="w-full rounded-md border px-3 py-2 text-sm" value={usageLimit} onChange={(e) => setUsageLimit(e.target.value)} placeholder="Unlimited" /></div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Expires At</label>
          <input type="datetime-local" className="w-full max-w-[250px] rounded-md border px-3 py-2 text-sm" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
        </div>

        <div className="bg-gray-50 rounded-md p-3 text-sm text-muted-foreground">
          Preview: <span className="font-mono">{prefix ? `${prefix}-` : ""}{Array(length).fill("X").join("")}</span> × {quantity}
        </div>

        <Button onClick={generate} disabled={generating || !discountValue}>{generating ? "Generating..." : `Generate ${quantity} Codes`}</Button>
      </div>

      {result && (
        <div className="rounded-lg border bg-white p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Generated {result.generated} Codes</h3>
            <Button variant="outline" size="sm" onClick={downloadCsv}><Download className="h-4 w-4 mr-1" /> Download CSV</Button>
          </div>
          <div className="max-h-64 overflow-y-auto rounded border bg-gray-50 p-3">
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1 font-mono text-xs">
              {result.codes.map((c) => <span key={c}>{c}</span>)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
