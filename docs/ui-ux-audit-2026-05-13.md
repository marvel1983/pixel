# PixelCodes Storefront — UI/UX Audit (2026-05-13)

## Executive summary

- **Product grid violates the documented 6-per-row rule everywhere.** The shop, category rows, and skeletons all cap at `lg:grid-cols-4` or `lg:grid-cols-5`. CLAUDE.md says "6 items per row." Pick a rule and propagate it via a shared grid utility instead of repeating Tailwind class strings.
- **i18n leakage is widespread on customer-facing surfaces.** Despite i18next + 5 locales (en/de/fr/pl/cs), the footer, checkout-summary, cart-totals, empty-cart, product-card pre-order/quick-view labels, error-boundary, search-autocomplete placeholder, billing-form "DE123456789" placeholder, and all category-row banner copy ship hardcoded English. A locale switch will leave large strips of the UI untranslated.
- **The design system is leaking.** ~380 raw hex literals across 30 files (footer alone has 25; category-browse-tabs has 48) and 271 `style={{}}` usages across 50 files. The footer + home banners hardcode `#3b82f6` and gradient blue, ignoring the locked `hsl(208 74% 46%)` primary token. The newsletter Subscribe CTA, social-icon pills, and category banners are all off-brand.
- **Mobile UX is not finished.** Shop's filter sidebar has no mobile bottom-sheet — it stacks above the grid taking a screen of vertical space. Account page has 12 horizontal tabs that wrap chaotically below `md`. There is no sticky/floating cart-CTA on mobile product detail (the sticky bar exists but is desktop-only behavior). Most buttons + inputs (`h-9` = 36 px, `size="sm"` = 32 px, `size="icon"` = 36 px) fail the 44 px minimum tap target.
- **Loading/error UX is silent or jarring.** `<Suspense>` in `App.tsx` has no fallback — lazy routes blank the page briefly while the chunk loads (only the time-based `RouteProgressBar` papers over it). `home.tsx`, `product-detail.tsx`, `order-complete.tsx`, and search-autocomplete all `.catch(() => {})` silently. The `ErrorBoundary` renders the raw `error.message` to end users (privacy + UX issue) and logs nothing.

---

## Findings

### P0 — fix now (broken / blocking / shippable bugs)

**1. Product grid layout violates documented design constraint.**
CLAUDE.md mandates "Product grid is 6 items per row (k4g.com-inspired compact layout)." Actual implementation:
- `components/shop/product-grid.tsx:72` — `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4` (4-up max)
- `components/shop/product-grid-skeleton.tsx:27` — same 4-up
- `components/home/category-row.tsx:32` — `lg:grid-cols-5` (5-up)
- `components/home/category-browse-tabs.tsx:281, 292, 197` — `lg:grid-cols-5` (5-up, including skeleton)
This is a design-system breach. Either update CLAUDE.md or fix the grids. Suggested fix: extract a single `ProductGrid` wrapper that emits `grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3` and use it everywhere.

**2. `<Suspense>` has no fallback — lazy routes flash blank.**
`App.tsx:115` and `App.tsx:191` both render `<Suspense>` with no `fallback`. While a lazy route chunk is fetching, the entire content area is empty. The `RouteProgressBar` is a time-based decoy (it hits 100% in 600 ms regardless of whether the chunk is loaded). Add a real skeleton matching the page archetype, or at minimum a centered loader, as the fallback for the inner switch.

**3. ErrorBoundary leaks `error.message` to the user and logs nothing.**
`components/error-boundary.tsx:18` — renders `{this.state.error.message}`. This can include stack snippets, internal paths, "JSON parse error at line X" from API responses, etc. Engineers see no console/telemetry log because there is no `componentDidCatch`. Fix: replace the displayed message with a translated friendly string and log `error` + `errorInfo` to console + your telemetry.

