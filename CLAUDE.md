# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**PixelCodes** is a pnpm monorepo ecommerce platform for selling digital software license keys. It is a full-stack TypeScript application.

- **Package Manager**: pnpm (enforced via preinstall hook — do not use npm or yarn)
- **Frontend**: React 19 + Vite + Tailwind CSS v4
- **Backend**: Express 5 + Node.js 24
- **Database**: PostgreSQL with Drizzle ORM
- **TypeScript**: 5.9.2

## Monorepo Structure

```
artifacts/
├── api-server/      # Express backend (port 8080)
├── storefront/      # React frontend (port 18539 dev, 3000 prod)
└── mockup-sandbox/  # Component preview server

lib/
├── api-spec/        # OpenAPI spec — source of truth for the API contract
├── api-client-react/ # Generated React Query hooks (do not edit manually)
├── api-zod/         # Generated Zod schemas from OpenAPI (do not edit manually)
└── db/              # Drizzle ORM schemas + migrations

scripts/
└── seed.ts, seed-product-qa.ts
```

## Commands

### Local Development

```bash
bash dev-local.sh                   # Start API (8080) + Storefront (18539) together
```

Or start individually:
```bash
pnpm --filter @workspace/api-server run dev      # API server (watch mode)
pnpm --filter @workspace/storefront run dev      # Vite dev server
```

### Build & Typecheck

```bash
pnpm run build           # Typecheck + build all packages
pnpm run typecheck       # Full typecheck across all packages
pnpm run typecheck:libs  # Typecheck lib packages only
pnpm --filter @workspace/api-server run build    # esbuild CJS bundle → dist/
pnpm --filter @workspace/storefront run build    # Vite production build
```

### Database

```bash
pnpm --filter @workspace/db run push         # Apply schema changes to DB
pnpm --filter @workspace/db run push-force   # Destructive schema push (use carefully)
```

### Seeding

```bash
pnpm --filter @workspace/scripts run seed        # Full seed: admin@store.com / Admin123!, 5 categories, 12 products
pnpm --filter @workspace/scripts run seed:qa     # QA product seed only
```

### API Code Generation

After editing the OpenAPI spec in `lib/api-spec/`:
```bash
pnpm --filter @workspace/api-spec run codegen    # Regenerates hooks in api-client-react/ and schemas in api-zod/
```

### Testing

```bash
pnpm test:e2e                                        # Playwright E2E tests (root)
pnpm --filter @workspace/storefront run test:e2e     # Storefront E2E only
```

## Database Setup (First Time)

```bash
export DATABASE_URL="postgresql://user:pass@localhost:5432/pixelcodes"
pnpm --filter @workspace/db run push
pnpm --filter @workspace/scripts run seed
```

## Architecture

### API Contract Flow

The OpenAPI spec in `lib/api-spec/` is the **single source of truth**. Editing the spec and running codegen regenerates:
- `lib/api-client-react/` — React Query hooks used by the storefront
- `lib/api-zod/` — Zod validation schemas used by the API server

Never edit these generated packages directly.

### Frontend (`artifacts/storefront/src/`)

- **Routing**: `wouter` (lightweight). Routes are defined in `App.tsx`.
- **State**: Zustand stores in `stores/` (auth, cart, currency, wishlist, loyalty, compare, flash-sale)
- **API calls**: Generated React Query hooks from `@workspace/api-client-react`
- **UI**: shadcn/ui + Radix UI primitives, styled with Tailwind CSS v4
- **i18n**: i18next for multi-language support

### Backend (`artifacts/api-server/src/`)

- `app.ts` — Express setup, middleware registration
- `routes/` — Organized by feature; includes public, admin, and customer endpoints
- `services/` — Business logic (orders, loyalty, wallet, affiliates, email, etc.)
- `lib/` — Utilities: circuit breaker, idempotency, job queue, Metenzi/Stripe clients
- `cron.ts` / `job-queue.ts` / `job-workers.ts` — Background job scheduling

### Database (`lib/db/src/schema/`)

50+ Drizzle table definitions, one concern per file. Key areas:
- **Products**: `products`, `product_variants`, `categories`, `tags`, `attributes`, `reviews`
- **Orders**: `orders`, `order_items`, `order_services`
- **Payments**: `wallet`, `wallet_transactions`, `gift_cards`, `coupons`
- **Features**: `loyalty`, `wishlists`, `bundles`, `flash_sales`, `abandoned_carts`
- **Integrations**: `api_providers`, `license_keys`, `claims`, `social_proof_events`
- **CMS/Settings**: `site_settings`, `pages`, `faqs`, `email_templates`, `i18n_strings`
- **Business**: `affiliates`, `price_rules`, `checkout_services`, `surveys`

## Key Architecture Patterns

- **Idempotency**: `X-Idempotency-Key` header enforced on payment/topup endpoints (24-hour TTL via idempotency service)
- **Circuit Breaker**: Stripe and Metenzi integrations use a circuit breaker for graceful degradation
- **Job Queue**: Background tasks (email sending, cron operations) go through `job-queue.ts`
- **Pricing Engine**: Flash sales, loyalty tier discounts, bundle pricing, coupons, and bulk rules are all layered — see `services/pricing*`
- **Wallet System**: Per-user balance with an append-only transaction ledger
- **Social Proof**: Real-time viewer counts and sold counts batched and cached per product
- **Abandoned Cart Recovery**: 3-email sequence with configurable timing

## External Integrations

| Service | Purpose | Key Files |
|---|---|---|
| **Metenzi** | License key provider | `lib/metenzi-*.ts` — HMAC-SHA256 auth, syncs products every 30 min |
| **Stripe** | Payment processing | Wrapped in circuit breaker pattern |
| **Google OAuth** | Social login | Admin-configured via Settings; client ID/secret stored in DB |
| **Trustpilot** | Reviews | Post-purchase invitations, cached rating widget with ad-blocker fallback |
| **Nodemailer** | Transactional email | Queue-backed retry logic, HTML templates |

## Deployment

- **CI/CD**: GitHub Actions (`.github/workflows/deploy.yml`) — triggers on push to `main`
- **Host**: Contabo VPS — Nginx (443/80) → PM2 (Node API) → PostgreSQL
- **SSL**: Let's Encrypt (auto-renewed)
- **Static assets**: 1-year cache for versioned files, no-cache for HTML

## Working Principles

### 1. Think Before Coding

Before implementing anything:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

Write the minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.
- Ask: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

Touch only what you must. Clean up only your own mess.

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.
- Remove imports/variables/functions that **your** changes made unused, but don't remove pre-existing dead code unless asked.
- Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

Transform tasks into verifiable goals before writing code:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan with explicit verify steps before starting.

## Design Constraints

- All source files must remain **under 300 lines**.
- **Light mode** is the default theme (dark mode is a future task — do not add it now).
- Product grid is **6 items per row** (k4g.com-inspired compact layout).
- Primary color: **blue** (HSL 221 83% 53%).
