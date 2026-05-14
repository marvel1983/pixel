interface ProductRow {
  productName: string;
  unitsSold: number;
  revenue: number;
  avgPrice: number;
}

interface CustomerRow {
  email: string;
  name: string | null;
  orderCount: number;
  revenue: number;
}

const fmtEur = (v: number) =>
  `€${v.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function ProductsSoldTable({ data }: { data: ProductRow[] }) {
  const totals = data.reduce(
    (acc, p) => ({ units: acc.units + p.unitsSold, revenue: acc.revenue + p.revenue }),
    { units: 0, revenue: 0 },
  );

  return (
    <div className="rounded-lg border bg-white shadow-sm">
      <div className="flex items-center justify-between border-b px-6 py-4">
        <h3 className="text-lg font-semibold">Products Sold</h3>
        <span className="text-sm text-muted-foreground">
          {data.length} {data.length === 1 ? "product" : "products"}
        </span>
      </div>
      {data.length === 0 ? (
        <div className="p-6 text-center text-muted-foreground">
          No sales data for this period.
        </div>
      ) : (
        <div className="max-h-[480px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50">
              <tr className="border-b text-left">
                <th className="px-6 py-3 font-medium text-muted-foreground">#</th>
                <th className="px-6 py-3 font-medium text-muted-foreground">Product</th>
                <th className="px-6 py-3 font-medium text-muted-foreground text-right">Units</th>
                <th className="px-6 py-3 font-medium text-muted-foreground text-right">Avg Price</th>
                <th className="px-6 py-3 font-medium text-muted-foreground text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.map((p, idx) => (
                <tr key={p.productName} className="border-b last:border-0">
                  <td className="px-6 py-3 text-muted-foreground">{idx + 1}</td>
                  <td className="px-6 py-3 font-medium">{p.productName}</td>
                  <td className="px-6 py-3 text-right tabular-nums">{p.unitsSold}</td>
                  <td className="px-6 py-3 text-right tabular-nums text-muted-foreground">
                    {fmtEur(p.avgPrice)}
                  </td>
                  <td className="px-6 py-3 text-right font-medium tabular-nums">
                    {fmtEur(p.revenue)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 bg-gray-50">
              <tr className="border-t font-semibold">
                <td className="px-6 py-3" colSpan={2}>Total</td>
                <td className="px-6 py-3 text-right tabular-nums">{totals.units}</td>
                <td className="px-6 py-3" />
                <td className="px-6 py-3 text-right tabular-nums">{fmtEur(totals.revenue)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

export function TopCustomersTable({ data }: { data: CustomerRow[] }) {
  return (
    <div className="rounded-lg border bg-white shadow-sm">
      <div className="border-b px-6 py-4">
        <h3 className="text-lg font-semibold">Top 15 Customers</h3>
      </div>
      {data.length === 0 ? (
        <div className="p-6 text-center text-muted-foreground">
          No customer data for this period.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left">
                <th className="px-6 py-3 font-medium text-muted-foreground">#</th>
                <th className="px-6 py-3 font-medium text-muted-foreground">Customer</th>
                <th className="px-6 py-3 font-medium text-muted-foreground text-right">Orders</th>
                <th className="px-6 py-3 font-medium text-muted-foreground text-right">Spent</th>
              </tr>
            </thead>
            <tbody>
              {data.map((c, idx) => (
                <tr key={c.email} className="border-b last:border-0">
                  <td className="px-6 py-3 text-muted-foreground">{idx + 1}</td>
                  <td className="px-6 py-3">
                    <div className="font-medium">{c.name ?? c.email}</div>
                    {c.name && (
                      <div className="text-xs text-muted-foreground">{c.email}</div>
                    )}
                  </td>
                  <td className="px-6 py-3 text-right tabular-nums">{c.orderCount}</td>
                  <td className="px-6 py-3 text-right font-medium tabular-nums">
                    {fmtEur(c.revenue)}
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
