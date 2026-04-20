# Project Overview – Pixel-Storefront (diginek.com)

## Šta je ovo

E-commerce platforma za prodaju digitalnih licence ključeva. pnpm monorepo s Express backendom i React frontendom.

---

## Produkcija

| | |
|---|---|
| **URL** | https://diginek.com |
| **VPS** | Contabo, IP: 144.91.69.182 |
| **SSH** | `ssh root@144.91.69.182` / `PajaPatak83#` |
| **App path** | `/var/www/pixel-storefront` |
| **PM2** | `pm2 status` / `pm2 logs pixel-api` |
| **GitHub repo** | `marvel1983/pixel` |

---

## Portovi

| Servis | Port |
|---|---|
| API server | 8080 |
| Storefront dev | 18539 |
| Storefront prod | 3000 (Nginx) |
| PostgreSQL | 5432 |

---

## Vanjske integracije

| Servis | Svrha |
|---|---|
| **Metenzi** | Provider licence ključeva (HMAC auth) |
| **Stripe** | Plaćanje karticom |
| **Checkout.com** | Alternativni payment gateway |
| **Google OAuth** | Social login |
| **Nodemailer/SMTP** | Transakcijski emailovi (queue-based) |
| **Trustpilot** | Reviews widget |

---

## Lokalni dev

```bash
bash dev-local.sh    # API (8080) + Storefront (18539)
pnpm run typecheck   # TypeScript provjera
pnpm run build       # full build
```

---

## Važna pravila

- **pnpm only** — ne koristiti npm ili yarn
- **DB promjene** → `ALTER TABLE IF NOT EXISTS` u `deploy.yml`
- **`api-client-react/` i `api-zod/`** → auto-generirani, nikad ne edituj
- **Fajlovi max 300 linija**
- **Light mode default** — dark mode postoji ali ne mijenji light mode dizajn

---

## MAPA FAJLOVA

---

### STOREFRONT — `artifacts/storefront/src/`

#### Pages — korisničke stranice

| Fajl | Svrha |
|---|---|
| `pages/home.tsx` | Homepage: hero banneri, kategorije, featured produkti |
| `pages/shop.tsx` | Listing produkta s filterima, sortiranjem, paginacijom |
| `pages/category.tsx` | Listing za određenu kategoriju |
| `pages/product-detail.tsx` | Produkt stranica: slike, varijante, cross-sells, reviews |
| `pages/cart.tsx` | Korpa: stavke, kupon, checkout dugme |
| `pages/checkout.tsx` | Checkout: billing forma, payment, upsells, loyalty |
| `pages/order-complete.tsx` | Post-purchase: potvrda, licence ključevi, timeline |
| `pages/order-lookup.tsx` | Pretraga narudžbi po email/order ID |
| `pages/cart-recover.tsx` | Abandoned cart recovery landing |
| `pages/login.tsx` | Login: email/password + Google OAuth |
| `pages/register.tsx` | Kreiranje novog accounta |
| `pages/forgot-password.tsx` | Zahtjev za reset lozinke |
| `pages/reset-password.tsx` | Završetak reset lozinke |
| `pages/account.tsx` | Account dashboard s tabovima |
| `pages/account-orders.tsx` | Historija narudžbi korisnika |
| `pages/account-balance.tsx` | Wallet balance management |
| `pages/account-loyalty.tsx` | Loyalty points dashboard |
| `pages/account-gift-cards.tsx` | Prikaz gift kartica korisnika |
| `pages/blog.tsx` | Blog listing s kategorijama |
| `pages/blog-post.tsx` | Individualni blog članak |
| `pages/bundle-detail.tsx` | Bundle/combo paket detalj |
| `pages/bundles.tsx` | Bundle listing stranica |
| `pages/best-sellers.tsx` | Top-prodavani produkti |
| `pages/new-arrivals.tsx` | Nedavno dodani produkti |
| `pages/flash-sale.tsx` | Vremenski ograničena flash rasprodaja |
| `pages/compare.tsx` | Alat za usporedbu produkta |
| `pages/search.tsx` | Rezultati pretrage |
| `pages/faq.tsx` | FAQ stranica |
| `pages/affiliates.tsx` | Affiliate program info |
| `pages/affiliate-apply.tsx` | Affiliate prijava forma |
| `pages/gift-cards.tsx` | Kupovina gift kartica |
| `pages/wishlist.tsx` | Wishlist/omiljeni produkti |
| `pages/support-hub.tsx` | Support centar |
| `pages/support-new.tsx` | Novi support ticket |
| `pages/support-ticket.tsx` | Individualni ticket i poruke |
| `pages/static-page.tsx` | CMS stranice (Terms, Privacy, itd.) |
| `pages/not-found.tsx` | 404 stranica |

