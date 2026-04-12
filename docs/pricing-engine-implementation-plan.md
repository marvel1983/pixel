# Pricing engine — implementation plan (Pixel-Storefront)

This document is the **single source of truth** for rolling out a unified pricing model across DB, API, admin, storefront, checkout, and operations. It assumes the **target architecture** agreed in the pricing design discussion (effective price resolution, price lists, rules, audit).

---

## 0. Goals and success criteria

### Business goals

- One **canonical server-side** price for every `(variant, quantity, customer context, time)` used at **checkout** and reflected in **listing/PDP/cart** (within defined tolerance).
- Support **retail default**, future **B2B lists**, **campaigns**, and **bulk tiers** without ad-hoc columns diverging (e.g. `price_override` vs `price_usd`).
- **Auditability**: who changed what, when, and optional reason (compliance / internal ops).

### Technical success criteria

- `POST /orders` validates line prices **only** via the shared **price resolution** module (no duplicate logic).
- Search/sort/filter by price uses the **same** effective unit price definition as guest (or explicitly documented divergences).
- **Zero or bounded** N+1 queries on hot paths (batch resolution API + caching where needed).
- **Feature flag** allows staged rollout; **rollback** path documented.
- **E2E** covers: guest checkout, logged-in user, flash sale line, bundle line, coupon on top (unchanged contract), optional price list when implemented.

### Non-goals (initial phases)

- Full multi-currency settlement (beyond storing `currency` on lists / preparing amounts).
- ML/dynamic pricing.
- Replacing **gift card / wallet / loyalty** math (they remain cart-level adjustments after line totals).

---

## 1. Current-state inventory (must not miss)

Audit every consumer of `product_variants.price_usd`, `compare_at_price_usd`, `price_override_usd`:

| Area | Location (representative) | Risk today |
|------|---------------------------|------------|
| Order validation | `artifacts/api-server/src/routes/orders.ts` (`validateAndPriceItems`) | Uses only `price_usd`; may diverge from admin “storefront” override |
| Search / listing | `artifacts/api-server/src/routes/search.ts` | `price_usd`, min-price subquery on `price_usd` |
| Flash sales | `getFlashSaleInfo`, `flash_sale_products` | Must slot into priority stack |
| Bundles | `loadBundlePriceMap`, `bundle-pricing` service | Keep as **pre-emptive** branch |
| Bulk tiers | `bulk_pricing_tiers`, `/bulk-pricing/:productId` | Today informational + % off **base** in UI; must align with engine |
| Admin products | `admin-products.ts`, `product-edit.tsx` | Override on blur; compare-at display |
| Checkout offers / upsell | `checkout-offers.ts` | Uses variant `price_usd` |
| Wishlist, outlet, compare | storefront | Mock or API — align when API unified |
| Product detail | `product-detail.tsx` + mock data | Long-term: real API; short-term: document mock vs prod |
| CSV / exports | `admin-products.ts` export paths | Column semantics change |
| Product sync (if used) | `product-sync.ts` | Map external feed → `base_sell` / list / cost |
| Alerts | `product-alerts` schema (`old_price_usd` / `new_price_usd`) | Trigger on **effective** or **base** — define explicitly |
| SEO / JSON-LD | product pages | Use effective + currency |
| Analytics / revenue | reporting | Define “list” vs “paid” vs “discount from compare” |

**Deliverable of phase 0:** a checked-in checklist (append to this doc or ticket) with each row **DONE** when migrated.

---

## 2. Target conceptual model (short)

- **`base_sell_price_usd`** (rename semantically from `price_usd`): default sell price with **no** campaign/list.
- **`list_price_usd`** (optional): MSRP / reference.
- **`cost_usd`** (optional): margin checks.
- **`compare_at_price_usd`**: marketing strikethrough (may default from list).
- **Price list** + **assignments** (segment / user / default).
- **Rules / campaigns** (including flash — either wrap existing tables or bridge).
- **Engine output:** `{ effectiveUnitPrice, compareAtForDisplay?, currency, appliedStack[] }`.

**Priority stack (final order — document in code comments):**

1. Bundle line allocation (if line is bundle part — existing bundle validation).
2. Flash / fixed campaign price for variant (capacity checks unchanged).
3. Price list row for `(list, variant, qty tier if any)`.
4. Ordered **price rules** (priority ASC).
5. Bulk tier **percent** applied to current candidate (clarify: off base vs off current — pick one and test).
6. Optional **floor/cap** vs **cost** (policy).

Cart-level: coupons, loyalty, wallet, gift cards — **unchanged** relative to line subtotals.

---

## 3. Phased implementation

### Phase 0 — Discovery & contract freeze (3–5 days)

