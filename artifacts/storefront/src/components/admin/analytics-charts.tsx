import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface DailyRevenue {
  date: string;
  revenue: number;
}

interface OrdersByStatus {
  date: string;
  [status: string]: string | number;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "#eab308",
  PROCESSING: "#3b82f6",
  COMPLETED: "#22c55e",
  CANCELLED: "#ef4444",
  REFUNDED: "#6b7280",
  FAILED: "#dc2626",
};

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface RevenueChartProps {
  data: DailyRevenue[];
}

export function RevenueChart({ data }: RevenueChartProps) {
  return (
    <div className="rounded-lg border bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold">Revenue Over Time</h3>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="date"
              tickFormatter={formatShortDate}
              fontSize={12}
              tick={{ fill: "#6b7280" }}
            />
            <YAxis
              fontSize={12}
              tick={{ fill: "#6b7280" }}
              tickFormatter={(v: number) => `$${v}`}
            />
            <Tooltip
              formatter={(value: number) => [`$${value.toFixed(2)}`, "Revenue"]}
              labelFormatter={formatShortDate}
            />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ r: 3, fill: "#3b82f6" }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

interface OrdersChartProps {
  data: OrdersByStatus[];
}

export function OrdersChart({ data }: OrdersChartProps) {
  const allStatuses = new Set<string>();
  for (const row of data) {
    for (const key of Object.keys(row)) {
      if (key !== "date") allStatuses.add(key);
    }
  }

  return (
    <div className="rounded-lg border bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold">Orders by Status</h3>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="date"
              tickFormatter={formatShortDate}
              fontSize={12}
              tick={{ fill: "#6b7280" }}
            />
            <YAxis fontSize={12} tick={{ fill: "#6b7280" }} allowDecimals={false} />
            <Tooltip labelFormatter={formatShortDate} />
            <Legend />
            {Array.from(allStatuses).map((status) => (
              <Bar
                key={status}
                dataKey={status}
                stackId="a"
                fill={STATUS_COLORS[status] ?? "#9ca3af"}
                name={status}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