#### Pages — admin

| Fajl | Svrha |
|---|---|
| `pages/admin/dashboard.tsx` | KPI dashboard (prihodi, narudžbe, korisnici) |
| `pages/admin/products.tsx` | CRUD produkata |
| `pages/admin/product-edit.tsx` | Edit forma za produkt (slike, cijene, varijante) |
| `pages/admin/categories.tsx` | Upravljanje kategorijama |
| `pages/admin/orders.tsx` | Lista narudžbi s filterima |
| `pages/admin/order-detail.tsx` | Detalj narudžbe, fulfillment |
| `pages/admin/customers.tsx` | Baza korisnika |
| `pages/admin/customer-detail.tsx` | Profil korisnika, historija |
| `pages/admin/discounts.tsx` | Kupon kodovi CRUD |
| `pages/admin/gift-cards.tsx` | Gift kartice upravljanje |
| `pages/admin/price-rules.tsx` | Dinamičke cijene |
| `pages/admin/flash-sales.tsx` | Flash sale eventi |
| `pages/admin/bundles.tsx` | Bundle/combo upravljanje |
| `pages/admin/blog.tsx` | Blog postovi upravljanje |
| `pages/admin/banners.tsx` | Banner upravljanje |
| `pages/admin/newsletter.tsx` | Newsletter kampanje |
| `pages/admin/email-templates.tsx` | Email template library |
| `pages/admin/reviews.tsx` | Moderacija reviews |
| `pages/admin/support.tsx` | Support ticket inbox |
| `pages/admin/affiliates.tsx` | Affiliate program upravljanje |
| `pages/admin/analytics.tsx` | Detaljna analitika |
| `pages/admin/keys.tsx` | API ključevi upravljanje |
| `pages/admin/settings.tsx` | Admin settings hub |
| `pages/admin/settings-general.tsx` | Naziv, valuta, timezone |
| `pages/admin/settings-currencies.tsx` | Valute i tečajevi |
| `pages/admin/settings-payment-providers.tsx` | Stripe, Checkout.com |
| `pages/admin/settings-smtp.tsx` | Email provider |
| `pages/admin/settings-loyalty.tsx` | Loyalty program parametri |
| `pages/admin/settings-risk-scoring.tsx` | Fraud detekcija |
| `pages/admin/settings-cpp-fees.tsx` | Processing fee pravila |
| `pages/admin/tax-settings.tsx` | Porezne stope po regijama |
| `pages/admin/metenzi-catalog.tsx` | Dropship katalog sinkronizacija |
| `pages/admin/feeds-list.tsx` | Product feed (Google Shopping) |
| `pages/admin/loyalty-events.tsx` | Loyalty points eventi |
| `pages/admin/audit-log.tsx` | Admin aktivnosti audit trail |
| `pages/admin/jobs.tsx` | Background job monitoring |
| `pages/admin/refunds.tsx` | Refund processing |

#### Components — layout

