# Checkout Flow – Pixel-Storefront

## KRITIČNO: Formula totala mora biti identična na 4 mjesta

Svaki put kad se mijenja logika računanja totala, moraju se ažurirati SVI:

| Fajl | Svrha |
|---|---|
| `artifacts/storefront/src/pages/checkout.tsx` | `handleSubmit()` — šalje total na backend |
| `artifacts/storefront/src/components/checkout/checkout-summary.tsx` | Prikazuje total korisniku |
| `artifacts/api-server/src/routes/checkout-session.ts` | Stripe plaćanje — verifikuje total |
| `artifacts/api-server/src/routes/orders.ts` | Wallet/Net30 plaćanje — verifikuje total |

Ako ova 4 mjesta nisu sinkrona → **"Total mismatch. Please refresh and try again."**

---

## Tačna formula totala

```
subtotal       = suma svih stavki u korpi
discountAmount = couponDiscount + loyaltyDiscount
cppAmount      = cppSelected ? siteSettings.cppPrice : 0   (flat fee, NE %)
feeBase        = subtotal - discountAmount + cppAmount + servicesAmount
processingFee  = round(feeBase * (feePercent / 100) + feeFixed, 2)
beforeTax      = feeBase + processingFee
taxAmount      = izračunato na beforeTax (inclusive ili exclusive)
preGcTotal     = inclusive ? beforeTax : beforeTax + taxAmount
gcDeduction    = suma primijenjenih gift kartica
total          = max(0, preGcTotal - gcDeduction)
cardTotal      = max(0, total - walletAmount)
```

---

## Redoslijed primjene popusta i naknada

```
1. Subtotal (cijene stavki × količine)
2. - Coupon popust
3. - Loyalty popust
4. + CPP (flat iznos iz siteSettings.cppPrice)
5. + Add-on services
6. + Processing fee (% od feeBase + fixed)
7. + Tax (na beforeTax = feeBase + processingFee)
8. - Gift kartice
9. - Wallet
   = Iznos za karticu (Stripe)
```

---

## CPP — važne napomene

- CPP je **flat fee** (npr. $0.50), **NE postotak** od subtotala
- Iznos se čita iz `siteSettings.cppPrice` (admin može mijenjati)
- CPP se prikazuje samo ako je `siteSettings.cppEnabled = true`
- Stari kod koristio `CPP_RATE = 0.05` (5% od subtotala) — to je pogrešno, uklonjeno

---

## Processing fee — važne napomene

- Čita se iz `siteSettings.processingFeePercent` i `siteSettings.processingFeeFixed`
- Primjenjuje se na `feeBase` (nakon svih popusta, CPP i servisa)
- Prikazuje se kao narančasta linija u order summary
- Backend čita iz baze pri svakom orderu — ne može se "lažirati" s frontenda

---

## Gdje se config čita

### Frontend
```typescript
// checkout.tsx — fetch pri loadu stranice
fetch(`${API}/checkout/config`)
// vraća: cppEnabled, cppLabel, cppPrice, processingFeePercent, processingFeeFixed
```

### Backend (oba checkout route-a)
```typescript
const [feeSettings] = await db.select({
  cppPrice: siteSettings.cppPrice,
  processingFeePercent: siteSettings.processingFeePercent,
  processingFeeFixed: siteSettings.processingFeeFixed,
}).from(siteSettings);
```

---

## Total mismatch tolerancija

Backend dozvoljava razliku od **±$0.02** zbog floating point zaokruživanja:
```typescript
if (Math.abs(computedTotal - parseFloat(total)) > 0.02) {
  res.status(400).json({ error: "Total mismatch. Please refresh and try again." });
}
```

---

## Flow plaćanja

```
Korisnik klikne "Continue to Payment"
        ↓
POST /checkout/session  (Stripe)
        ↓
Redirect na Stripe hosted page
        ↓
Stripe webhook → POST /webhooks/stripe
        ↓
Order status: PENDING → COMPLETED
        ↓
Email sa licence ključevima

── ILI (wallet/net30) ──

POST /orders
        ↓
Direktno kreiranje narudžbe
        ↓
Redirect na /order-complete/:orderNumber
```

---

## Checkout komponente (frontend)

```
checkout.tsx
├── BillingForm          — ime, email, adresa, telefon
├── CppSection           — CPP opcija (prikazuje se samo ako cppEnabled)
├── CheckoutServices     — add-on servisi
├── GiftCardInput        — gift kartice
├── LoyaltyRedeem        — loyalty poeni
├── WalletPayment        — wallet balans
└── CheckoutSummary      — order summary sa svim linijama
```