- [ ] Complete inventory table (§1) with owner per file.
- [ ] Write **OpenAPI-style** or TypeScript types for:
  - `PriceContext` (`userId?`, `guest`, `now`, `channel`, `priceListId?`)
  - `PriceLineInput` (`variantId`, `quantity`, `bundleId?`, `productId` for validation)
  - `ResolvedPrice` (amounts + `appliedStack`)
- [ ] Add **feature flag** e.g. `PRICING_ENGINE_V2=0|1` (env) read in API only.
- [ ] Add **logging** hook: structured log when flag compares old vs new path (shadow mode).

**Exit:** signed-off types + flag scaffolding merged.

---

### Phase 1 — Schema migration (additive) (1–2 weeks)

**Principle:** additive columns/tables first; **no** behavior change until Phase 2.

1. **Variants** (`product_variants`):
   - Add `base_sell_price_usd` **or** document rename: keep physical column `price_usd` but treat as `base_sell` in app layer (less migration pain).
   - Add nullable `list_price_usd`, `cost_usd` (optional).
   - Keep `compare_at_price_usd`.
   - Deprecate `price_override_usd`: stop writing in admin once list/rules exist; migration script copies overrides into `price_list_items` or `price_rules`.

2. **Price lists** (new tables):
   - `price_lists` (id, code, name, currency default USD, is_default, valid_from/to, priority).
   - `price_list_items` (price_list_id, variant_id, amount, compare_at optional, valid_from/to, min_qty nullable).
   - `price_list_assignments` (price_list_id, segment_id nullable, user_id nullable, priority, valid_from/to).

3. **Segments** (minimal):
   - `customer_segments`, `user_segment_members` **or** reuse role flags if B2B is only “business approved” — document tradeoff.

4. **Rules** (start minimal):
   - `price_rules` + `price_rule_scopes` (variant_ids / category_ids as JSON arrays or junction tables — prefer junction for indexing).
   - Optional `campaigns` FK for flash alignment.

5. **Audit:**
   - `price_change_log` (variant-level and list-item-level events).

6. **Bulk tiers:**
   - Add nullable `price_list_id` to `bulk_pricing_tiers` **or** duplicate tiers per list in data (simpler schema, more rows).

**Data migration jobs:**

- Seed `price_lists`: insert `RETAIL` default, `is_default=true`.
- For each variant: insert `price_list_items` row = current effective intent:
  - If `price_override_usd` IS NOT NULL → item amount = override; else = `price_usd`.
- Backfill `list_price_usd` from `compare_at_price_usd` only if business agrees (optional).

**Exit:** migrations applied on staging; rollback SQL prepared; Drizzle schema + types exported.

---

### Phase 2 — Core service: `resolvePrices` (1–2 weeks)

**Location:** `artifacts/api-server/src/services/pricing/` (new package or folder).

**APIs:**

- `resolvePriceLine(input, context): Promise<ResolvedPrice>` — single line.
- `resolvePriceLines(lines[], context): Promise<Map<lineKey, ResolvedPrice>>` — **batch** for cart/order (single DB round-trip per concern).

**Implementation notes:**

- Extract flash logic from `orders.ts` into callable module (or wrap `getFlashSaleInfo`).
- Extract bundle pricing call order to **match** today’s `validateAndPriceItems`.
- Price list: SQL `IN` on variants + join lists + assignments resolved in one query where possible.
- Rules: load active rules once per request, filter in memory by scope (acceptable for hundreds of rules; optimize later).
- **Money:** use `string` decimal in TS boundary (match existing `numeric` pattern); centralize `round2` / compare `abs(a-b) < 0.01`.

**Shadow mode (flag):**

- In `validateAndPriceItems`, compute V2 result; if differs from V1, log **diff**; still use V1 until Phase 4.

**Tests:**

- Unit tests: matrix of bundle / flash / list / rule / bulk / cost floor.
- Property test (optional): monotonicity (higher discount → lower or equal price).

**Exit:** service merged, 100% unit coverage on engine; shadow logging in staging.

---

### Phase 3 — Wire API read paths (1–2 weeks)

Order of wiring (low risk → high):

1. **Internal admin preview** endpoint: `GET /admin/pricing/preview?variantId=&qty=` (auth) — uses engine; powers future UI and debugging.
2. **Public** `GET /products/:slug` **if/when** introduced (today mock on storefront — plan for API-first PDP).
3. **`/search`**: extend variant payload with `effectivePriceUsd` (and keep `basePriceUsd` for transparency); update `minPriceSub` to subquery effective price **for guest context** (document: logged-in search may differ — optional query param `priceList` later).
4. **`/checkout-offers`** and similar: use effective price.
5. **Wishlist / outlet** routes if they expose prices from DB.

**Caching:**

- Short TTL Redis/memory cache keyed by `(variantId, listId, campaign ids hash)` **optional** in this phase; start without cache, add if profiling shows need.