| Fajl | Svrha |
|---|---|
| `components/layout/top-bar.tsx` | Header: logo, search, support info |
| `components/layout/nav-bar.tsx` | Plava navigacija s kategorijama i ikonama |
| `components/layout/footer.tsx` | Footer: linkovi, copyright, payment ikone |
| `components/layout/site-layout.tsx` | Root layout (nav + footer wrapper) |
| `components/layout/currency-selector.tsx` | EUR/USD/GBP dropdown picker |
| `components/layout/theme-toggle.tsx` | Dark/light mode toggle |
| `components/layout/search-autocomplete.tsx` | Search s autocomplete prijedlozima |
| `components/layout/categories-dropdown.tsx` | Dropdown meni za kategorije |
| `components/layout/mobile-drawer.tsx` | Mobile hamburger meni |
| `components/layout/cart-drawer.tsx` | Side drawer s pregledom korpe |
| `components/layout/live-chat-widget.tsx` | Third-party live chat embed |

#### Components — cart & checkout

| Fajl | Svrha |
|---|---|
| `components/cart/cart-items-table.tsx` | Stavke korpe: količina, cijena, trash (crvena) |
| `components/cart/coupon-input.tsx` | Kupon input s Apply (zeleno) dugmetom |
| `components/cart/cart-totals.tsx` | Subtotal, popusti, ukupno |
| `components/cart/cart-progress.tsx` | Stepper: Korpa → Checkout → Potvrda |
| `components/cart/empty-cart.tsx` | Prazna korpa state s preporukama |
| `components/cart/region-warning.tsx` | Upozorenje za dostupnost u regiji |
| `components/checkout/billing-form.tsx` | Billing adresa i detalji forma |
| `components/checkout/checkout-summary.tsx` | Order summary sidebar (s processing fee) |
| `components/checkout/loyalty-redeem.tsx` | Loyalty points redeem slider |
| `components/checkout/product-upsell.tsx` | "Dodaj u narudžbu" upsell ponude |
| `components/checkout/wallet-payment.tsx` | Account balance payment opcija |
| `components/checkout/gift-card-input.tsx` | Gift kartica primjena |
| `components/checkout/cpp-section.tsx` | Service charge/protection opcija |
| `components/checkout/guest-account.tsx` | Guest checkout vs registracija |

#### Components — orders & account

| Fajl | Svrha |
|---|---|
| `components/orders/order-detail.tsx` | Detalj narudžbe + PDF invoice download |
| `components/orders/order-status-badge.tsx` | Status badge (DELIVERED, PENDING...) |
| `components/orders/order-timeline.tsx` | Kronološki timeline narudžbe |
| `components/orders/license-keys.tsx` | Prikaz licence ključeva nakon kupovine |
| `components/account/wallet-tab.tsx` | Balance prikaz i top-up forma |
| `components/account/loyalty-dashboard.tsx` | Points balance i redemption |
| `components/account/support-tab.tsx` | Ticket historija i novi ticket |

#### Components — product

| Fajl | Svrha |
|---|---|
| `components/product/product-card.tsx` | Grid kartica: slika, cijena, rating |
| `components/product/quick-view-modal.tsx` | Brzi preview produkta (modal) |
| `components/product/platform-badge.tsx` | Tip produkta badge (digital, physical) |
| `components/product-detail/product-info.tsx` | Naziv, cijena, varijante, Add to Cart |
| `components/product-detail/product-image.tsx` | Glavni viewer s thumbnailima |
| `components/product-detail/reviews-section.tsx` | Customer reviews i ocene |
| `components/product-detail/related-products.tsx` | Slični produkti carousel |
| `components/product-detail/cross-sell.tsx` | "Često kupljeno zajedno" |
| `components/product-detail/volume-pricing.tsx` | Bulk/tiered pricing prikaz |
| `components/product-detail/trust-badges.tsx` | Sigurnosni i trust certifikati |

#### Components — home

| Fajl | Svrha |
|---|---|
| `components/home/hero-banner.tsx` | Glavni hero banner s CTA |
| `components/home/category-section.tsx` | Featured produkti po kategoriji |
| `components/home/featured-spotlight.tsx` | Preporučeni produkti carousel |
| `components/home/flash-sale-banner.tsx` | Aktivan flash sale banner |
| `components/home/stats-strip.tsx` | Trust signali (dostava, povrat, reviews) |
| `components/home/trust-bar.tsx` | Payment i trust bedževi |
| `components/home/recently-viewed.tsx` | Nedavno pregledani produkti |

