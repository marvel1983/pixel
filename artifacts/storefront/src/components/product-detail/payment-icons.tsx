const METHODS = [
  { name: "Visa",       color: "#1A1F71", bg: "#f0f4ff", border: "#c7d2f7" },
  { name: "Mastercard", color: "#EB001B", bg: "#fff0f0", border: "#fcc" },
  { name: "PayPal",     color: "#003087", bg: "#e8f0fb", border: "#b3c9f0" },
  { name: "Apple Pay",  color: "#1d1d1f", bg: "#f5f5f7", border: "#d2d2d7" },
  { name: "Google Pay", color: "#1a73e8", bg: "#e8f4fd", border: "#b6d9f8" },
];

export function PaymentIcons() {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Card icon */}
      <svg className="h-5 w-auto shrink-0 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20" />
      </svg>

      {METHODS.map((m) => (
        <span
          key={m.name}
          className="inline-flex items-center rounded-md border px-2.5 py-1 text-[11px] font-bold tracking-wide select-none"
          style={{
            color: m.color,
            backgroundColor: m.bg,
            borderColor: m.border,
          }}
        >
          {m.name}
        </span>
      ))}
    </div>
  );
}
