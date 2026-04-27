import { useRef } from "react";
import { Copy, AlertTriangle } from "lucide-react";
import { Card } from "./order-detail-ui";

interface Item { id: number; productName: string; variantName: string; priceUsd: string; quantity: number }
interface LicenseKey { orderItemId: number; id: number; keyValue: string; status: string }

interface Props {
  items: Item[];
  licenseKeys: LicenseKey[];
  externalOrderId: string | null;
  syncingKeys: boolean;
  onSync: (metenziOrderId: string | undefined) => void;
  syncOrderIdRef: React.RefObject<HTMLInputElement | null>;
}

export function OrderKeysCard({ items, licenseKeys, externalOrderId, syncingKeys, onSync, syncOrderIdRef }: Props) {
  const totalExpected = items.reduce((s, i) => s + i.quantity, 0);
  const missing = totalExpected - licenseKeys.length;

  return (
    <Card title="License Keys">
      {missing > 0 && (
        <div className="mb-3 rounded border border-amber-500/40 bg-amber-900/20 px-3 py-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
            <p className="text-[12.5px] font-semibold text-amber-300">
              {missing} key{missing > 1 ? "s" : ""} missing — {licenseKeys.length} of {totalExpected} delivered
            </p>
          </div>
          <p className="text-[11.5px] text-amber-400/80 mb-2">
            If the key has been assigned on Metenzi, enter that order ID below and click Sync.
          </p>
          <div className="flex gap-2">
            <input ref={syncOrderIdRef} defaultValue={externalOrderId ?? ""}
              placeholder="Metenzi order ID (e.g. 7aba34d0-...)"
              className="flex-1 rounded border border-[#1e3a5f] bg-[#0a1828] px-2.5 py-1.5 text-[12px] font-mono text-[#dde4f0] placeholder:text-[#3d5070] focus:border-amber-500/60 focus:outline-none"
            />
            <button onClick={() => onSync(syncOrderIdRef.current?.value.trim() || undefined)} disabled={syncingKeys}
              className="rounded border border-amber-400 bg-amber-600/30 px-3 py-1.5 text-[12px] font-semibold text-amber-200 hover:bg-amber-600/50 disabled:opacity-40 transition-colors whitespace-nowrap">
              {syncingKeys ? "Syncing..." : "Sync Keys"}
            </button>
          </div>
        </div>
      )}
      {licenseKeys.length === 0 ? (
        <p className="text-[12.5px] text-[#4a5a74]">No license keys assigned.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const itemKeys = licenseKeys.filter((k) => k.orderItemId === item.id);
            if (itemKeys.length === 0) return null;
            return (
              <div key={item.id}>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#5b9fd4] mb-1.5">{item.productName} — {item.variantName}</p>
                {itemKeys.map((k) => (
                  <div key={k.id} className="flex items-center gap-2 rounded border border-[#2e3340] bg-[#212530] px-3 py-2 mb-1.5">
                    <code className="flex-1 text-[12px] font-mono text-[#dde4f0] tracking-wide">{k.keyValue}</code>
                    <span className="rounded border border-emerald-400/50 bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-200 uppercase">{k.status}</span>
                    <button onClick={() => navigator.clipboard.writeText(k.keyValue)} className="rounded p-1 text-[#5b9fd4] hover:bg-[#1e3a5f] hover:text-white transition-colors">
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
