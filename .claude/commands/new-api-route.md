# New API Route – Pixel-Storefront

## Gdje se dodaju rute

Sve rute su u `artifacts/api-server/src/routes/`.  
Registruju se u `artifacts/api-server/src/routes/index.ts`.

---

## Tipovi ruta

| Tip | Middleware | Primjer fajla |
|---|---|---|
| Javna | ništa | `checkout-offers.ts` |
| Autentifikovana (korisnik) | `requireAuth` | `orders.ts` |
| Admin | `requireAuth, requireAdmin` | `admin-settings-extra.ts` |
| Admin sa permisijom | `requireAuth, requireAdmin, requirePermission("X")` | `admin-settings-extra.ts` |

---

## Template — javna ruta

```typescript
import { Router } from "express";
import { db } from "@workspace/db";
import { siteSettings } from "@workspace/db/schema";

const router = Router();

router.get("/moja-ruta", async (_req, res) => {
  try {
    const [s] = await db.select().from(siteSettings);
    res.json({ podatak: s?.nekiPodatak ?? "default" });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
```

---

## Template — admin ruta (GET + PUT)

```typescript
import { Router } from "express";
import { db } from "@workspace/db";
import { siteSettings } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";

const router = Router();

router.get("/admin/settings/moja-stvar", requireAuth, requireAdmin, requirePermission("manageSettings"), async (_req, res) => {
  const [s] = await db.select().from(siteSettings);
  res.json({
    mojaOpcija: s?.mojaOpcija ?? false,
  });
});

router.put("/admin/settings/moja-stvar", requireAuth, requireAdmin, requirePermission("manageSettings"), async (req, res) => {
  try {
    const [existing] = await db.select({ id: siteSettings.id }).from(siteSettings);
    const data = {
      mojaOpcija: Boolean(req.body.mojaOpcija),
      updatedAt: new Date(),
    };
    if (existing) {
      await db.update(siteSettings).set(data).where(eq(siteSettings.id, existing.id));
    } else {
      await db.insert(siteSettings).values(data);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message ?? "DB error" });
  }
});

export default router;
```

---

## Template — ruta sa URL parametrom

```typescript
import { paramString } from "../lib/route-params";

router.get("/admin/stvari/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(paramString(req.params, "id"));
  if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [item] = await db.select().from(mojaTablica).where(eq(mojaTablica.id, id));
  if (!item) { res.status(404).json({ error: "Not found" }); return; }

  res.json(item);
});
```

---

## Registracija nove rute u index.ts

```typescript
// 1. Import na vrhu fajla
import mojaRutaRouter from "./moja-ruta";

// 2. Registracija (na dnu, sa ostalim routerima)
router.use(mojaRutaRouter);
```

---

## Dostupne permisije za requirePermission()

```
"manageSettings"
"manageProducts"
"manageOrders"
"manageUsers"
"manageAffiliates"
"viewReports"
```

---

## Važna pravila

- **Uvijek try/catch** za DB operacije u PUT/POST rutama
- **Admin rute su exempt od CSRF** (u `middleware/csrf.ts`) — koriste Bearer JWT
- **Javne rute prolaze kroz CSRF** za POST/PUT — frontend mora slati `x-csrf-token` header
- **Koristiti `paramString()`** za URL parametre, ne `req.params.id` direktno
- **Fajlovi max 300 linija** — ako je veći, podijeli u više fajlova
