# PixelCodes — Digital Software License Storefront

## Overview

pnpm workspace monorepo for PixelCodes, an ecommerce website selling digital software license keys. Light theme inspired by k4g.com (6 products per row, compact modern design). Integrates with metenzi.com/api (HMAC-SHA256 signing).

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui + Zustand
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Auth**: bcryptjs + JWT with 30-day cookie sessions + Google OAuth (optional)
- **Build**: esbuild (CJS bundle for API server)
- **Routing**: wouter (frontend)

## Artifacts

- **Storefront** (`artifacts/storefront`): React+Vite frontend at `/` (port from env)
- **API Server** (`artifacts/api-server`): Express 5 backend at `/api` (port from env)
- **Mockup Sandbox** (`artifacts/mockup-sandbox`): Component preview server

## Database Schema

Tables split across `lib/db/src/schema/`:
- `users.ts` — users with roles (CUSTOMER, ADMIN, SUPER_ADMIN)
- `categories.ts` — product categories with parent/child support
- `products.ts` — products + product_variants (editions/platforms, pricing, stock)
- `orders.ts` — orders + order_items
- `license-keys.ts` — license keys with status tracking
- `reviews.ts` — product reviews
- `coupons.ts` — discount coupons (percentage/fixed)
- `settings.ts` — site_settings, pages (CMS), faqs
- `api-providers.ts` — external API providers (metenzi)
- `wishlists.ts` — user wishlists
- `wallet.ts` — wallet transactions
- `blog.ts` — blog posts
- `support.ts` — support tickets + ticket messages
- `affiliates.ts` — affiliate_profiles, affiliate_clicks, affiliate_commissions, affiliate_settings
- `abandoned-carts.ts` — abandonedCarts, abandonedCartEmails, abandonedCartSettings (3-email recovery sequence)
- `loyalty.ts` — loyaltyAccounts, loyaltyTransactions, loyaltySettings (points, tiers, bonuses)
- `bundles.ts` — bundles, bundleItems (curated product bundles with discounted package pricing)

## Frontend Stores (Zustand)

Located in `artifacts/storefront/src/stores/`:
- `auth-store.ts` — user auth state + JWT token
- `cart-store.ts` — shopping cart with localStorage persistence
- `currency-store.ts` — currency selection + conversion
- `compare-store.ts` — product comparison (max 4)
- `wishlist-store.ts` — wishlist with toggle
- `flash-sale-store.ts` — active flash sale variant prices
- `loyalty-store.ts` — loyalty config (enabled, pointsPerDollar, redemptionRate)

## Loyalty Points & Rewards

- Admin configurable via Settings > Loyalty tab (enable/disable, earning rates, tier thresholds)
- Tiers: BRONZE → SILVER → GOLD → PLATINUM (based on lifetime points, each with multiplier)
- Points earned on order completion, registration (welcome bonus), review approval (idempotent)
- Checkout: authenticated users can redeem points for discounts (server-validated, not client-trusted)
- Account page: Rewards tab shows tier, balance, progress bar, transaction history
- Admin: customer detail page shows loyalty info with point adjustment controls
- Schema: loyaltyAccounts, loyaltyTransactions, loyaltySettings tables
- Service: `loyalty-service.ts` (earn, redeem, tier calculation, config)
- Routes: `loyalty.ts` (customer), `admin-loyalty.ts` (admin settings + customer adjustments)

## Product Bundles

- Curated bundles of products sold at a discounted package price
- Public: `/bundles` listing page, `/bundles/:slug` detail page with pricing comparison
- Cart: bundle items added individually with proportionally discounted prices (marked as "Bundle")
- Product detail: cross-sell callout when product appears in any active bundle
- Admin: `/admin/bundles` with create/edit/duplicate/delete, product search, drag-to-reorder, SEO fields
- Schema: bundles, bundleItems tables
- Routes: `bundles.ts` (public), `admin-bundles.ts` (admin CRUD)

## Support Tickets

- Customers: create tickets (with category, optional order link), view/reply from account Support tab
- Admin: queue with stats (open/pending/resolved counts), detail view with thread, internal notes, status/priority/assignee management
- Ticket numbers: sequential TKT-00001 format (max+1 with collision retry)
- Email notifications: new ticket → admins, admin reply → customer, customer reply → assignee
- Routes: `support-tickets.ts` (customer), `admin-support.ts` (admin)
- Frontend: `/support/new`, `/support/tickets/:num`, `/account?tab=support`, `/admin/support`, `/admin/support/:num`
- Schema: supportTickets, ticketMessages (with isInternal for staff notes)

## Google OAuth

- Admin configurable via Settings > Google OAuth tab (Client ID, Client Secret, enable/disable)
- Server routes: `auth-google.ts` handles redirect, Google callback, login/register/link
- Google-only accounts get placeholder password hash; users can set real password from account
- Connected Accounts tab in account page shows link/unlink Google
- `GoogleButton` component auto-hides when Google OAuth is disabled

## Metenzi API Integration

Located in `artifacts/api-server/src/lib/`:
- `encryption.ts` — AES-256-GCM encrypt/decrypt for API keys (uses ENCRYPTION_KEY env var)
- `metenzi-client.ts` — HTTP client with Bearer auth, HMAC-SHA256 signing for writes, retry with exponential backoff on 429
- `metenzi-endpoints.ts` — All endpoint functions: getProducts, getProductById, createOrder, getOrderById, getBalance, listWebhooks, createWebhook, deleteWebhook, listClaims, submitClaim
- `metenzi-config.ts` — Loads Metenzi provider config from DB, decrypts keys, caches for 5 min
- `product-sync.ts` — Syncs Metenzi products into local DB (upsert products + variants)
- `cron.ts` — Background cron: product sync every 30 minutes

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas
- `pnpm --filter @workspace/db run push` — push DB schema changes
- `pnpm --filter @workspace/scripts run seed` — seed database with sample data
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Seed Data

- Admin user: admin@store.com / Admin123! (SUPER_ADMIN)
- 5 categories: Operating Systems, Office, Antivirus, Games, Servers & Dev
- 12 products with 14 variants (various SKUs and platforms)
- 4 FAQs, 1 site settings row, 1 API provider (metenzi, inactive)

## Design Rules

- All files must be under 300 lines
- Light theme by default (dark mode is a future task)
- 6 products per row on homepage (k4g.com-inspired compact grid)
- Primary color: blue (HSL 221 83% 53%)

See the `pnpm-workspace` skill for workspace structure and package details.
