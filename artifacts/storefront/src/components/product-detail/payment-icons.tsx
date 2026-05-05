const METHODS = [
  { name: "Visa",       lightColor: "#1A1F71", darkColor: "#93a8f4" },
  { name: "Mastercard", lightColor: "#EB001B", darkColor: "#f87171" },
  { name: "Apple Pay",  lightColor: "#1d1d1f", darkColor: "#e2e8f0" },
  { name: "Google Pay", lightColor: "#1a73e8", darkColor: "#60a5fa" },
];

export function PaymentIcons() {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <svg className="h-5 w-auto shrink-0 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20" />
      </svg>

      {METHODS.map((m) => (
        <span
          key={m.name}
          className="inline-flex items-center rounded-md border border-border bg-muted px-2.5 py-1 text-[11px] font-bold tracking-wide select-none"
        >
          <span className="dark:hidden" style={{ color: m.lightColor }}>{m.name}</span>
          <span className="hidden dark:inline" style={{ color: m.darkColor }}>{m.name}</span>
        </span>
      ))}
    </div>
  );
}