**4. Product card has invalid HTML — interactive elements nested inside a Link `<a>`.**
`components/product/product-card.tsx:133` wraps the whole card in `<Link>` (renders `<a>`). Inside that link are real `<button>` elements: wishlist (174), compare (181), quick-view (189), and the Add-to-Cart Button (249). HTML5 forbids interactive content inside an `<a>` — assistive tech can announce in unpredictable ways, and some browsers misroute click events on touch. The handlers use `e.preventDefault(); e.stopPropagation()` to work, but the DOM is still invalid. Refactor so the card is a `<div>` with one click handler pushing to the route, or move the secondary buttons outside the `<Link>` (e.g., as an absolute-positioned sibling).

**5. Cart row remove button is icon-only with no accessible name.**
`components/cart/cart-items-table.tsx:352` uses only `title="Remove item"` (untranslated, and `title` does not reliably read on screen readers for icon-only buttons). The qty + / − buttons (lines 329, 337) have no aria-label either. Add `aria-label={t("cart.removeItemFor", { name: item.productName })}` etc. Also: removal is destructive but there is no undo or confirmation — at minimum show an "Undo" toast action via Radix `<ToastAction>`.

**6. Hardcoded English strings on critical purchase pages.**
Despite i18next being wired, these customer-facing strings ship in English regardless of locale:
- `pages/cart.tsx:36` ("items in your cart"), `:53` ("Your cart is reserved for 24 hours…"), `:60–68` (backorder copy), `:91–110` (trust strip + accepted payments)
- `components/checkout/checkout-summary.tsx:43, 53, 54, 97, 103, 110, 117` — entire summary panel (no `useTranslation()` import)
- `components/cart/cart-totals.tsx:32, 33, 53, 54` — "Order Summary", "Taxes & fees", "Calculated at checkout"
- `components/cart/empty-cart.tsx:7–11, 43, 58, 60` — QUICK_LINKS array and promo strip, plus a hardcoded `SAVE10` code that should come from settings
- `components/product/product-card.tsx:100, 110, 125, 194, 217, 260, 265` — toast titles, "Quick View", "Pre-order", "Added"
- `pages/checkout.tsx:171, 175, 179, 182, 191, 195, 196` — payment method radios + "Continue to Payment →"
- `pages/order-complete.tsx:78, 97` — "Cart" crumb, "You earned approximately…"
- `pages/product-detail.tsx:27–33, 98–99, 108–109, 117–118` — category names + error states
- `components/layout/footer.tsx:101–139, 237–242, 300–302` — entire link-column titles, newsletter copy, trust badges, "Cookies", legal labels
- `components/home/category-browse-tabs.tsx:34–142` — every banner's eyebrow/headline/sub/cta is English-only
- `components/layout/search-autocomplete.tsx:143, 212, 246, 273` — placeholder, "Bundles", "X products", "View all N results"
- `components/account/profile-tab.tsx` and friends — see "Per-dimension notes"

This is a blocker for the localized markets the project supports.

---

### P1 — fix soon (significant usability/quality issues)

**7. Inputs and buttons fail the 44 px mobile tap target.**
`components/ui/button.tsx:25–28` — default `min-h-9` (36 px), sm `min-h-8` (32 px), icon `h-9 w-9` (36 px). `components/ui/input.tsx:11` — `h-9` (36 px). Cart qty steppers at `cart-items-table.tsx:330, 338` are 32 px tall. Checkout summary qty steppers `checkout-summary.tsx:63–75` are 20×20 px — far below WCAG 2.5.5 Target Size (Enhanced) and also below Apple HIG / Material guidance. Either raise the base sizes on mobile (`min-h-11` on `sm:` and below) or add a `touch:min-h-11` plugin.

**8. Filter sidebar has no mobile bottom-sheet.**
`components/shop/filter-sidebar.tsx:55` — `aside className="w-full lg:w-56"`. Below `lg`, the sidebar renders full-width above the product grid: a user opening `/shop` on a phone sees one screen of filters before reaching the first product. Pattern fix: wrap the sidebar in a `Sheet` triggered by a "Filters" button on mobile (analogous to how `mobile-drawer.tsx` is built).

**9. Account page tabs unusable on small screens.**
`pages/account.tsx:82–95` — 12 TabsTrigger items in a `TabsList flex-wrap`. They wrap to 3–4 rows on tablet, making the tab strip taller than the panel content. Use a `<Select>` for `< md` and a sidebar nav for `≥ md`, or move tabs to a drawer.

