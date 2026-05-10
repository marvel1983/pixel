# Bundles — feature spec

**Status**: locked, ready for implementation (post-Donnie review)
**Owner**: Dino
**Reviewer**: Donnie
**Last updated**: 2026-05-10 (rev 2)

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

### 2.3 Per-component `is_free` flag (all rule types)
Admin can mark any component as free in the bundle, **for every discount type** — not just `BUY_X_GET_Y_FREE`. Free components count as €0 in the sum; the chosen rule (percentage / fixed / buy-anchor-rest-free) applies to the remaining sum. This is in v1 — see §4.3 examples.

For `BUY_X_GET_Y_FREE` specifically, the `is_free` flag IS the rule mechanism — no extra `discount_value` is applied beyond the flagged components. (Donnie's "(b)" option.)

### 2.4 Anchor product creation flow
Admin can create a new anchor product **from inside the bundle editor**: a "+ Create new anchor product" button opens a lightweight product-create modal (name, slug, image, description) that calls the **existing** `POST /admin/products` with an `isBundleAnchor: true` flag in the body, then auto-selects the new product as the anchor. Admin can also reuse a product that already exists. **No new endpoint** — keeps API surface minimal (Donnie's review).

### 2.5 URL strategy
Bundles do **not** have their own URL space. The bundle's customer-facing page is the anchor product's standard `/product/:slug`. There is no `/bundles/...` route, no separate sitemap entry — SEO lives on the anchor's product page. Marketing should link to `/product/<anchor-slug>`.

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
| `min_primary_qty` | **Removed semantically AND from runtime.** The anchor is bought once per add-to-cart; min-qty no longer applies. Column stays in DB at default `1` for migration safety only — **engine ignores it**, snapshot does not carry it, admin UI does not surface it. Backlog: drop the column entirely once no production row has `min_primary_qty != 1`. <br><br>**Use-case lost**: "buy 3 Windows, get Office free" can't be expressed in this model. v1 workaround: create three separate component rows for the same Windows product, two of them flagged free — clunky UX, accepted. Tracked as backlog (§9). |
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
  rule: {
    discountType: BundleDiscountType;
    discountValue: string;
    // NOTE: minPrimaryQty intentionally NOT in snapshot — see §3.2.
    // If you find it serialized into a snapshot, that's a stale code path.
  };
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

The same shape is already defined in `services/bundle-pricing.ts` (`BundleCartSnapshot`); the changes are: `components` no longer includes the anchor, `is_free` is now a real per-item field, and `minPrimaryQty` is dropped from `rule`.

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
// minPrimaryQty fully removed: not in input, not in snapshot, not in engine.
// Column kept in DB at default 1 only as a no-op migration shim.
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

### 5.3 Anchor creation — reuse `POST /admin/products`
**No new endpoint.** The "+ Create new anchor product" button in the bundle editor calls the **existing** `POST /admin/products` with `{ isBundleAnchor: true, name, slug, imageUrl?, shortDescription? }`. The handler creates the product as a draft with no variants needed (anchor is virtual). Returns the new product; the editor immediately selects it as the anchor.

This decision (Donnie's review): keeps API surface minimal, no extra OpenAPI/auth/test scaffolding, no admin-client codegen change. The handler internally branches on `isBundleAnchor` to skip variant requirement.

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

### 5.6 Cart line identity & order_items mapping
- **One cart line per bundle.** Variant ID on the cart line is the anchor's primary variant (auto-created at anchor save if it doesn't exist — anchor needs at least one variant row to satisfy existing FK constraints, but it carries no keys).
- **One `order_items` row per bundle.** The row stores the anchor's variant ID and a `bundle_id` reference + the snapshot JSON (so the order is self-contained even if the bundle is later edited or deleted).
- **Multiple deliveries on a single `order_items` row.** Existing `license_keys` schema already allows N keys per `order_item` — for bundles, those N rows are the component keys returned by Metenzi. No schema change to license_keys.
- Invoice and email group keys under the bundle title, not the underlying SKU names — driven by the snapshot.

### 5.7 Currency
- All math runs in **base USD** using the existing `*Usd` columns and the same rounding helper as the rest of the cart.
- Storefront formats via the existing currency store (USD → display currency on render). Bundle has no currency-specific code path — same as any product.
- Snapshot stores prices in USD. Display conversion happens in the React layer at render time.

### 5.8 Bridging legacy `loadBundlePriceMap`
The current `services/bundle-pricing.ts` has a legacy ratio-distribution function (`loadBundlePriceMap`) used by the order pipeline to spread the cached `bundle_price_usd` across the bundle's variants. Approach:

| State | Behaviour |
|---|---|
| **New bundle** (created post-rollout) | Cart adds anchor → snapshot → order_items uses snapshot for price + Metenzi batch. `loadBundlePriceMap` is **not called**. |
| **Open cart with old bundle** (created pre-rollout, still in someone's cart) | Migration removes the anchor from `bundle_items` on deploy; the old cart line still references variant IDs of components. We add a one-shot revalidation: on cart load, if a line references a bundle, refetch via the new pricing engine and replace the line's snapshot. If revalidation fails, drop the bundle line and toast the customer. |
| **Already-placed orders** (closed) | Untouched — `loadBundlePriceMap` keeps working for any post-purchase operations (refund calc, invoice re-issue). |

`loadBundlePriceMap` stays in the codebase. It is only used by post-purchase paths now; cart and checkout never hit it. Backlog: remove it after a 90-day window with no historical reads.

### 5.9 Component validation (save + read)
- **On `POST/PUT /admin/bundles`**: every component in `productIds` must be `is_active = true` AND have at least one `product_variants.is_active = true` row. Save fails with a clear error listing offending components.
- **On `GET /products/:slug` (anchor)**: if any component is currently inactive OR has zero available keys (per Metenzi adapter's stock signal), return `bundle: null` — the storefront falls back to "Currently unavailable" and hides the Add-to-cart CTA. Do **not** silently exclude the unavailable component from the bundle.
- **On checkout**: re-run the same validation against the cart's snapshot. If anything changed since add-to-cart (component went inactive, keys dried up), surface a blocking error and offer to remove the bundle line.

---

## 6. Storefront (Phase 1B)

### 6.1 Product detail page (`/product/:slug`)
If `product.bundle` is set:
- Hide the standard variant/SKU/Add-to-cart block
- Render a bundle UI: hero (anchor name + image), components list, pricing breakdown, single Add-to-cart CTA
- Components list is clickable → each links to its own product page
- "Add bundle to cart" adds the anchor with the snapshot

**Component reuse policy (Donnie's review)**: the admin live preview (`bundle-edit-preview.tsx`) and the public storefront PDP bundle UI may share a thin presentational subcomponent for the components-list-and-pricing block if their props converge cleanly. Do **not** force one component for both — admin is dark-themed inside an admin shell and gets fed form state; storefront is brand-themed and gets fed API data. Different auth, different formatting, often different fields (e.g. SEO meta on PDP only). Allow them to diverge if it's cleaner.

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
| **1A** | Backend pricing + endpoints + migration + legacy bridge | ~3h | Includes per-item is_free, primaryProductId required, products.is_bundle_anchor flag, idempotent SQL to fix existing bundles, validation (component active + has keys) |
| **1B** | Admin editor: rename labels, free checkboxes per component, "+ Create new anchor" inline modal, drop min-qty, validation, error states | ~3h | Only after 1A backend is deployed |
| **1C** | Storefront PDP: bundle UI when `product.bundle != null`; anchor listing card shows bundle price | ~2.5h | |
| **1D** | Cart snapshot + checkout pass-through + revalidation flow (fixes the "cart discount lost on checkout" bug) | ~2h | Includes the open-cart bridge from §5.8 |
| **1E** | Order fulfillment: single Metenzi batch for components, 1 order_item with N license_keys | ~2h | Confirm Metenzi adapter API during implementation (open Q §10) |
| **2** | SWC sync via `/sync-swc` | ~30 min | |

Total Phase 1: **~12.5h** (Donnie flagged earlier 9h estimate as agressive given reconciliation with `loadBundlePriceMap`, E2E checks, and validation paths). Each phase is independently deployable.

---

## 9. Out of scope / backlog

- **"Buy 3 of X, get Y free" quantity gates** — the lost min-qty use-case (§3.2). v1 workaround is N component rows, but a proper rule-level quantity gate would need its own column and engine branch. Revisit when marketing demands it.
- **Time-limited bundles** (`valid_from` / `valid_until`) — add as non-breaking migration when needed
- **Region-level overrides** on the bundle — today: inherit from anchor's regions
- **Anchor stock depletion** — only sales analytics in v1, no inventory blocking
- **A/B testing** on bundle pages
- **Subscription bundles**
- **Audit log** for bundle rule changes (Donnie's earlier suggestion — backlog when finance asks)
- **`/bundles/...` route as first-class citizen** — today bundles live on the anchor PDP only. Add a dedicated route only if discoverability becomes a real problem.
- **Drop `min_primary_qty` column entirely** — once no production row has `min_primary_qty != 1` for ≥30 days
- **Drop `loadBundlePriceMap` legacy ratio code** — once no historical post-purchase path has read it for ≥90 days

---

## 10. Open questions to confirm in PR review

- **Metenzi batch endpoint** — confirm the multi-product key request payload shape and whether the existing adapter supports it natively or needs a wrapper
- **Anchor variants** — recommendation: anchor auto-gets a single synthetic variant on save (cheapest path through existing FK constraints), block manual variant creation in the product editor when `is_bundle_anchor = true`. Confirm or reject.
- **Cart UI for bundle line** — collapsible "What's included" sub-list vs. always-expanded. Recommendation: collapsible, default closed, expand-on-click. Confirm or reject.
- **Stale snapshot on checkout** — when revalidation fails (component went inactive between add-to-cart and checkout), do we (a) drop the bundle line silently with a toast, or (b) block checkout until customer acts? Recommendation: (b) — explicit confirmation, less surprising. Confirm or reject.

---

**Approved direction by Donnie (rev 1):** phased rollout, locked decisions on quantity semantics, snapshot, rounding, stacking, OOS conservative.

**Donnie's rev-2 review applied:**
- §9 vs §7.1 contradiction on per-item free flag scope — resolved: in v1 for all rule types
- `minPrimaryQty` removed from snapshot type and engine, not just from UI
- Availability/OOS behaviour explicit on PDP, cart, and checkout (§5.9)
- Anchor creation reuses `POST /admin/products` instead of new endpoint (§5.3)
- `BundleHero` reuse softened — shared subcomponent allowed but not forced (§6.1)
- Legacy `loadBundlePriceMap` bridge documented (§5.8)
- Cart line identity → order_items mapping documented (§5.6)
- Currency: USD base, currency store handles display (§5.7)
- Component validation explicit on save AND read AND checkout (§5.9)
- URL strategy clarified: anchor PDP only, no `/bundles/...` route (§2.5)
- 9h estimate bumped to ~12.5h (§8.2)

**Approved by Dino:** anchor-as-meta-product model, fulfillment pulls all component keys in one Metenzi call, sales analytics for anchor (no stock), per-component free flag (option b), in-editor anchor creation.
