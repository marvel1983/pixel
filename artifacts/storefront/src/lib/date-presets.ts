export type DatePresetKey =
  | "today"
  | "yesterday"
  | "7days"
  | "14days"
  | "30days"
  | "thisMonth"
  | "pastMonth"
  | "thisYear"
  | "pastYear"
  | "6months"
  | "custom";

export interface DatePresetOption {
  key: DatePresetKey;
  label: string;
}

export const DATE_PRESETS: DatePresetOption[] = [
  { key: "today",     label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7days",     label: "Last 7 days" },
  { key: "14days",    label: "Last 14 days" },
  { key: "30days",    label: "Last 30 days" },
  { key: "thisMonth", label: "This month" },
  { key: "pastMonth", label: "Past month" },
  { key: "6months",   label: "Last 6 months" },
  { key: "thisYear",  label: "This year" },
  { key: "pastYear",  label: "Past year" },
  { key: "custom",    label: "Custom period" },
];

const fmt = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

/**
 * Convert a preset key to {from, to} ISO date strings (yyyy-mm-dd) in local time.
 * Returns null when preset is "custom" — caller keeps existing values.
 */
export function presetToRange(key: DatePresetKey): { from: string; to: string } | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  switch (key) {
    case "today": {
      return { from: fmt(today), to: fmt(today) };
    }
    case "yesterday": {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      return { from: fmt(y), to: fmt(y) };
    }
    case "7days": {
      const f = new Date(today);
      f.setDate(f.getDate() - 6);
      return { from: fmt(f), to: fmt(today) };
    }
    case "14days": {
      const f = new Date(today);
      f.setDate(f.getDate() - 13);
      return { from: fmt(f), to: fmt(today) };
    }
    case "30days": {
      const f = new Date(today);
      f.setDate(f.getDate() - 29);
      return { from: fmt(f), to: fmt(today) };
    }
    case "thisMonth": {
      const f = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: fmt(f), to: fmt(today) };
    }
    case "pastMonth": {
      const f = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const t = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: fmt(f), to: fmt(t) };
    }
    case "6months": {
      const f = new Date(today);
      f.setMonth(f.getMonth() - 6);
      return { from: fmt(f), to: fmt(today) };
    }
    case "thisYear": {
      const f = new Date(today.getFullYear(), 0, 1);
      return { from: fmt(f), to: fmt(today) };
    }
    case "pastYear": {
      const f = new Date(today.getFullYear() - 1, 0, 1);
      const t = new Date(today.getFullYear() - 1, 11, 31);
      return { from: fmt(f), to: fmt(t) };
    }
    case "custom":
      return null;
  }
}

export interface OrderMetrics {
  totalRevenue: string;
  totalKeys: number;
  completedOrders: number;
  totalOrders: number;
  couponOrders: number;
  cppOrders: number;
  topProducts: { productName: string; quantity: number; revenue: string }[];
}