**10. Forms don't expose validation to assistive tech.**
`components/checkout/billing-form.tsx:50` renders the error as a `<p>` below the input, but the input has no `aria-invalid` or `aria-describedby` linking it to that error. Screen reader users hear the label but not the error. Required fields are flagged only via a visible `*` — add `required` and `aria-required="true"` on the input. The same pattern repeats across `ui/field.tsx` users.

**11. Home page bypasses React Query and has no skeleton/error UI.**
`pages/home.tsx:124, 137, 149` — three plain `fetch(...).catch(() => {})` calls. There is no loading skeleton (sections just render with empty arrays — many components `return null` for empty input, so the page can layout-shift as sections pop in). There is no error state if the API is down — the page silently shows nothing. Convert to the generated React Query hooks like the rest of the codebase, and render a `<HomePageSkeleton />` while pending.

**12. Add-to-cart button uses an ad-hoc color matrix instead of the design system.**
`components/product/product-card.tsx:253` — `bg-emerald-500` / `bg-amber-500` / `bg-primary` mixed by ternary. The "Added" emerald and "Pre-order" amber are raw Tailwind palette colors, not tokens. Replace with `bg-success`/`bg-warning` semantic tokens (add to `index.css`) so dark mode and theming follow the system.

**13. Footer is brand-inconsistent and untranslated.**
`components/layout/footer.tsx` ships its own dark-navy SVG background (line 41 `#060c17`), three orb gradients (#3b82f6, #8b5cf6, #06b6d4), and a Subscribe gradient `linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)` at line 359. None of these are the locked primary blue `hsl(208 74% 46%)`. The whole layout is also untranslated and the file is 367 lines — over the 300-line limit set in CLAUDE.md. Move it to `bg-header-navy` or a new `--color-footer-*` token, t() every label, and split into `footer-newsletter.tsx` / `footer-columns.tsx` / `footer-bottom.tsx`.

**14. Category-row inline banners hardcode 5 distinct color schemes.**
`components/home/category-browse-tabs.tsx:31–145` — `getBannerConfig` switch with hardcoded gradients (`linear-gradient(120deg, #0a1628 0%, ...)`) and CTA backgrounds (`#3b82f6`, `#a855f7`, `#22c55e`, `#ef4444`). This breaks the "primary blue locked" rule visually and is impossible to retheme. Move banner config to site settings or to CSS-var-driven category accents.

**15. Suspense + lazy chunks aren't grouped by route — many tiny chunks.**
`App.tsx:46–90` — 39 individual `lazy()` imports. While code-splitting per route is fine, there is no shared chunk grouping (e.g., `webpackChunkName` style hints), so users navigating between account sub-pages download a new chunk for each tab. Combine the account pages, admin pages, and footer-legal pages into route-group chunks.

**16. Image lazy-loading is the exception, not the rule.**
Only 4 of ~45 image-rendering files use `loading="lazy"` (product-card, search results page, bundles, campaign). Cart drawer, checkout summary, compare page, wishlist, product-detail image, related products, etc., all load images eagerly. On a 24-item cart drawer scroll this is noticeable. Either default `loading="lazy"` on a shared `<Img>` wrapper or audit each `<img>` tag.

**17. `<main>` has no skip-link and no landmark id.**
`components/layout/site-layout.tsx:23` — `<main className="flex-1">`. Keyboard users have no way to skip past the sticky top-bar + nav-bar (which collectively contain ~15 focusable elements on every page). Add `id="main-content"` and a visually-hidden skip link in `SiteLayout` (`a.skip-link` shown on focus).

**18. Search autocomplete: no loading or empty state, weak ARIA.**
`components/layout/search-autocomplete.tsx:62–72` — fetch with no loading indicator and `.catch(() => {})`. While the user types, there is no spinner; if results are 0, the dropdown is invisible. Also: `aria-activedescendant` is never set on the input, so screen readers cannot announce the currently highlighted suggestion. Add a spinner, a "No results — try X" empty state, and proper `aria-activedescendant={`suggestion-${activeIdx}`}` with matching `id` on each `<li>`.

**19. Dark-mode admin CSS leaks into the storefront via global selectors.**
`index.css:307–426` defines `.dark .bg-white { background-color: #1a1d28 !important; }`, `.dark .text-gray-700 { color: ... }`, etc. These selectors are global — they hit every storefront component that uses Tailwind palette utility classes (e.g., wishlist page line 56 uses `bg-blue-100`, cart-items-table line 200 uses `bg-blue-50/60`). The intent in the comment is "admin sub-pages only" but the selectors aren't scoped to `.admin`. Either scope to `.admin .dark` or remove the `!important` overrides and have the storefront use tokens only.

**20. The dark-mode `--sidebar-primary` is not the locked primary blue.**
`index.css:186` — `.dark { --sidebar-primary: 221 83% 53%; }`. CLAUDE.md says the primary is locked to `hsl(208 74% 46%)` in both modes; the regular `--primary` is correctly locked (line 194), but `--sidebar-primary` and `--ring` (line 205, `221 83% 53%`) drift. Either lock all sidebar/ring tokens to 208/74/46 or update CLAUDE.md to say only `--primary` is locked.

**21. Sort and platform filter labels not translated.**
`components/shop/product-grid.tsx:12–21` — `SORT_OPTIONS` array is English-only. `components/shop/filter-sidebar.tsx:9–16` — `PLATFORMS` array is English-only. Translate via `t()` and key by code.

**22. Files over the 300-line limit.**
`footer.tsx` (367), `cart-items-table.tsx` (363), `product-purchase-card.tsx` (305), `category-browse-tabs.tsx` (305). CLAUDE.md mandates "All source files must remain under 300 lines."

---

### P2 — polish (nice-to-have, consistency, future work)

**23. Toast for add-to-wishlist isn't translated and has no Undo.**
`product-card.tsx:110` — `toast({ title: \`${product.name} added to wishlist\` })`. Add an `action: <ToastAction>Undo</ToastAction>` to give an immediate reversal for a one-tap mistake.

**24. Show-password button on login has no aria-label.**
`pages/login.tsx:157` — eye icon button with no `aria-label="Show password"` / `aria-pressed`. Same fix needed wherever password-reveal is implemented.

**25. Cart "items / item" pluralization done with ternary, not i18next ICU.**
`pages/cart.tsx:36`, `cart-totals.tsx:33`, `product-grid.tsx:46`, `search-autocomplete.tsx:273` — all use `count === 1 ? "item" : "items"` ternaries. Use i18next ICU `{{count}}` plurals so Slavic / German plural forms work in cs/de/pl.

**26. Mobile drawer is missing common controls.**
`components/layout/mobile-drawer.tsx` — doesn't expose Currency, Language, or Theme toggles. On mobile those are gone (the nav bar hides them at `lg:`). Add them to the drawer footer.

**27. Quick-view + Quick-view link on product-card overlap.**
Product card hover overlays add: wishlist (top-right), compare (below wishlist), and a bottom strip for "Quick View" (line 189). The right side cluster is also there — on small/medium card widths the overlay covers the discount badge area. Add a hover dimmer or grid the overlay controls explicitly.

**28. CartProgress is a custom component but checkout has its own step UI elsewhere.**
There's a `cart-progress` component used in cart.tsx + checkout.tsx + order-complete.tsx, but step state is passed as a prop. Consider a Zustand selector or route-aware computation so the cart-flow checkpoint can be derived rather than wired manually.

**29. Empty-cart promo strip references "SAVE10" — hardcoded promo code.**
`components/cart/empty-cart.tsx:58`. If the promo expires, the empty cart will mislead users. Pull from a `marketing` slice of `site-settings`.

**30. `home.tsx` SEO title concatenates `t("seo.homeTitle") + " | PixelCodes"` — site name should be part of the translation, not hardcoded.**
Same issue in `pages/shop.tsx:18`, `pages/product-detail.tsx:82`.

**31. SEO description leaks raw template English.**
`pages/product-detail.tsx:83` — `description: \`Buy ${product.name} for $${price}. Instant digital delivery. Genuine license key with lifetime validity. ${product.reviewCount} reviews, ${product.avgRating}/5 rating.\`` — none of this is translated, and currency is hardcoded as `$`.

**32. `console.warn` / `console.error` not gated.**
There is no centralized logger — silent `.catch(() => {})` everywhere hides real bugs in production. Add a thin logger + Sentry / similar.

**33. `aria-live` regions are scarce.**
Only `product-card.tsx:289` has an `aria-live="polite"` announcement for "added to cart". Toasts are managed by Radix and should be fine, but cart-totals, qty changes, gift-card-apply, coupon-apply, loyalty-redeem updates should announce success/failure for assistive tech users.

**34. Visually-hidden focus indicator on many ghost / icon buttons.**
The default Button class chain at `ui/button.tsx:8` clears `outline:none` on `focus` and `focus-visible`. The global `nav button` CSS gives a 3D effect but no ring; sample of icon buttons inside the nav, cart drawer, and product card lose any visible focus indication on Firefox / dark mode. Add `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` as a base class.

**35. `react-i18next` not used in many "always English" admin labels leaking into the customer view.**
`pages/account.tsx:86` — "Loyalty" hardcoded next to the `t("accountPage.*")` labels. Mixed consistency suggests the i18n migration is incomplete; consider an ESLint rule that flags string-literal JSX children outside `t()`.

**36. `<Suspense>` rendering inside `App.tsx` already pattern doubles up.**
`App.tsx:191` has a `<Suspense>` wrapping the admin/storefront split; then `StorefrontWithMaintenance` opens another `<Suspense>` at line 115 around the route switch. Each layer should have its own fallback OR be combined.

**37. `checkmark-circle` / `confetti` SVG colors are hardcoded.**
`index.css:494, 501` — `stroke: #22c55e`. Move to `--color-success` token.

**38. `bg-header-navy` is OK in light mode but `header-navy: 220 30% 12%` in dark mode is nearly identical to the body background — the top-bar boundary disappears.**
`index.css:220` — consider a small adjustment, e.g., `220 30% 16%` plus a 1 px bottom border.

**39. Compare bar (`components/product/compare-bar.tsx` and `components/compare/compare-bar.tsx`) appears to exist in two places.**
Both are imported from `App.tsx:35` and `site-layout.tsx:6`. Verify they're not double-rendering.

**40. Footer link columns reference categories by slug, but mobile-drawer hardcodes a different set.**
Footer offers 7 shop categories (footer.tsx:103–110), but mobile-drawer offers 5 (mobile-drawer.tsx:32–37). These should come from one source (the categories store / API).

**41. Pre-order / out-of-stock state colors don't follow tokens.**
`product-card.tsx:216` — `text-green-600`, `text-amber-600`, `text-destructive`. Should be `text-success`, `text-warning`, `text-destructive` (tokens to add).

**42. Order summary qty steppers in checkout are 20×20 px.**
`checkout-summary.tsx:63–75` — `w-5 h-5`. Way below tap-target. Either remove the steppers (force users to edit qty in the cart) or scale them up.

**43. Heading hierarchy on home page: only `<h2>` for sections; `<h1>` lives where?**
`pages/home.tsx` renders no `<h1>` — the page has no main heading. The shop page has `<h1>{t("shop.title")}</h1>` (line 59); product detail has `<h1>` only inside the not-found / error states. Add a visually-hidden `<h1>` for home (e.g., "PixelCodes — Digital Software Keys").

**44. Cart drawer is mounted but the nav-bar opens it via store while the page also has `/cart` as a full route.**
This is documented as intentional (nav-bar.tsx:142 comment) but creates two UIs — drawer for nav clicks, full page on direct link. Verify the drawer is reachable on mobile (it currently uses `useCartDrawerStore` triggered from the nav icon, which is fine).

---

## Per-dimension notes

### 1. Design system consistency
- Tokens in `index.css` are well-architected (HSL channels, calc-based borders, light/dark mirroring), but they are bypassed in ~30 places. The worst offenders are footer (25 hex), home/category-browse-tabs (48 hex), and the admin shell (some bleed into the storefront via `!important`). Build a lint rule to disallow hex literals in `components/**` and `pages/**` except in seed/migration files.

### 2. Accessibility
- shadcn + Radix carry semantic baseline for Dialog, Sheet, DropdownMenu, Tooltip, Toast, Select. The breakage is in **icon-only custom buttons** (cart trash, qty steppers, password reveal), **forms without `aria-invalid`/`aria-describedby`**, and **missing skip-link**. Color-contrast wise, the locked blue `hsl(208 74% 46%)` ≈ #1e85d4 has 4.42:1 against white (passes WCAG AA for normal text only; fails AA for large text equivalents — wait, 4.42 actually passes AA normal). Against the dark surface (`hsl(220 30% 12%)`) it passes 7:1. The `text-amber-600` on `bg-amber-50` used in cart backorder notices is only 3.7:1 — fails AA. The `text-slate-500` link text in footer (line 225) on the `#060c17` background is ~4.0:1 — fails AA.

### 3. Responsive design
- Headline issue: the documented 6-per-row grid is not implemented anywhere. Filter sidebar takes a whole mobile screen. Account tabs wrap. Billing form's 3-column address/city/zip grid (`billing-form.tsx:126`) does not collapse on small screens. Top-bar's support / worldwide icons hide at `lg:`, good. Nav-bar trims well — but only because most icons disappear; the cart icon stays visible. Sticky nav block (`site-layout.tsx:19`) is heavy on mobile (top-bar + nav-bar both sticky) — consider collapsing the top-bar away on scroll.

### 4. Loading / empty / error states
- Loading: Shop has a skeleton; product-detail has a skeleton; home does not; cart / checkout do not (they assume Zustand state is instant — fine for cart, but checkout's tax + config fetch is not). Search autocomplete has no spinner.
- Empty: Cart has a beautiful empty state (untranslated though). Product grid's empty state has no CTA. Wishlist, compare, account-orders empty states should be sampled but were not in this pass.
- Error: Almost universally swallowed via `.catch(() => {})`. Product-detail does show an inline error UI (lines 95–103) — that's the only good example.

### 5. Interaction feedback
- Buttons disable + show `<Loader2 className="animate-spin">` on async — good pattern, consistently used in checkout, login, footer-newsletter, etc.
- Form validation is blur-based on billing-form, which is correct.
- Toast usage is liberal — possibly too liberal in product-card (every wishlist toggle fires a toast, can spam during browsing). Consider a debounced "n items added to wishlist" instead.
- Cart-row delete has no confirmation or undo.

### 6. Information architecture & navigation
- Top-bar holds logo + search + support indicators. Nav-bar holds categories dropdown + 6 links + locale/cart/account. Footer adds 3 link columns + legal + newsletter. There is duplication: "Track Order" appears in footer + accessible via "My Orders" in user menu. "Support" appears as nav link + footer column + account tab. Document the intended hierarchy.
- Cart → Checkout flow has a clear `<CartProgress step={1|2|3} />` indicator. Good.
- Account vs admin separation is correctly enforced in `App.tsx:184–200`.

### 7. Visual hierarchy & typography
- Heading scale on shop / cart / checkout is mostly `text-2xl font-bold` for h1, `text-base font-bold` for section h2. There is no `h1` on home. Consider a typography scale doc with `--text-h1`, `--text-h2` tokens.
- Price display is inconsistent: cart uses `tabular-nums`, product-card does not (line 240). Currency symbol prefix vs suffix is handled by `useCurrencyStore.format()` but the dash-separator (` − `) for discount lines is sometimes `-` and sometimes `−` (e.g., `cart-totals.tsx:48` uses `−` U+2212; `checkout-summary.tsx:104` uses `-`).
- Primary CTA in checkout (`pages/checkout.tsx:193`) is `Button size="lg"` with `max-w-sm mx-auto` — center-aligned in a left column. This buries it; the user has to find it. Float a sticky checkout CTA on mobile and align with the summary on desktop.

### 8. i18n readiness
- 5 locales bundled (en/de/fr/pl/cs). Common pattern is correct in many components (`t("cart.subtotal")` etc.) but coverage is patchy — every component I sampled had at least one hardcoded English string. Adopt the ESLint plugin `eslint-plugin-i18next` with the `no-literal-string` rule scoped to JSX text and props known to render to users.
- Currency formatting is centralized via `useCurrencyStore.format()` — good.
- Date formatting was not sampled but worth auditing in account-orders.

### 9. Performance UX
- Code-splitting per route is good (39 lazy imports). However: `<Suspense>` has no fallback, so the perceived performance is poor (flash of empty).
- Image lazy-loading is missing on ~90% of `<img>` tags.
- No `<link rel="preload">` for fonts (Inter, JetBrains Mono) — fonts will FOUC on cold load.
- React Query default `staleTime: 30_000` is fine for catalog data but very short for `homepage-sections`. Consider tiering.
- `<Confetti />` on order-complete is mounted unconditionally — make sure it bails out for prefers-reduced-motion users.

### 10. Mobile-specific & touch targets
- 44 px minimum violated by base Button, base Input, and dozens of icon buttons (covered in P1 #7).
- No mobile bottom-sheet for filters (P1 #8).
- No sticky checkout button on mobile cart / checkout — the CTA can scroll off-screen.
- The nav-bar's mobile menu icon is `size="icon"` (36 px) — easy to miss with a thumb.
- The cart drawer (existing) and mobile drawer (`mobile-drawer.tsx`) are correctly built on Radix `Sheet`. Good baseline.

---

## Files sampled

- `CLAUDE.md`
- `artifacts/storefront/src/index.css`
- `artifacts/storefront/src/App.tsx`
- `artifacts/storefront/src/components/layout/site-layout.tsx`
- `artifacts/storefront/src/components/layout/top-bar.tsx`
- `artifacts/storefront/src/components/layout/nav-bar.tsx`
- `artifacts/storefront/src/components/layout/footer.tsx`
- `artifacts/storefront/src/components/layout/mobile-drawer.tsx`
- `artifacts/storefront/src/components/layout/search-autocomplete.tsx`
- `artifacts/storefront/src/components/layout/route-progress-bar.tsx`
- `artifacts/storefront/src/components/error-boundary.tsx`
- `artifacts/storefront/src/components/ui/button.tsx`
- `artifacts/storefront/src/components/ui/input.tsx`
- `artifacts/storefront/src/components/ui/toast.tsx`
- `artifacts/storefront/src/components/product/product-card.tsx`
- `artifacts/storefront/src/components/product-detail/product-purchase-card.tsx` (header)
- `artifacts/storefront/src/components/shop/product-grid.tsx`
- `artifacts/storefront/src/components/shop/product-grid-skeleton.tsx`
- `artifacts/storefront/src/components/shop/filter-sidebar.tsx`
- `artifacts/storefront/src/components/home/category-row.tsx`
- `artifacts/storefront/src/components/home/category-browse-tabs.tsx`
- `artifacts/storefront/src/components/cart/cart-items-table.tsx` (sample windows)
- `artifacts/storefront/src/components/cart/cart-totals.tsx` (header)
- `artifacts/storefront/src/components/cart/empty-cart.tsx`
- `artifacts/storefront/src/components/checkout/billing-form.tsx`
- `artifacts/storefront/src/components/checkout/checkout-summary.tsx` (header)
- `artifacts/storefront/src/pages/home.tsx`
- `artifacts/storefront/src/pages/shop.tsx`
- `artifacts/storefront/src/pages/product-detail.tsx`
- `artifacts/storefront/src/pages/cart.tsx`
- `artifacts/storefront/src/pages/checkout.tsx`
- `artifacts/storefront/src/pages/account.tsx`
- `artifacts/storefront/src/pages/login.tsx`
- `artifacts/storefront/src/pages/order-complete.tsx` (header)
- Grep audits over: `style={{}}` (271 hits / 50 files), `#[0-9a-f]{6}` (380 hits / 30 files), `<img\s`, `loading="lazy"` (4 files), `<Suspense`, `role="alert"|aria-live` (4 files), `Loading...` (18 files)
- Locale files counted: `cs/de/en/fr/pl` × `(main, pages)` = 10 JSON files
