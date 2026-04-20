# New Admin Settings Tab – Pixel-Storefront

Svaki admin settings tab prati isti pattern u 4 koraka.

---

## Korak 1 — DB Schema

Dodaj kolone u `lib/db/src/schema/settings.ts`:

```typescript
mojaOpcija: boolean("moja_opcija").default(false),
mojaVrijednost: varchar("moja_vrijednost", { length: 255 }).default(""),
```

Ne zaboravi dodati `ALTER TABLE` u `deploy.yml` (vidi `/db-migration`).

---

## Korak 2 — API routes

Dodaj GET i PUT u `artifacts/api-server/src/routes/admin-settings-extra.ts`:

```typescript
router.get("/admin/settings/moj-tab", requireAuth, requireAdmin, requirePermission("manageSettings"), async (_req, res) => {
  const [s] = await db.select().from(siteSettings);
  res.json({
    mojaOpcija: s?.mojaOpcija ?? false,
    mojaVrijednost: s?.mojaVrijednost ?? "",
  });
});

router.put("/admin/settings/moj-tab", requireAuth, requireAdmin, requirePermission("manageSettings"), async (req, res) => {
  try {
    const [existing] = await db.select({ id: siteSettings.id }).from(siteSettings);
    const data = {
      mojaOpcija: Boolean(req.body.mojaOpcija),
      mojaVrijednost: String(req.body.mojaVrijednost || ""),
      updatedAt: new Date(),
    };
    if (existing) { await db.update(siteSettings).set(data).where(eq(siteSettings.id, existing.id)); }
    else { await db.insert(siteSettings).values(data); }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message ?? "DB error" });
  }
});
```

---

## Korak 3 — Frontend komponenta

Napravi `artifacts/storefront/src/pages/admin/settings-moj-tab.tsx`.

Koristi kao template `settings-cpp-fees.tsx` — isti pattern:
- `useState` za form
- `useEffect` za učitavanje (`GET`)
- `save()` funkcija za čuvanje (`PUT`)
- `useAuthStore` za token
- `alert("Saved!")` samo ako je `ok`

```typescript
export default function SettingsMojTabTab() {
  const [form, setForm] = useState({ mojaOpcija: false, mojaVrijednost: "" });
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const token = useAuthStore((s) => s.token);

  const api = useCallback(async (path: string, opts?: RequestInit) => {
    const r = await fetch(`${API}${path}`, { ...opts, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...opts?.headers } });
    if (!r.ok) { const e = await r.json().catch(() => ({ error: "Failed" })); alert(e.error); return null; }
    return r.json();
  }, [token]);

  useEffect(() => { api("/admin/settings/moj-tab").then((d) => { if (d) setForm({ ...form, ...d }); setLoaded(true); }); }, [api]);

  const save = async () => { setSaving(true); const ok = await api("/admin/settings/moj-tab", { method: "PUT", body: JSON.stringify(form) }); setSaving(false); if (ok) alert("Saved!"); };

  if (!loaded) return <div className="text-sm text-muted-foreground p-4">Loading...</div>;

  return (
    <div className="space-y-6">
      {/* form fields ovdje */}
      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          <Save className="h-4 w-4 mr-1" /> {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}
```

---

## Korak 4 — Registracija taba

Otvori `artifacts/storefront/src/pages/admin/settings.tsx` i dodaj:

```typescript
// Import
import SettingsMojTabTab from "./settings-moj-tab";

// U tabs array
{ id: "moj-tab", label: "Moj Tab", component: <SettingsMojTabTab /> }
```

---

## Checklist

- [ ] Kolone dodane u schema (`lib/db/src/schema/settings.ts`)
- [ ] `ALTER TABLE` dodан u `deploy.yml`
- [ ] GET + PUT route u `admin-settings-extra.ts`
- [ ] Frontend komponenta napravljena
- [ ] Tab registrovan u `settings.tsx`
- [ ] `pnpm run typecheck` prolazi
- [ ] Push na main