#### Components — social proof & flash sale

| Fajl | Svrha |
|---|---|
| `components/social-proof/purchase-toast.tsx` | "Neko je upravo kupio..." notifikacija |
| `components/social-proof/viewer-count.tsx` | "X osoba gleda" brojač |
| `components/social-proof/stock-urgency.tsx` | "Samo X preostalo" poruka |
| `components/flash-sale/countdown-timer.tsx` | Animirani countdown timer |

#### Stores (Zustand)

| Fajl | Svrha |
|---|---|
| `stores/auth-store.ts` | Login state, user, token, role |
| `stores/cart-store.ts` | Stavke korpe, količine, ukupno |
| `stores/currency-store.ts` | Odabrana valuta, tečajevi, format() |
| `stores/wishlist-store.ts` | Omiljeni produkti |
| `stores/compare-store.ts` | Produkti za usporedbu |
| `stores/theme-store.ts` | Dark/light mode preferencija |
| `stores/loyalty-store.ts` | Points balance i tier |
| `stores/flash-sale-store.ts` | Aktivni flash sale metadata |
| `stores/cookie-consent-store.ts` | GDPR consent preferencije |

#### CSS & Config

| Fajl | Svrha |
|---|---|
| `index.css` | Globalni CSS, CSS varijable (--primary, dark mode), nav button efekti |
| `elevate.css` | Hover/active button elevation efekti |
| `App.tsx` | React router, sve stranice i provideri |
| `main.tsx` | React entrypoint |

---

### API SERVER — `artifacts/api-server/src/`

#### Root

| Fajl | Svrha |
|---|---|
| `app.ts` | Express setup: middleware chain, CORS, security headers |
| `index.ts` | Server startup i port binding |
| `cron.ts` | Scheduled taskovi (email sekvence, sync) |
| `job-queue.ts` | Queue setup za async taskove |
| `job-workers.ts` | Background job procesori |

#### Korisničke rute

| Fajl | Svrha |
|---|---|
| `routes/auth.ts` | Login, register, logout, refresh |
| `routes/auth-google.ts` | Google OAuth callback |
| `routes/orders.ts` | POST /orders — kreiranje narudžbi |
| `routes/order-lookup.ts` | GET /account/orders, GET /orders/:id |
| `routes/order-invoice.ts` | GET /orders/:id/invoice.pdf |
| `routes/products.ts` | GET /products (paginacija, filteri, search) |
| `routes/checkout-session.ts` | POST /checkout-session (Stripe) |
| `routes/checkout-services.ts` | GET shipping/service opcije |
| `routes/checkout-offers.ts` | GET upsell ponude |
| `routes/coupons.ts` | POST /validate-coupon |
| `routes/currencies.ts` | GET tečajevi |
| `routes/search.ts` | GET /search full-text |
| `routes/pricing.ts` | GET cijena za checkout |
| `routes/loyalty.ts` | GET balance, POST redeem |
| `routes/wallet.ts` | GET wallet balance |
| `routes/gift-cards.ts` | Kupovina gift kartica |
| `routes/flash-sales.ts` | GET aktivne flash sales |
| `routes/product-reviews.ts` | GET/POST reviews |
| `routes/blog.ts` | GET /blog, /blog/:slug |
| `routes/newsletters.ts` | POST subscribe |
| `routes/wishlists.ts` | GET/POST wishlist |
| `routes/affiliates.ts` | Affiliate program info i prijava |
| `routes/support-tickets.ts` | GET/POST tickets |
| `routes/social-proof.ts` | GET purchase/viewer eventi |
| `routes/abandoned-carts.ts` | GET /abandoned-carts/:token |
| `routes/health.ts` | GET /health (status check) |

#### Admin rute

