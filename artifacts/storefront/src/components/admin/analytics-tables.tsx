import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

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

type SortDir = "asc" | "desc";
interface SortState<K extends string> { key: K; dir: SortDir }

function useSort<K extends string>(initialKey: K, initialDir: SortDir = "desc") {
  const [sort, setSort] = useState<SortState<K>>({ key: initialKey, dir: initialDir });
  const toggle = (key: K, defaultDir: SortDir = "desc") => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: defaultDir },
    );
  };
  return { sort, toggle };
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-40" />;
  return dir === "asc"
    ? <ArrowUp className="ml-1 inline h-3 w-3" />
    : <ArrowDown className="ml-1 inline h-3 w-3" />;
}

interface SortHeaderProps<K extends string> {
  label: string;
  sortKey: K;
  current: SortState<K>;
  onClick: (key: K) => void;
  align?: "left" | "right";
  className?: string;
}

function SortHeader<K extends string>({ label, sortKey, current, onClick, align = "left", className = "" }: SortHeaderProps<K>) {
  const active = current.key === sortKey;
  return (
    <th className={`px-6 py-3 font-medium text-muted-foreground ${align === "right" ? "text-right" : "text-left"} ${className}`}>
      <button
        type="button"
        onClick={() => onClick(sortKey)}
        className={`inline-flex items-center gap-0.5 hover:text-foreground ${align === "right" ? "flex-row-reverse" : ""} ${active ? "text-foreground" : ""}`}
      >
        {label}
        <SortIcon active={active} dir={current.dir} />
      </button>
    </th>
  );
}

type ProductKey = "productName" | "unitsSold" | "avgPrice" | "revenue";

export function ProductsSoldTable({ data }: { data: ProductRow[] }) {
  const { sort, toggle } = useSort<ProductKey>("revenue", "desc");

  const sorted = useMemo(() => {
    const arr = [...data];
    arr.sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      let cmp: number;
      if (typeof av === "string" && typeof bv === "string") cmp = av.localeCompare(bv);
      else cmp = Number(av) - Number(bv);
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [data, sort]);

  const totals = data.reduce(
    (acc, p) => ({ units: acc.units + p.unitsSold, revenue: acc.revenue + p.revenue }),
    { units: 0, revenue: 0 },
  );

  const handle = (key: ProductKey) => toggle(key, key === "productName" ? "asc" : "desc");

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
              <tr className="border-b">
                <th className="px-6 py-3 text-left font-medium text-muted-foreground">#</th>
                <SortHeader label="Product" sortKey="productName" current={sort} onClick={handle} />
                <SortHeader label="Units" sortKey="unitsSold" current={sort} onClick={handle} align="right" />
                <SortHeader label="Avg Price" sortKey="avgPrice" current={sort} onClick={handle} align="right" />
                <SortHeader label="Total" sortKey="revenue" current={sort} onClick={handle} align="right" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((p, idx) => (
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

type CustomerKey = "name" | "orderCount" | "revenue";

export function TopCustomersTable({ data }: { data: CustomerRow[] }) {
  const { sort, toggle } = useSort<CustomerKey>("revenue", "desc");

  const sorted = useMemo(() => {
    const arr = [...data];
    arr.sort((a, b) => {
      let cmp: number;
      if (sort.key === "name") {
        cmp = (a.name ?? a.email).localeCompare(b.name ?? b.email);
      } else {
        cmp = Number(a[sort.key]) - Number(b[sort.key]);
      }
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [data, sort]);

  const handle = (key: CustomerKey) => toggle(key, key === "name" ? "asc" : "desc");

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
              <tr className="border-b bg-gray-50">
                <th className="px-6 py-3 text-left font-medium text-muted-foreground">#</th>
                <SortHeader label="Customer" sortKey="name" current={sort} onClick={handle} />
                <SortHeader label="Orders" sortKey="orderCount" current={sort} onClick={handle} align="right" />
                <SortHeader label="Spent" sortKey="revenue" current={sort} onClick={handle} align="right" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((c, idx) => (
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
