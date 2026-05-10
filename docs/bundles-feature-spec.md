# Bundles — feature spec

**Status**: locked, ready for implementation
**Owner**: Dino
**Reviewer**: Donnie
**Last updated**: 2026-05-10

---

## 1. The model in one sentence

A **bundle** is one wrapper product (the *anchor*) whose displayed price is computed from a set of **component products** attached to it, optionally minus a discount.

The anchor is a real catalog product the customer sees and buys. The anchor itself has no inventory or keys — when the customer purchases it, fulfillment requests **all** the component keys from Metenzi and delivers them in a single message.

```
                  ┌──────────────────────────────────────────┐
                  │ ANCHOR PRODUCT                           │
                  │ (real catalog SKU, no own keys)          │
                  │                                          │
                  │   Title:    "Bundle of 3 best antivirus" │
                  │   Image:    bundle artwork               │
                  │   Slug:     /product/bundle-of-3-antivirus │
                  │   Price:    derived from components ─┐   │
                  │                                      │   │
                  │   Components (the bundle's contents):│   │
                  │   ┌────────────────────────────────┐ │   │
                  │   │ Norton 360         €49.00      │ │   │
                  │   │ Kaspersky Total    €39.00      │ │   │
                  │   │ McAfee Plus        €29.00 [FREE]│ │   │
                  │   └────────────────────────────────┘ │   │
                  │   Sum of components:    €117.00      │   │
                  │   Discount rule:       −€11.70 (10%) │   │
                  │   ──────────────────                 │   │
                  │   Anchor.price:         €105.30  ←───┘   │
                  └──────────────────────────────────────────┘
```

---

## 2. Decisions locked

### 2.1 Fulfillment
When a customer purchases an anchor, the system **requests all component keys from Metenzi in a single batch** (one message per order, listing every component product). Anchor itself has no own keys. All component keys delivered together via existing post-purchase email.

### 2.2 Anchor stock
Anchor has no real stock — it is virtual. We do **not** block a sale on anchor stock. We **do** track sales of the anchor SKU through analytics so admin can see which bundles convert. (No depletion, just a counter.)