| Fajl | Svrha |
|---|---|
| `routes/admin-settings.ts` | GET/PUT opće postavke |
| `routes/admin-settings-extra.ts` | CPP, SMTP, valute, payment config |
| `routes/admin-orders.ts` | Upravljanje narudžbama, fulfillment |
| `routes/admin-products.ts` | CRUD produkta |
| `routes/admin-customers.ts` | Upravljanje korisnicima |
| `routes/admin-discounts.ts` | CRUD kupona |
| `routes/admin-analytics.ts` | Detaljna analitika |
| `routes/admin-balance.ts` | Dropship account balance |
| `routes/admin-metenzi-catalog.ts` | Sync Metenzi kataloga |
| `routes/admin-circuit-breaker.ts` | Emergency mode toggle |
| `routes/admin-keys.ts` | API ključevi |
| `routes/admin-tax.ts` | Porezna pravila |
| `routes/admin-loyalty.ts` | Loyalty program settings |
| `routes/admin-price-rules.ts` | Dinamičke cijene |
| `routes/admin-feeds.ts` | Google Shopping feeds |
| `routes/admin-risk-scoring.ts` | Fraud scoring config |
| `routes/index.ts` | Registracija svih routera |

#### Middleware

| Fajl | Svrha |
|---|---|
| `middleware/auth.ts` | JWT validacija, requireAuth/requireAdmin |
| `middleware/csrf.ts` | CSRF token validacija |
| `middleware/rate-limit.ts` | IP-based rate limiting |
| `middleware/permissions.ts` | RBAC po resursu |
| `middleware/idempotency.ts` | Idempotency key (payment retry zaštita) |
| `middleware/maintenance.ts` | Maintenance mode toggle |
| `middleware/referral.ts` | Affiliate/referral kod tracking |
| `middleware/security-headers.ts` | CORS, CSP, X-Frame-Options |

#### Services

| Fajl | Svrha |
|---|---|
| `services/order-pipeline.ts` | Kompletni order workflow: payment → fulfillment |
| `services/resolve-price.ts` | Finalna cijena: discount, volume, tax |
| `services/bulk-pricing-service.ts` | Volume/bulk pricing tier logika |
| `services/flash-sale-pricing.ts` | Flash sale discount primjena |
| `services/bundle-pricing.ts` | Bundle pricing |
| `services/coupon-service.ts` | Kupon validacija i redemption |
| `services/gift-card-service.ts` | Gift kartica generacija i balance |
| `services/loyalty-service.ts` | Points earning, redemption, tier |
| `services/wallet-service.ts` | Account balance top-up/dedukcija |
| `services/refund.ts` | Refund issuance i tracking |
| `services/order-emails.ts` | Transakcijski order emailovi |
| `services/abandoned-cart-service.ts` | Abandoned cart tracking |
| `services/abandoned-cart-emails.ts` | Cart recovery email sekvenca |
| `services/risk-scoring.ts` | Fraud detection scoring |
| `services/affiliate-service.ts` | Affiliate link tracking i komisija |
| `services/trustpilot-service.ts` | Trustpilot review sync |
| `services/social-proof-service.ts` | Nedavne kupovine/viewer feed |
| `services/metenzi-fulfillment-poll.ts` | Poll dropship API za status |
| `services/feed-generator.ts` | Generiranje product feedova |

#### Lib

| Fajl | Svrha |
|---|---|
| `lib/email/invoice-template.ts` | HTML email template za invoice (InvoiceData interface) |
| `lib/email/invoice-pdf.ts` | PDF generacija: puppeteer primary, pdfkit fallback |
| `lib/email/mailer.ts` | SMTP klijent za slanje emaila |
| `lib/email/send-emails.ts` | Email dispatcher s retry logikom |
| `lib/stripe-client.ts` | Stripe SDK wrapper |
| `lib/checkout-com-client.ts` | Checkout.com gateway wrapper |
| `lib/metenzi-client.ts` | Dropship supplier API klijent (HMAC auth) |
| `lib/metenzi-stock-sync.ts` | Inventory sync iz dropship |
| `lib/currency-sync.ts` | Fetch i cache tečajeva |
| `lib/encryption.ts` | AES enkripcija za osjetljive podatke |
| `lib/logger.ts` | Structured logging |
| `lib/circuit-breaker.ts` | Circuit breaker za externe API-je |
| `lib/health-checks.ts` | Dependency health probe |
| `lib/route-params.ts` | Type-safe route parameter extraction |
| `lib/html-escape.ts` | Sanitizacija HTML (XSS zaštita) |
| `lib/disposable-emails.ts` | Blokiranje temp email adresa |

