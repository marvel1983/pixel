# Code Quality & Complexity – Pixel-Storefront

## Zlatno pravilo

> Može li senior developer razumjeti šta ovaj kod radi za 30 sekundi?

Ako da → u redu je, bez obzira na broj linija.
Ako ne → problem nije broj linija, nego struktura.

Broj linija je samo simptom. Pravi neprijatelj je **kognitivna kompleksnost**.

---

## Limiti (bazirani na industrijskim standardima)

| | ⚠️ Upozorenje — razmisli | 🛑 Obavezno podijeli |
|---|---|---|
| **Fajl** | 400 linija | 600 linija |
| **Funkcija / handler** | 50 linija | 80 linija |
| **React komponenta** | 200 linija | 300 linija |
| **Props** | 8 propova | 12 propova |
| **Nesting** | 3 nivoa | 4 nivoa |
| **Parametri funkcije** | 4 | 6 |

> Napomena: `checkout.tsx`, `orders.ts`, `checkout-session.ts` su historijski prekoračili ove limite
> zbog kompleksnosti checkout toka — to je prihvatljivo kao izuzetak ako se ne može smisleno razbiti.

---

## Protokol — 3 faze

### FAZA 1: Prije nego počneš pisati

Provjeri sve fajlove koje ćeš modificirati:

```bash
wc -l artifacts/api-server/src/routes/orders.ts
wc -l artifacts/storefront/src/pages/checkout.tsx
```

Ako je fajl već u ⚠️ zoni → planiraj da ga refaktorišeš tokom rada, ne poslije.
Ako je u 🛑 zoni → predloži split PRIJE implementacije.

---

### FAZA 2: Tokom pisanja — kognitivni check

Na svakih ~50 novih linija, postavi sebi ova pitanja:

**1. Single Responsibility**
- Radi li ovaj fajl/funkcija jednu stvar?
- Mogu li opisati što radi u jednoj rečenici bez "i" ili "ali"?

**2. Naming**
- Govori li ime funkcije/varijable tačno što radi?
- Da li trebaš komentar da objasniš što radi? → Preimenuj, ne komentiraj.

**3. Nesting**
- Ima li više od 3 nivoa uvlačenja?
- Ako da → izvuci logiku u helper funkciju ili early return.

**4. Duplicacija**
- Vidim li isti pattern 2+ puta?
- Ako da → izvuci u funkciju odmah, ne čekaj treći put.

---

### FAZA 3: Na kraju implementacije — checklist

- [ ] Svaki fajl koji sam dotakao je ispod 600 linija
- [ ] Nijedna funkcija nije duža od 80 linija
- [ ] Nema nesting-a dubljeg od 4 nivoa
- [ ] Nema nekorišćenih importa ili varijabli (moje izmjene)
- [ ] `pnpm run typecheck` prolazi čisto

---

## Kada i kako dijeliti fajlove

### React komponenta postaje prevelika

```
checkout.tsx (400+ linija)
    ↓ izvuci u:
checkout-billing.tsx      ← BillingForm logika
checkout-payment.tsx      ← payment method logika
checkout-totals.ts        ← helper funkcije za računanje totala
```

### API route postaje prevelik

```
orders.ts (500+ linija)
    ↓ izvuci u:
orders-validation.ts      ← validacija inputa, provjera cijena
orders-pipeline.ts        ← order kreiranje, fulfillment (već postoji!)
orders.ts                 ← samo route handleri
```

### Helper funkcije koje se ponavljaju

```typescript
// Umjesto ponavljanja u checkout.tsx i checkout-session.ts:
// Izvuci u: lib/checkout-math.ts
export function computeProcessingFee(base: number, pct: number, fixed: number) { ... }
export function computeTotal(params: TotalParams) { ... }
```

---

## Kognitivna kompleksnost — praktični primjeri

### 🛑 Visoka kompleksnost (refaktorisi)

```typescript
// 4 nivoa nesting-a, teško za čitanje
async function processOrder(data) {
  if (data.items) {
    for (const item of data.items) {
      if (item.variantId > 0) {
        if (item.bundleId) {
          // logika...
        }
      }
    }
  }
}
```

### ✅ Niska kompleksnost (dobro)

```typescript
// Isti cilj, čitljivo
async function processOrder(data) {
  const validItems = data.items?.filter(isValidItem) ?? [];
  for (const item of validItems) {
    await processItem(item);
  }
}

function isValidItem(item: Item) {
  return item.variantId > 0;
}
```

---

## Early return — umjesto dubokog nesting-a

```typescript
// 🛑 Izbjegavaj
function handler(req, res) {
  if (user) {
    if (user.isAdmin) {
      if (data.isValid) {
        // glavna logika
      } else {
        res.status(400).json({ error: "Invalid" });
      }
    } else {
      res.status(403).json({ error: "Forbidden" });
    }
  } else {
    res.status(401).json({ error: "Unauthorized" });
  }
}

// ✅ Koristi early return
function handler(req, res) {
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (!user.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }
  if (!data.isValid) { res.status(400).json({ error: "Invalid" }); return; }

  // glavna logika ovdje — bez nesting-a
}
```

---

## Što NE raditi

- ❌ Dijeliti fajl samo da bi pogodio limit — ako split otežava čitanje, ne dijeliti
- ❌ Praviti apstrakcije za jednu upotrebu
- ❌ Dodavati "flexibility" koja nije tražena
- ❌ Refaktorisati tuđi kod koji nije vezan za trenutni zadatak
- ❌ Komentare umjesto boljeg imenovanja

---

## Referentni standardi

| Standard | File limit | Function limit |
|---|---|---|
| SonarQube default | 1000 linija | Cognitive complexity < 15 |
| ESLint max-lines | 300 (default), 500 (praksa) | — |
| Google Style Guide | Nema hard limit | Single responsibility |
| Ovaj projekt | 600 linija (hard) | 80 linija (hard) |
