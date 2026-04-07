import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface TopProduct {
  productName: string;
  unitsSold: number;
  revenue: number;
}

interface CategoryRevenue {
  category: string;
  revenue: number;
}

const PIE_COLORS = [
  "#3b82f6", "#22c55e", "#eab308", "#ef4444", "#8b5cf6",
  "#f97316", "#06b6d4", "#ec4899", "#14b8a6", "#6366f1",
];

interface TopProductsProps {
  data: TopProduct[];
}

export function TopProductsTable({ data }: TopProductsProps) {
  return (
    <div className="rounded-lg border bg-white shadow-sm">
      <div className="border-b px-6 py-4">
        <h3 className="text-lg font-semibold">Top 10 Products</h3>
      </div>
      {data.length === 0 ? (
        <div className="p-6 text-center text-muted-foreground">
          No sales data for this period.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left">
                <th className="px-6 py-3 font-medium text-muted-foreground">#</th>
                <th className="px-6 py-3 font-medium text-muted-foreground">Product</th>
                <th className="px-6 py-3 font-medium text-muted-foreground text-right">Units Sold</th>
                <th className="px-6 py-3 font-medium text-muted-foreground text-right">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {data.map((product, idx) => (
                <tr key={product.productName} className="border-b last:border-0">
                  <td className="px-6 py-3 text-muted-foreground">{idx + 1}</td>
                  <td className="px-6 py-3 font-medium">{product.productName}</td>
                  <td className="px-6 py-3 text-right">{product.unitsSold}</td>
                  <td className="px-6 py-3 text-right font-medium">
                    ${product.revenue.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

interface CategoryChartProps {
  data: CategoryRevenue[];
}

export function CategoryRevenueChart({ data }: CategoryChartProps) {
  const total = data.reduce((sum, d) => sum + d.revenue, 0);

  return (
    <div className="rounded-lg border bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold">Revenue by Category</h3>
      {data.length === 0 ? (
        <div className="flex h-[300px] items-center justify-center text-muted-foreground">
          No category data for this period.
        </div>
      ) : (
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="revenue"
                nameKey="category"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
              >
                {data.map((_, idx) => (
                  <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => [
                  `$${value.toFixed(2)} (${total > 0 ? ((value / total) * 100).toFixed(1) : 0}%)`,
                  "Revenue",
                ]}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