**Exit:** all **read** paths return consistent fields; storefront types updated.

---

### Phase 4 — Checkout enforcement (critical) (3–7 days)

- Replace body of `validateAndPriceItems` to:
  - Build `PriceContext` from `req` (user from JWT/cookie).
  - Call `resolvePriceLines` for all non-gift-card lines.
  - Compare client `item.priceUsd` to resolved **effectiveUnitPrice** × qty (existing tolerance).
  - Preserve flash **sold count** / max qty logic (move inside engine or immediately after).
- **Idempotency:** unchanged.
- **409 / price changed** messages: include `hint` with stack top reason (optional).

**Exit:** E2E order tests pass; shadow mode OFF for staging.

---

### Phase 5 — Admin UI & ops (2–4 weeks, parallelizable)

**5A Variant editor**

- Clarify labels: Base sell, List, Cost, Compare-at.
- Remove or hide `price_override` after migration; link “Open in price list” deep link.

**5B Price lists**

- CRUD lists, items grid (CSV import), assignment to segment/user.
- Validation: duplicate variant in list, overlapping validity, currency mismatch warnings.

**5C Rules / campaigns**

- Minimal UI: create rule, scope picker (product/category), type, value, schedule.
- Flash admin: either “sync to rule” button or dual-write during transition.

**5D Simulator**

- Page: pick user email + SKU + qty → show `appliedStack` JSON.

**5E Audit**

- Table + filters; export CSV.

**Exit:** ops can run without SQL; audit used in UAT sign-off.

---

### Phase 6 — Storefront alignment (1–2 weeks)

- Replace mock PDP with API when ready **or** inject effective price from search payload for shop routes.
- Cart store: store **both** `displayPrice` and `variantId` — always revalidate at checkout (already implicit).
- Volume pricing component: fetch tiers; recompute examples using **effective** base from API, not raw `priceUsd` from mock.
- i18n: strings for “Price details”, “B2B list applied”.

**Exit:** visual parity + no client-only trust for totals.

---

### Phase 7 — Hardening & scale (ongoing)

- **Performance:** batch SQL, indexes on `(price_list_id, variant_id)`, `(variant_id, valid_from, valid_to)`, rule scope indexes.
- **Rate limiting:** preview endpoint admin-only + throttled.
- **Security:** ensure no user can pass arbitrary `priceListId` in public API without authorization.
- **Docs:** runbook “how to run migration”, “how to rollback flag”.
- **Monitoring:** metrics `pricing_resolve_ms`, `pricing_shadow_mismatch_count`.

---

## 4. Testing strategy (nothing missing)

| Layer | What |
|-------|------|
| Unit | Engine only: all rule combinations, edge qty, inactive variants |
| Integration | API routes: search, order post, admin preview |
| E2E | Existing Playwright + new: price list user sees different price than guest (when segment exists) |
| Load | k6/Artillery on `/search` and `POST /orders` with engine on |
| Data | Migration dry-run on copy of prod volume |

**Regression suite:** snapshot of 20 top SKUs’ effective prices pre/post migration.

---

## 5. Rollout & rollback

1. Deploy Phase 1 schema (backward compatible).
2. Deploy Phase 2–3 code with `PRICING_ENGINE_V2=0` (shadow).
3. Staging: flip to `1` for reads only; monitor.
4. Staging: flip checkout to V2; full E2E.
5. Production: **canary** % traffic or single region if applicable.
6. Rollback: set flag to `0`; DB migrations for new tables are additive (safe); avoid destructive drops until stable.

---

## 6. RACI (suggested)

| Area | Owner |
|------|--------|
| Schema & migrations | Backend + DBA review |
| Engine & orders | Backend |
| Search / perf | Backend |
| Admin UI | Frontend + Backend API |
| Storefront PDP/cart | Frontend |
| QA sign-off | QA lead |
| Business rules priority | Product / commercial |

---

## 7. Open decisions (resolve before Phase 2 coding)

1. **Physical rename** of `price_usd` column vs semantic rename in app only.
2. **Bulk tier** applies to which base: `base_sell` vs post-list effective (recommend: **post-list pre-bulk** for B2B).
3. **Search for logged-in users:** same as guest vs resolve per user (cost tradeoff).
4. **Compare-at source** when list provides its own compare column.
5. **Affiliate / referral** cut: stays post-order or affects effective price (usually post-order).

---

## 8. Definition of Done (project)

- [ ] Flag removed or permanently on; shadow code deleted.
- [ ] Inventory §1 all green.
- [ ] Docs: this plan archived + short README for ops.
- [ ] No known mismatch between PDP, cart display, and charged amount beyond coupons/wallet/loyalty.

---

*Last updated: generated as implementation plan for Pixel-Storefront unified pricing.*
