import { useState, useEffect } from "react";
import { Star, TrendingUp } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";

const API = import.meta.env.VITE_API_URL ?? "/api";

export function NpsWidget() {
  const token = useAuthStore.getState().token;
  const [stats, setStats] = useState<{ total: number; avg: number; nps: number } | null>(null);

  useEffect(() => {
    fetch(`${API}/admin/surveys/stats`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setStats(data); })
      .catch(() => {});
  }, [token]);

  if (!stats || stats.total === 0) return null;

  return (
    <div className="border rounded-lg bg-white p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-blue-600" /> NPS Score
        </h3>
        <a href="/admin/surveys" className="text-xs text-blue-600 hover:underline">View all →</a>
      </div>
      <div className="flex items-center gap-6">
        <div>
          <p className={`text-3xl font-bold ${stats.nps >= 50 ? "text-green-600" : stats.nps >= 0 ? "text-amber-600" : "text-red-600"}`}>{stats.nps}</p>
          <p className="text-xs text-muted-foreground">NPS Score</p>
        </div>
        <div className="h-10 border-l" />
        <div>
          <p className="text-xl font-bold flex items-center gap-1">{stats.avg} <Star className="h-4 w-4 fill-amber-400 text-amber-400" /></p>
          <p className="text-xs text-muted-foreground">{stats.total} responses</p>
        </div>
      </div>
    </div>
  );
}
