export default function AdminDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome to the PixelCodes admin panel.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Revenue", value: "$0.00", desc: "Coming soon" },
          { label: "Orders", value: "0", desc: "Coming soon" },
          { label: "Products", value: "0", desc: "Coming soon" },
          { label: "Customers", value: "0", desc: "Coming soon" },
        ].map((card) => (
          <div key={card.label} className="rounded-lg border bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-muted-foreground">{card.label}</p>
            <p className="mt-1 text-2xl font-bold">{card.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{card.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
