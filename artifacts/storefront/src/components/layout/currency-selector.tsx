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

  return (
    <Select value={code} onValueChange={(v) => setCode(v as CurrencyCode)}>
      <SelectTrigger className="w-[72px] h-8 border-none bg-transparent text-primary-foreground text-xs font-medium focus:ring-0 px-2">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SUPPORTED_CURRENCIES.map((c) => (
          <SelectItem key={c.code} value={c.code} className="text-sm">
            {c.symbol} {c.code}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
