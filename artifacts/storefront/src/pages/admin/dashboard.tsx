import { DashboardStatsSection } from "@/components/admin/dashboard-stats";
import { RecentOrdersSection } from "@/components/admin/dashboard-orders";
import { LowStockSection, PendingReviewsSection } from "@/components/admin/dashboard-alerts";
import { NpsWidget } from "@/components/admin/dashboard-nps";

export default function AdminDashboard() {
  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-sm font-bold" style={{ color: "#e2e8f0" }}>Dashboard</h1>
          <p className="text-[11px]" style={{ color: "#4a5568" }}>Store performance overview</p>
        </div>
        <div className="flex items-center gap-1">
          <span
            className="rounded px-2 py-1 text-[10px] font-medium"
            style={{ background: "#1a1d28", border: "1px solid #252836", color: "#4a5568" }}
          >
            {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
          </span>
        </div>
      </div>

      <DashboardStatsSection />
      <RecentOrdersSection />

      <div className="grid gap-3 lg:grid-cols-2">
        <LowStockSection />
        <PendingReviewsSection />
      </div>

      <NpsWidget />
    </div>
  );
}
