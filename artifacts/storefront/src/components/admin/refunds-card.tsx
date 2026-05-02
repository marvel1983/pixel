import { Card, formatMoney } from "./order-detail-ui";
import type { RefundEntry } from "./order-detail-ui";

const STATUS_COLOR: Record<string, string> = {
  COMPLETED:  "border-emerald-500/40 bg-emerald-500/15 text-emerald-200",
  PROCESSING: "border-sky-500/40     bg-sky-500/15     text-sky-200",
  PENDING:    "border-amber-500/40   bg-amber-500/15   text-amber-200",
  FAILED:     "border-red-500/40     bg-red-500/15     text-red-200",
};

interface Props {
  refunds: RefundEntry[];
  orderTotalUsd: string;
  currencyCode: string;
  currencyRate: string;
}

export function RefundsCard({ refunds, orderTotalUsd, currencyCode, currencyRate }: Props) {
  if (refunds.length === 0) return null;

  const completedTotal = refunds
    .filter((r) => r.status === "COMPLETED")
    .reduce((sum, r) => sum + parseFloat(r.amountUsd), 0);

  const orderTotal = parseFloat(orderTotalUsd);
  const netRetained = Math.max(0, orderTotal - completedTotal);

  const fmt = (amt: string | number) => formatMoney(amt, currencyRate, currencyCode);

  return (
    <Card title="Refunds">
      <div className="space-y-3">
        <div className="rounded border border-[#2e3340] bg-[#0c1018] p-3 space-y-1.5 text-[12.5px]">
          <div className="flex items-center justify-between">
            <span className="text-[#8fa0bb]">Original charge</span>
            <span className="font-mono tabular-nums text-emerald-300">+{fmt(orderTotal)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#8fa0bb]">Refunded (completed)</span>
            <span className="font-mono tabular-nums text-rose-300">-{fmt(completedTotal)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-[#2e3340] pt-1.5 mt-1.5">
            <span className="font-bold text-white">Net retained</span>
            <span className="font-mono tabular-nums font-bold text-white">{fmt(netRetained)}</span>
          </div>
        </div>

        <div className="overflow-x-auto rounded border border-[#2e3340]">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="bg-[#1e2128]">
                {["Date", "Amount", "Reason", "Status", "Stripe ID"].map((h) => (
                  <th key={h} className="border-b border-[#2a2e3a] px-3 py-[7px] text-left text-[10.5px] font-bold uppercase tracking-widest" style={{ color: "#ffffff" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {refunds.map((r, idx) => {
                const cls = STATUS_COLOR[r.status] ?? "border-[#4b5568] bg-[#2a3040] text-[#cbd5e1]";
                const when = r.processedAt ?? r.createdAt;
                return (
                  <tr key={r.id} className={idx % 2 === 0 ? "bg-[#0c1018]" : "bg-[#0f1520]"}>
                    <td className="border-b border-[#1f2840] px-3 py-2 text-[#dde4f0] whitespace-nowrap">{new Date(when).toLocaleString()}</td>
                    <td className="border-b border-[#1f2840] px-3 py-2 text-right font-mono tabular-nums font-bold text-rose-300 whitespace-nowrap">-{fmt(r.amountUsd)}</td>
                    <td className="border-b border-[#1f2840] px-3 py-2 text-[#dde4f0]">
                      {r.reason}
                      {r.notes && <div className="text-[11px] text-[#8fa0bb] mt-0.5">{r.notes}</div>}
                      {r.status === "FAILED" && r.failureReason && <div className="text-[11px] text-red-300 mt-0.5">{r.failureReason}</div>}
                    </td>
                    <td className="border-b border-[#1f2840] px-3 py-2">
                      <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cls}`}>{r.status}</span>
                    </td>
                    <td className="border-b border-[#1f2840] px-3 py-2 font-mono text-[11px] text-[#8fa0bb]">{r.externalRefundId ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}