---

### DATABASE — `lib/db/src/schema/`

| Fajl | Svrha |
|---|---|
| `products.ts` | Produkt tabela (naziv, opis, slike, SKU) |
| `product-attributes.ts` | Atributi (veličina, boja, itd.) |
| `product-tags.ts` | Tagovi |
| `product-qa.ts` | Q&A pitanja i odgovori |
| `categories.ts` | Kategorije s hijerarhijom |
| `bundles.ts` | Bundle/combo definicije |
| `price-rules.ts` | Dinamička pravila cijena |
| `coupons.ts` | Kupon kodovi s limitima |
| `flash-sales.ts` | Flash sale eventi |
| `gift-cards.ts` | Gift kartice i balance |
| `orders.ts` | Narudžbe (status, ukupno, adresa) |
| `order-items.ts` | Stavke narudžbi |
| `license-keys.ts` | Licence ključevi (enkriptirani) |
| `refunds.ts` | Refund records |
| `users.ts` | Korisnički accounti |
| `wallet.ts` | Account balance ledger |
| `loyalty.ts` | Points i tier tracking |
| `affiliates.ts` | Affiliate accounti i komisije |
| `settings.ts` | Store settings (naziv, logo, valuta, CPP, fees) |
| `email-templates.ts` | Customizabilni email templatei |
| `email-queue.ts` | Pending/sent emailovi |
| `newsletter.ts` | Pretplatnici i kampanje |
| `banners.ts` | Promotivni banneri |
| `blog.ts` | Blog postovi |
| `homepage-sections.ts` | CMS homepage sekcije |
| `tax-settings.ts` | Porezna pravila po zemlji |
| `checkout-services.ts` | Shipping/service opcije |
| `checkout-upsell.ts` | Upsell ponude na checkoutu |
| `abandoned-carts.ts` | Napuštene korpe |
| `wishlists.ts` | Omiljeni produkti |
| `i18n.ts` | Translation ključevi i vrijednosti |
| `consent-config.ts` | GDPR/consent templatei |
| `audit-log.ts` | Admin akcije audit trail |
| `idempotency.ts` | Idempotency key cache |
| `job-queue.ts` | Background job records |
| `social-proof.ts` | Purchase/viewer activity cache |
| `product-feeds.ts` | Feed exporti i rasporedi |
| `metenzi-mappings.ts` | Dropship product ID mappings |
| `trustpilot.ts` | Cached Trustpilot reviews |
| `surveys.ts` | Customer feedback surveys |
| `claims.ts` | Warranty/claim zahtjevi |
| `admin-permissions.ts` | RBAC permission matrix |

---

### CONFIG & DEPLOY

| Fajl | Svrha |
|---|---|
| `.github/workflows/deploy.yml` | CI/CD: push → build → VPS deploy → PM2 reload |
| `CLAUDE.md` | Upute za Claude (pravila, komande) |
| `pnpm-workspace.yaml` | Monorepo workspace config |
| `tsconfig.base.json` | Root TypeScript config |
| `ecosystem.config.cjs` | PM2 process manager config |
| `dev-local.sh` | Lokalni dev startup script |

---

### GENERIRANI FAJLOVI (ne edituj)

| Fajl | Svrha |
|---|---|
| `lib/api-client-react/src/generated/` | React Query hooks iz OpenAPI spec |
| `lib/api-zod/src/generated/` | Zod validacijske sheme iz OpenAPI spec |

> Regeneriraj s: `pnpm --filter @workspace/api-spec run codegen`
