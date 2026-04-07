import {
  useCurrencyStore,
  SUPPORTED_CURRENCIES,
  type CurrencyCode,
} from "@/stores/currency-store";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function CurrencySelector() {
  const code = useCurrencyStore((s) => s.code);
  const setCode = useCurrencyStore((s) => s.setCode);
  const current = SUPPORTED_CURRENCIES.find((c) => c.code === code);

  return (
    <Select value={code} onValueChange={(v) => setCode(v as CurrencyCode)}>
      <SelectTrigger className="w-[90px] h-8 border-none bg-transparent text-primary-foreground text-xs font-medium focus:ring-0 px-2">
        <span className="flex items-center gap-1">
          <span>{current?.flag}</span>
          <span>{code}</span>
        </span>
      </SelectTrigger>
      <SelectContent>
        {SUPPORTED_CURRENCIES.map((c) => (
          <SelectItem key={c.code} value={c.code} className="text-sm">
            <span className="flex items-center gap-2">
              <span>{c.flag}</span>
              <span>{c.symbol} {c.code}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
