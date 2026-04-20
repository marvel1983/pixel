# Code Patterns – Pixel-Storefront

Česti obrasci koji se koriste u ovom projektu.

---

## Backend — Drizzle ORM

### Select
```typescript
// Sve
const rows = await db.select().from(mojaTablica);

// Jedna
const [row] = await db.select().from(mojaTablica).where(eq(mojaTablica.id, id));

// Određene kolone
const [row] = await db.select({ id: mojaTablica.id, ime: mojaTablica.ime }).from(mojaTablica);

// Sa limitom
const rows = await db.select().from(mojaTablica).orderBy(desc(mojaTablica.createdAt)).limit(10);
```

### Insert
```typescript
const [created] = await db.insert(mojaTablica).values({ ime: "test" }).returning();
```

### Update
```typescript
await db.update(mojaTablica).set({ ime: "novo", updatedAt: new Date() }).where(eq(mojaTablica.id, id));
```

### Delete
```typescript
await db.delete(mojaTablica).where(eq(mojaTablica.id, id));
```

### Upsert pattern (insert ili update ako postoji)
```typescript
const [existing] = await db.select({ id: mojaTablica.id }).from(mojaTablica);
if (existing) {
  await db.update(mojaTablica).set(data).where(eq(mojaTablica.id, existing.id));
} else {
  await db.insert(mojaTablica).values(data);
}
```

---

## Frontend — API helper (admin tabovi)

Isti pattern koristi se u svakom admin tabu:

```typescript
const API = import.meta.env.VITE_API_URL ?? "/api";

const api = useCallback(async (path: string, opts?: RequestInit) => {
  const r = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...opts?.headers,
    },
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({ error: "Failed" }));
    alert(e.error);
    return null;
  }
  return r.json();
}, [token]);
```

---

## Frontend — Zustand store (čitanje)

```typescript
// Auth
const token = useAuthStore((s) => s.token);
const user = useAuthStore((s) => s.user);

// Košarica
const items = useCartStore((s) => s.items);
const getTotal = useCartStore((s) => s.getTotal);

// Valuta
const { format, code } = useCurrencyStore();
// format(9.99) → "$9.99" ili "€9.99" ovisno o odabranoj valuti
```

---

## Frontend — React Query (storefront stranice)

Generirani hookovi iz `@workspace/api-client-react`:

```typescript
import { useProducts, useProduct } from "@workspace/api-client-react";

const { data, isLoading, error } = useProducts({ page: 1, limit: 12 });
const { data: product } = useProduct({ slug: "windows-10" });
```

---

## Frontend — Routing (wouter)

```typescript
import { useLocation } from "wouter";
const [, setLocation] = useLocation();

// Navigacija
setLocation("/cart");
setLocation(`/order-complete/${orderNumber}`);
```

### Registracija nove stranice u App.tsx
```typescript
import MojaStanica from "@/pages/moja-stranica";

// U <Switch>:
<Route path="/moja-putanja" component={MojaStranica} />
```

---

## Backend — Auth middleware

```typescript
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";

// Samo prijavljeni korisnici
router.get("/moja-ruta", requireAuth, handler);

// Samo admini
router.get("/admin/moja-ruta", requireAuth, requireAdmin, handler);

// Admin sa specifičnom permisijom
router.get("/admin/moja-ruta", requireAuth, requireAdmin, requirePermission("manageSettings"), handler);

// Ručno čitanje tokena (opcionalna auth)
const authToken = req.cookies?.token || req.headers.authorization?.replace("Bearer ", "");
if (authToken) {
  try { userId = verifyToken(authToken).userId; } catch { /* guest */ }
}
```

---

## Backend — Enkriptovanje osjetljivih podataka

```typescript
import { encrypt, decrypt } from "../lib/encryption";

// Čuvanje (npr. API ključ, lozinka)
const encrypted = encrypt(req.body.apiKey);
await db.update(siteSettings).set({ apiKey: encrypted });

// Čitanje
const decrypted = decrypt(s.apiKey);
```

---

## Frontend — SEO meta

```typescript
import { setSeoMeta, clearSeoMeta } from "@/lib/seo";

useEffect(() => {
  setSeoMeta({ title: "Naslov stranice", description: "Opis stranice" });
  return () => clearSeoMeta();
}, []);
```

---

## Frontend — Toast notifikacije

```typescript
import { useToast } from "@/hooks/use-toast";
const { toast } = useToast();

toast({ title: "Uspješno!", description: "Promjene su sačuvane." });
toast({ title: "Greška", description: "Nešto je pošlo po zlu.", variant: "destructive" });
```

---

## Imenovanje

| Tip | Konvencija | Primjer |
|---|---|---|
| API endpoint | kebab-case | `/admin/settings/cpp-fees` |
| DB kolona | snake_case | `processing_fee_percent` |
| Drizzle field | camelCase | `processingFeePercent` |
| React komponenta | PascalCase | `CheckoutSummary` |
| Fajl komponente | kebab-case | `checkout-summary.tsx` |
| Tip/Interface | PascalCase | `CheckoutConfig` |
