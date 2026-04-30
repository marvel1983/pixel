import type { OrderMetrics } from "@/lib/date-presets";

const fmtMoney = (v: string | number) => {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return n.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

interface MetricCardProps {
  label: string;
  value: string;
  accent: string;
  prefix?: string;
}

function MetricCard({ label, value, accent, prefix }: MetricCardProps) {
  return (
    <div className="rounded-lg border border-[#2a3344] bg-[#10151f] px-4 py-3 min-w-[150px]">
      <div className="text-[10.5px] font-bold uppercase tracking-widest text-[#8b95ab]">{label}</div>
      <div className="mt-1 font-mono tabular-nums font-extrabold leading-tight" style={{ color: accent, fontSize: 26 }}>
        {prefix && <span className="text-[18px] mr-0.5 align-top">{prefix}</span>}
        {value}
      </div>
    </div>
  );
}

export function OrdersMetricsBar({ metrics, loading }: { metrics: OrderMetrics | null; loading: boolean }) {
  if (loading || !metrics) {
    return (
      <div className="rounded-lg border border-[#2a3344] bg-[#0c1018] px-4 py-3 text-[12px] text-[#5a6a84]">
        Loading metrics…
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#2a3344] bg-[#0c1018] p-3 space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <MetricCard
          label="Total Sales"
          value={fmtMoney(metrics.totalRevenue)}
          accent="#34d399"
          prefix="€"
        />
        <MetricCard
          label="Keys Sold"
          value={metrics.totalKeys.toLocaleString("en")}
          accent="#60a5fa"
        />
        <MetricCard
          label="Total Orders"
          value={`${metrics.completedOrders} / ${metrics.totalOrders}`}
          accent="#f472b6"
        />
        <MetricCard
          label="Vouchers Used"
          value={metrics.couponOrders.toLocaleString("en")}
          accent="#fbbf24"
        />
        <MetricCard
          label="CPP Used"
          value={metrics.cppOrders.toLocaleString("en")}
          accent="#c084fc"
        />
      </div>

      {metrics.topProducts.length > 0 && (
        <div className="rounded-md border border-[#252d40] bg-[#0a0e15] p-3">
          <div className="mb-2 text-[10.5px] font-bold uppercase tracking-widest text-[#8b95ab]">
            Top 3 Best-Selling Products
          </div>
          <div className="space-y-1.5">
            {metrics.topProducts.map((p, i) => (
              <div key={p.productName} className="flex items-center gap-3 text-[13px]">
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1a1f2e] text-[11px] font-bold text-[#fbbf24]">
                  {i + 1}
                </span>
                <span className="flex-1 truncate font-semibold text-[#dde4f0]" title={p.productName}>
                  {p.productName}
                </span>
                <span className="font-mono tabular-nums text-[12px] font-bold text-[#60a5fa] whitespace-nowrap">
                  ×{p.quantity}
                </span>
                <span className="font-mono tabular-nums text-[12.5px] font-extrabold text-[#34d399] whitespace-nowrap">
                  €{fmtMoney(p.revenue)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