### 2.3 BUY_X_GET_Y_FREE semantics
**Per-component flag.** Admin selects which component(s) are free in the bundle, regardless of which discount type. For BUY_X_GET_Y_FREE specifically, the flag is the rule mechanism: free components count as €0 in the sum, paid components count at full price; no extra discount applied. (Donnie's "(b)" option.)

### 2.4 Anchor product creation flow
Admin can create a new anchor product **from inside the bundle editor**: a "+ Create new anchor product" button opens a lightweight product-create modal (name, slug, image, description) that calls `POST /admin/products` with a `isBundleAnchor: true` flag, then auto-selects it as the anchor. Admin can also reuse an existing product.

---

## 3. Data model

### 3.1 `products` table — new column

| Column | Type | Default | Notes |
|---|---|---|---|
| `is_bundle_anchor` | boolean | `false` | Marks a product whose price is bundle-derived. Listing pages show its `bundle_price_usd` from the bundle row, not its variants. |

Idempotent migration: `ALTER TABLE products ADD COLUMN IF NOT EXISTS is_bundle_anchor BOOLEAN NOT NULL DEFAULT false;`

### 3.2 `bundles` table — semantics changed

| Column | Behaviour change |
|---|---|
| `primary_product_id` | Now mandatory. References `products.id` of the anchor. **Anchor is NEVER in `bundle_items`.** |
| `discount_type` | Unchanged: `PERCENTAGE` / `FIXED` / `BUY_X_GET_Y_FREE`. |
| `discount_value` | Ignored when `discount_type = BUY_X_GET_Y_FREE` (rule is enforced via `bundle_items.is_free`). |
| `min_primary_qty` | **Removed semantically** — the anchor is bought once per add-to-cart; min-qty no longer applies. Column kept for now (default 1, hidden in UI), backlog to drop. |
| `bundle_price_usd` | Cached final price, written by `computeBundlePrice` on every save. Read by listing/cart pages so they don't re-derive on every render. |

### 3.3 `bundle_items` table — new column

| Column | Type | Default | Notes |
|---|---|---|---|
| `is_free` | boolean | `false` | Per-component flag. Components flagged free count €0 in `computeBundlePrice`. |

Idempotent migration: `ALTER TABLE bundle_items ADD COLUMN IF NOT EXISTS is_free BOOLEAN NOT NULL DEFAULT false;`

### 3.4 `cart_lines` / order line snapshot
When the anchor is added to the cart, we freeze a snapshot on the cart line:

```ts
{
  bundleId: number;
  bundleSlug: string;
  bundleName: string;
  anchorProductId: number;
  rule: { discountType, discountValue, minPrimaryQty };
  components: Array<{
    productId: number;
    productName: string;
    unitPriceUsd: string;     // captured AT add-to-cart
    isFree: boolean;
    lineTotalUsd: string;     // 0 if free, else unitPriceUsd
  }>;
  pricing: {
    sumOriginalUsd: string;
    finalUsd: string;         // anchor.price = this
    savingsUsd: string;
  };
  capturedAt: string;
}
```

The same shape is already defined in `services/bundle-pricing.ts` (`BundleCartSnapshot`); the change is what `components` contains (no anchor) and that `is_free` flag is now real per-item.

### 3.5 Migration of existing bundles
Existing bundles on prod were saved under the **wrong** model (anchor was inside `bundle_items`). Migrate idempotently:

```sql
-- Move anchor out of bundle_items
DELETE FROM bundle_items
 WHERE (bundle_id, product_id) IN (
   SELECT b.id, b.primary_product_id
     FROM bundles b
    WHERE b.primary_product_id IS NOT NULL
 );

-- Mark anchor products
UPDATE products SET is_bundle_anchor = true
 WHERE id IN (SELECT DISTINCT primary_product_id FROM bundles WHERE primary_product_id IS NOT NULL);

-- Recompute bundle_price_usd via the new pricing engine
-- (done in app code on next save, or one-shot SQL backfill — see §6)
```

---

## 4. Pricing engine

`artifacts/api-server/src/services/bundle-pricing.ts`

### 4.1 New input shape

```ts
type BundleDiscountType = "PERCENTAGE" | "FIXED" | "BUY_X_GET_Y_FREE";

interface BundleComponentInput {
  productId: number;
  unitPriceUsd: string;
  isFree: boolean;          // new — replaces isPrimary
}

interface BundleRuleInput {
  discountType: BundleDiscountType;
  discountValue: string;
}
// minPrimaryQty removed from input
```

### 4.2 Algorithm

```
sumOriginal = Σ (component.unitPriceUsd for each component)
sumPaid     = Σ (component.unitPriceUsd for components where !isFree)

switch (rule.discountType):
  PERCENTAGE       → final = sumPaid × (1 − rule.discountValue/100)
  FIXED            → final = max(0, sumPaid − rule.discountValue)
  BUY_X_GET_Y_FREE → final = sumPaid       (the rule IS the is_free flags)

savings = sumOriginal − final

return {
  sumOriginalUsd: sumOriginal,
  finalUsd: final,
  savingsUsd: savings,
  components: same components, with lineTotalUsd = 0 if isFree else unitPriceUsd,
}
```

Single rounding via `roundMoney` (already exists). Stacking order in cart pipeline unchanged (bundle → loyalty → coupon).

### 4.3 Worked examples

**Example 1 — 10% off, no free items**
- Norton €49, Kaspersky €39, McAfee €29 → sum = €117
- 10% off → final = €117 × 0.9 = **€105.30**, savings = €11.70

**Example 2 — Buy 2 paid, 1 free**
- Norton €49, Kaspersky €39, McAfee €29 (flagged free)
- sumPaid = €88, BUY_X_GET_Y_FREE → final = **€88**, savings = €29

**Example 3 — €15 off + 1 free**
- Norton €49 (flagged free), Kaspersky €39, McAfee €29
- sumPaid = €68, FIXED €15 → final = **€53**, savings = €64

---

## 5. Backend changes

### 5.1 `POST /admin/bundles` and `PUT /admin/bundles/:id`
Body shape:
```ts
{
  name: string;
  slug: string;
  description: string | null;
  shortDescription: string | null;
  imageUrl: string | null;
  isActive: boolean;
  isFeatured: boolean;
  metaTitle: string | null;
  metaDescription: string | null;
  sortOrder: number;
  primaryProductId: number;            // required, MUST NOT be in productIds
  discountType: BundleDiscountType;
  discountValue: string;               // ignored for BUY_X_GET_Y_FREE
  productIds: number[];                // components only, min 1, no duplicates
  freeProductIds: number[];            // subset of productIds; per-item is_free flag
}
```

Validation:
- `primaryProductId` exists and is active
- `primaryProductId NOT IN productIds`
- `productIds.length >= 1`
- `freeProductIds ⊆ productIds`
- For `PERCENTAGE`: `0 ≤ discountValue ≤ 100`
- For `FIXED`: `discountValue ≥ 0` and ≤ sumPaid
- For `BUY_X_GET_Y_FREE`: `freeProductIds.length ≥ 1`

Side effects on save:
1. Set `products.is_bundle_anchor = true` for `primaryProductId`
2. Insert `bundle_items` for each component with `is_free` flag
3. Compute and write `bundles.bundle_price_usd` from the engine
4. Touch `products.updated_at` for the anchor (so caches invalidate)

### 5.2 `POST /admin/bundles/preview`
Same body as above (productIds, primary, rule, free flags). Returns the `BundlePricing` result so the editor's live preview matches the server.

### 5.3 `POST /admin/products/anchor`
New helper endpoint for the "+ Create new anchor product" button in the editor:
```ts
{ name, slug, imageUrl?, shortDescription? }
→ creates a product with isBundleAnchor=true, isActive=true (draft), no variants
→ returns the new product so the editor can immediately select it as anchor
```

### 5.4 `GET /products/:slug` (public, storefront)
When `product.is_bundle_anchor === true`, the response includes a `bundle` field:
```ts
bundle: {
  id, slug, discountType, discountValue,
  components: Array<{ productId, name, imageUrl, slug, unitPriceUsd, isFree }>,
  pricing: { sumOriginalUsd, finalUsd, savingsUsd },
}
```
Otherwise `bundle: null`. The storefront detail page checks this field and renders the bundle UI when present.

### 5.5 Order creation — fulfillment hook
When an order is placed and any line item references a bundle anchor:
1. Read the cart-line snapshot to get `components: [...]`.
2. Build a single Metenzi key request with **all component product IDs** in one batch.
3. On Metenzi response, attach all keys to the order under the anchor's order_item.
4. Email sends one message containing all keys grouped under the bundle title.

The Metenzi adapter already supports multi-key requests; the batch is built in `services/order-fulfillment.ts` (or wherever the existing single-key flow lives — confirm during implementation).

---

## 6. Storefront (Phase 1B)

### 6.1 Product detail page (`/product/:slug`)
If `product.bundle` is set:
- Hide the standard variant/SKU/Add-to-cart block
- Render the bundle UI from `bundle-edit-preview.tsx` (extracted into a shared `BundleHero` component used by both admin preview and live storefront)
- Components list is clickable → each links to its own product page
- "Add bundle to cart" adds the anchor with the snapshot

### 6.2 Listing pages
Anchor products show their `bundle_price_usd` as the listing price. A "Bundle" tag appears on the card. Sorting and filtering work as for any other product.

### 6.3 Cart line
One line per bundle, anchor name, anchor image, bundle price. Expandable "What's included" sub-list (read-only) showing components and their FREE/€X breakdown. Standard quantity selector for bundle units.

---

## 7. Admin editor changes

`pages/admin/bundle-edit.tsx` and form/preview components.

### 7.1 Sections
| Section | Change |
|---|---|
| Bundle name & URL | (No change.) |
| **Anchor product** | Renamed to "Bundle product page" with hint "the catalog product customers will land on". Picker shows products, plus a "+ Create new anchor product" affordance at the top of the picker that opens an inline create modal. |
| **What's in this bundle** | Renamed from "Companion products". Each row gets a **"Free in bundle"** checkbox (per-component flag) — visible always, but only meaningful when admin uses BUY_X_GET_Y_FREE rule, OR when admin wants to give one item free even with a percentage discount. |
| Discount rule | Same three cards. **Min anchor qty input removed.** Discount value input hidden for BUY_X_GET_Y_FREE. |
| Cover image | (No change — drop-zone with thumbnail.) |
| Description | (No change.) |
| SEO / Advanced | (No change, collapsed by default.) |

### 7.2 Validation
Editor blocks save if:
- Anchor not selected, or anchor is also in components
- Fewer than 1 component
- BUY_X_GET_Y_FREE chosen but no component flagged free
- PERCENTAGE > 100 or < 0; FIXED > sumPaid; either negative

### 7.3 Live preview pane
Already correct in shape. After this refactor, `BundleEditPreview` consumes the new `pricing` and component list (with `isFree` flags); the preview renders FREE pills for flagged items and uses `anchor.image / anchor.name` as the hero (because the anchor IS the bundle's customer-facing product page).

---

## 8. Migrations & rollout

### 8.1 Idempotent SQL in `.github/workflows/deploy.yml`
```sql
-- products: anchor flag
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_bundle_anchor BOOLEAN NOT NULL DEFAULT false;

-- bundle_items: per-item free flag
ALTER TABLE bundle_items ADD COLUMN IF NOT EXISTS is_free BOOLEAN NOT NULL DEFAULT false;

-- 1-time correction: remove anchor rows from bundle_items
DELETE FROM bundle_items
 WHERE (bundle_id, product_id) IN (
   SELECT b.id, b.primary_product_id FROM bundles b WHERE b.primary_product_id IS NOT NULL
 );

-- mark anchor products
UPDATE products SET is_bundle_anchor = true
 WHERE id IN (SELECT DISTINCT primary_product_id FROM bundles WHERE primary_product_id IS NOT NULL);

-- backfill bundle_price_usd from engine
-- (done in JS by re-saving each bundle once after deploy; OR raw SQL recompute)
```

The recompute can be done one-shot on the server via a Node script or by hitting `PUT /admin/bundles/:id` for each bundle.

### 8.2 Phases

| Phase | Scope | Effort | Notes |
|---|---|---|---|
| **1A** | Backend pricing + endpoints + migration | ~2h | Includes per-item is_free, primaryProductId required, products.is_bundle_anchor flag |
| **1B** | Admin editor: rename labels, add free checkboxes, add "Create new anchor" button, drop min-qty, validation | ~2h | Only after 1A backend is deployed |
| **1C** | Storefront product detail page renders bundle UI when `bundle != null`; anchor listing card shows bundle price | ~2h | |
| **1D** | Cart snapshot + checkout pass-through (fixes the "cart discount lost on checkout" bug) | ~1.5h | |
| **1E** | Order fulfillment: single Metenzi batch for components | ~1.5h | |
| **2** | SWC sync via `/sync-swc` | ~30 min | |

Total Phase 1 implementation: ~9h. Each phase is independently deployable.

---

## 9. Out of scope / backlog

- Per-item free flag inside non-BUY_X_GET_Y_FREE rules — covered by data model but UX may de-emphasize until needed
- Time-limited bundles (`valid_from` / `valid_until`)
- Region-level overrides on the bundle (today: inherit from anchor)
- Anchor stock counter / depletion (only sales analytics for now)
- A/B testing on bundle pages
- Subscription bundles
- Audit log for bundle rule changes

---

## 10. Open questions to confirm in PR review

- Confirm the Metenzi batch endpoint name and expected payload shape for multi-product key requests
- Confirm whether anchor product needs to support having variants at all — recommendation: no variants (just one synthetic SKU), block variant creation in the product editor when `is_bundle_anchor = true`
- Confirm cart UI for bundle line — collapsible vs. always-expanded sub-list

---

**Approved direction by Donnie:** phased rollout, locked decisions on quantity semantics, snapshot, rounding, stacking, OOS conservative.

**Approved by Dino:** anchor-as-meta-product model, fulfillment pulls all component keys in one Metenzi call, sales analytics for anchor (no stock), per-component free flag (option b), in-editor anchor creation.
