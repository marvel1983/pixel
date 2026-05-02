import type { ReactNode } from "react";

export const STATUS_COLORS: Record<string, string> = {
  PENDING:            "border-amber-400   bg-amber-500/40   text-amber-100   font-bold",
  PROCESSING:         "border-sky-400     bg-sky-500/40     text-sky-100     font-bold",
  COMPLETED:          "border-emerald-400 bg-emerald-500/40 text-emerald-100 font-bold",
  FAILED:             "border-red-400     bg-red-500/40     text-red-100     font-bold",
  REFUNDED:           "border-violet-400  bg-violet-500/40  text-violet-100  font-bold",
  PARTIALLY_REFUNDED: "border-orange-400  bg-orange-500/40  text-orange-100  font-bold",
  HELD:               "border-rose-400    bg-rose-500/40    text-rose-100    font-bold",
};

export interface OrderDetail {
  order: {
    id: number; orderNumber: string; guestEmail: string | null; userId: number | null;
    status: string; paymentMethod: string | null; subtotalUsd: string; discountUsd: string;
    totalUsd: string; walletAmountUsed: string | null; currencyCode: string; currencyRate: string;
    cppSelected: boolean; cppAmountUsd: string; couponId: number | null;
    paymentIntentId: string | null; externalOrderId: string | null;
    ipAddress: string | null; notes: string | null; failureReason: string | null;
    createdAt: string; updatedAt: string;
    riskScore: number | null; riskReasons: string[] | null;
  };
  stripePaymentDetails: {
    status: string; cardBrand?: string; cardLast4?: string;
    cardExpMonth?: number; cardExpYear?: number; cardCountry?: string; cardFunding?: string;
    declineCode?: string; declineMessage?: string;
  } | null;
  items: { id: number; productName: string; variantName: string; priceUsd: string; quantity: number }[];
  licenseKeys: { orderItemId: number; id: number; keyValue: string; status: string }[];
  customer: { id: number; email: string; firstName: string | null; lastName: string | null; createdAt: string } | null;
  coupon: { id: number; code: string; discountPercent: string } | null;
  timeline: { event: string; date: string; kind?: string; details?: Record<string, unknown> }[];
}

export function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-[#2e3340] bg-[#181c24]" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.35)" }}>
      <div className="border-b border-[#2a2e3a] px-4 py-3 bg-[#1e2128]">
        <p className="card-title text-[13px] font-bold uppercase tracking-widest">{title}</p>
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}

export function InfoRow({ label, value, mono, highlight }: { label: string; value: string; mono?: boolean; highlight?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10.5px] uppercase tracking-wider text-[#4a5a74]">{label}</span>
      <span className={`text-[12.5px] ${mono ? "font-mono text-[11.5px]" : ""} ${highlight ? "font-bold text-[#a8d4f5]" : "text-[#dde4f0]"}`}>{value}</span>
    </div>
  );
}

export function SummaryRow({ label, value, labelClass, valueClass }: { label: string; value: string; labelClass?: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={`text-[#8fa0bb] ${labelClass ?? ""}`}>{label}</span>
      <span className={`tabular-nums ${valueClass ?? "text-[#dde4f0]"}`}>{value}</span>
    </div>
  );
}

export function ActionBtn({ onClick, disabled, icon, color, children }: {
  onClick: () => void; disabled?: boolean; icon: ReactNode; color: string; children: ReactNode;
}) {
  const colors: Record<string, string> = {
    emerald: "border-emerald-300 bg-emerald-500  hover:bg-emerald-400",
    red:     "border-red-300     bg-[#e53e3e]    hover:bg-[#fc5c5c]",
    violet:  "border-violet-300  bg-[#7c3aed]   hover:bg-[#8b5cf6]",
    sky:     "border-sky-300     bg-[#0284c7]   hover:bg-[#0ea5e9]",
    amber:   "border-amber-300   bg-amber-600   hover:bg-amber-500",
    orange:  "border-orange-300  bg-orange-600  hover:bg-orange-500",
  };
  return (
    <button onClick={onClick} disabled={disabled}
      className={`flex items-center gap-1.5 rounded border px-3 py-1.5 text-[12px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${colors[color]}`}
      style={{ color: "#ffffff" }}>
      {icon}{children}
    </button>
  );
}
