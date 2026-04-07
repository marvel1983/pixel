# Admin Portal — Detailed Replit AI Task Prompts

> These tasks replace the single "Admin Portal" block (Task 17) from the main task document.
> **Stack:** TypeScript · Next.js 14 App Router · Prisma · Tailwind CSS · shadcn/ui
> **All admin routes** are under `/app/(admin)/admin/` and protected by a middleware that checks `session.user.role === "ADMIN"`. Any non-admin request redirects to `/login`.

---

## ADMIN TASK A1 — Admin Layout, Sidebar & Navigation Shell

**Prompt for Replit AI:**

```
Build the admin portal shell layout at /app/(admin)/layout.tsx and /app/(admin)/admin/layout.tsx.

SIDEBAR (desktop — fixed left, 240px wide):
Sections and links:
  OVERVIEW
    - Dashboard          → /admin
    - Analytics          → /admin/analytics
  CATALOGUE
    - Products           → /admin/products
    - Categories         → /admin/categories
    - Banners            → /admin/banners
  SALES
    - Orders             → /admin/orders
    - License Keys       → /admin/keys
    - Claims             → /admin/claims
    - Discount Codes     → /admin/discounts
  CUSTOMERS
    - Customers          → /admin/customers
    - Reviews            → /admin/reviews
  CONTENT
    - Pages              → /admin/pages
    - Live Chat          → /admin/live-chat
  SYSTEM
    - Settings           → /admin/settings
    - Webhooks           → /admin/webhooks
    - Audit Log          → /admin/audit-log
    - Metenzi Balance    → /admin/balance

Each sidebar item has:
- Icon (Lucide React icon)
- Label
- Active highlight (blue background) when current route matches
- Collapsed state for mobile (icon only, tooltip on hover)

TOP BAR:
- Left: Hamburger to toggle sidebar collapse (desktop) / open drawer (mobile)
- Left: Current page title (breadcrumb)
- Right: Notification bell (badge with count of pending reviews + pending orders)
- Right: Admin user avatar + dropdown (My Profile, Change Password, View Store → opens storefront in new tab, Logout)

MOBILE: sidebar becomes a slide-in drawer (closes on overlay click or navigation).

FOOTER: small bar at bottom "Admin Portal · [SiteName]"

Middleware at /middleware.ts:
- Protect all /admin/* routes
- If session is null or role !== "ADMIN": redirect to /login?redirect=[currentPath]
- Use NextAuth getServerSession
```

---

## ADMIN TASK A2 — Dashboard & KPI Overview

**Prompt for Replit AI:**

```
Build the admin dashboard at /app/(admin)/admin/page.tsx.

This page fetches all data server-side (Next.js Server Component with Prisma queries).

TOP STATS ROW — 4 stat cards:
1. Total Orders Today — count of orders where createdAt >= start of today
2. Revenue Today — sum of totalAmount for COMPLETED orders today, formatted with € currency
3. Total Orders This Month — count for current calendar month
4. Revenue This Month — sum for current calendar month

SECOND ROW — 3 stat cards:
5. Active Products — count of products where status = "active" in local DB
6. Pending Orders — count of orders where status = "PENDING" or "PROCESSING"
7. Metenzi Balance — live fetch from Metenzi GET /api/public/balance (server-side, show spinner fallback if API unavailable)

RECENT ORDERS TABLE:
- Last 10 orders, newest first
- Columns: Order #, Customer (email or "Guest"), Products (first item name + "+ N more"), Total, Status badge, Date
- Status badges: PENDING (yellow chip), PROCESSING (blue chip), COMPLETED (green chip), CANCELLED (red chip), REFUNDED (orange chip)
- Clicking a row navigates to /admin/orders/[id]
- "View All Orders" link at bottom

LOW STOCK ALERT SECTION:
- Products where stock (from local DB, synced from Metenzi) < 5
- Card list: product image, name, SKU, current stock number (red if 0, orange if < 5)
- "Sync Products" button to trigger immediate re-sync from Metenzi

PENDING REVIEWS SECTION:
- Last 5 reviews awaiting approval (isApproved = false)
- Shows: product name, reviewer name, star rating, excerpt of review text, "Approve" and "Reject" buttons (inline action — no page redirect)
- "Manage All Reviews" link

All stat cards use shadcn/ui Card component. Include skeleton loaders for async data.
```

---

## ADMIN TASK A3 — Analytics Page

**Prompt for Replit AI:**

```
Build the analytics page at /app/(admin)/admin/analytics/page.tsx.

Use the Recharts library for all charts (already available in the project).

DATE RANGE SELECTOR at the top:
- Presets: Today, Last 7 days, Last 30 days, This Month, Last Month, Custom Range (date picker)
- Default: Last 30 days
- All charts and stats update when range changes (client-side re-fetch via SWR or React Query)

SECTION 1 — Revenue Chart:
- Line chart: X axis = date, Y axis = revenue (€)
- One data point per day in the selected range
- Tooltip showing date + revenue + order count for that day
- Data from: sum of Order.totalAmount grouped by date (orders where status = COMPLETED)

SECTION 2 — Orders Chart:
- Bar chart: X axis = date, Y axis = order count
- Colored by status (green = completed, blue = processing, red = cancelled)
- Stacked bar chart

SECTION 3 — Top Products (table):
- Columns: Rank, Product name, Units Sold, Revenue Generated
- Top 10 products by units sold in the date range
- Calculated from OrderItem table
- Clicking a product name → /admin/products/[id]

SECTION 4 — Revenue by Category (pie/donut chart):
- Each slice = a product category, sized by revenue
- Legend below showing category names and % share

SECTION 5 — Summary Stats Row:
- Total Revenue, Total Orders, Average Order Value, Conversion Rate (orders / sessions — placeholder if no session tracking), New Customers, Returning Customers

API route GET /api/admin/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD:
- Returns all the aggregated data needed for the charts
- Protected (admin only)
- Uses Prisma groupBy and aggregate queries

All charts are responsive (use ResponsiveContainer from Recharts).
```

---

## ADMIN TASK A4 — Product List & Search

**Prompt for Replit AI:**

```
Build the product management list page at /app/(admin)/admin/products/page.tsx.

This is a server-rendered page with client-side filtering via URL query params.

HEADER ROW:
- Page title: "Products" with total count badge
- "Sync from Metenzi" button (blue) — triggers POST /api/admin/sync-products, shows a loading spinner and toast "Sync started — products will update in the background"
- Last synced timestamp ("Last synced: 5 minutes ago")

FILTER ROW:
- Search input: searches product name, SKU (debounced 300ms, updates URL param ?q=)
- Category dropdown filter (all categories from DB + "All Categories" option)
- Status filter: All | Active | Inactive
- Platform filter: All | Windows | MAC | Other
- "Reset Filters" link (clears all filters)

PRODUCTS TABLE (shadcn/ui Table):
Columns:
- Checkbox (for bulk actions)
- Image (40×40px thumbnail, fallback placeholder)
- Name (bold, clickable → /admin/products/[id]) + SKU below in grey
- Category / Platform (two stacked badges)
- Retail Price (€)
- B2B Price (€) — shown in smaller grey text below retail
- Stock (number — red if 0, orange if < 5, green if ≥ 5)
- Status (toggle switch: active/inactive — inline update via PATCH /api/admin/products/[id]/status, no page reload)
- Actions (Edit pencil icon → /admin/products/[id]/edit, eye icon → open storefront product page in new tab)

BULK ACTIONS BAR (shown when checkboxes selected):
- "X products selected"
- "Set Active" button
- "Set Inactive" button
- "Export CSV" button (downloads selected products as CSV)

PAGINATION: 25 products per page, prev/next + numbered.

Empty state: "No products found. Click 'Sync from Metenzi' to import your product catalogue."

API route POST /api/admin/sync-products:
- Admin only
- Calls Metenzi GET /api/public/products?retrieveAll=true
- For each product: upsert into local Product table (update if metenziId exists, insert if new)
- Also mark products missing from Metenzi response as inactive
- Return { synced: N, updated: N, deactivated: N }
```

---

## ADMIN TASK A5 — Product Edit Page

**Prompt for Replit AI:**

```
Build the product edit page at /app/(admin)/admin/products/[id]/edit/page.tsx.

Layout: 2-column form (left: main content, right: sidebar settings)

TOP BAR:
- Back button → /admin/products
- Product name as page title
- "View on Store" button (opens /product/[slug] in new tab)
- "Save Changes" button (top right, blue)

LEFT COLUMN — CONTENT FIELDS:
1. Product Name — text input (read-only, sourced from Metenzi, shown greyed out with tooltip "Managed by Metenzi")
2. Slug — editable text input (auto-generated from name, must be URL-safe, unique). "Regenerate" button.
3. Short Description — textarea (2-3 sentences, shown on product cards and in search results)
4. Full Description — rich text editor (TipTap or react-quill). Supports: bold, italic, headings (H2, H3), bullet lists, numbered lists, links, images.
5. Key Features — multi-line textarea (one feature per line, displayed as bullet list on product page)
6. System Requirements — key-value table editor:
   - Rows: Operating System, Processor, RAM, Storage, Graphics, Display, Internet
   - Each row has a label and a value text input
   - "+ Add Row" button for custom requirements
   - "× Remove" button per row
7. Installation Instructions — textarea (shown in license key delivery email)
8. Meta Title — text input (SEO, max 60 chars with character count)
9. Meta Description — textarea (SEO, max 160 chars with character count)

RIGHT COLUMN — SETTINGS:
1. STATUS CARD:
   - Status toggle: Active / Inactive
   - "Visible on store" description

2. PRICING CARD (read-only from Metenzi, displayed for reference):
   - Retail Price: €XX.XX
   - B2B Cost Price: €XX.XX
   - Currency: EUR
   - Note: "Prices are managed in your Metenzi account"
   - Override Retail Price toggle: if enabled, shows a custom price input that overrides the Metenzi retail price on the storefront

3. FEATURED & SALE CARD:
   - "Featured product" toggle (isFeatured — shown in Hot Offers, homepage spotlight)
   - "On Sale" toggle (isOnSale)
   - If "On Sale" ON: Sale Price input (€), shown as strikethrough original + red sale price

4. IMAGE CARD:
   - Current image preview (from Metenzi imageUrl or override)
   - "Override Image URL" text input (paste a custom image URL)
   - Image preview updates live as URL is typed

5. CROSS-SELLS CARD:
   - "Customers also buy..." section
   - Multi-select search of products (type to search, shows product name + SKU)
   - Selected products shown as removable tags
   - Up to 3 cross-sell products
   - These appear as checkboxes on the product detail page

6. RELATED PRODUCTS CARD:
   - Same multi-select search UI
   - Up to 8 related products
   - These appear in the "Related Products" section at the bottom of the product detail page

7. CHECKOUT UPSELL CARD:
   - Toggle: "Use this product as a checkout upsell offer"
   - If enabled, this product appears in the "Product offer" box at checkout (max 1 site-wide — enabling here disables any previous upsell)
   - Urgency message text input (e.g. "Only 500 units at this price!")

8. SORT ORDER CARD:
   - Number input (lower = shown first in category listings)

SAVE: PATCH /api/admin/products/[id] — saves all editable fields to DB. Show toast on success/failure.
```

---

## ADMIN TASK A6 — Category Management

**Prompt for Replit AI:**

```
Build the category management page at /app/(admin)/admin/categories/page.tsx.

Categories are NOT stored as a separate Prisma model — they are derived from Product.category field (distinct values). The admin can customize how they are displayed but not create/delete them separately (they come from Metenzi products).

PAGE LAYOUT:
- Page title: "Categories"
- Table of unique category values found in the Product table (use Prisma's findMany with distinct)

TABLE COLUMNS:
- Category Name (from Product.category)
- Product Count (count of products in this category)
- Slug (auto-generated, editable — used in /category/[slug] URL)
- Display Name (optional override for how it appears in navigation — defaults to the raw category name)
- Sort Order (drag handle or number input — controls order in the "All Categories" dropdown in site header)
- Show in Navigation toggle (if OFF, category won't appear in the header categories dropdown)
- Actions: Edit (inline), View products (link to /admin/products?category=[name])

CATEGORY EDIT INLINE:
- Click pencil icon → row expands to show:
  - Display Name input
  - Slug input
  - Sort Order input
  - Show in Nav toggle
  - "Save" and "Cancel" buttons
  - Save calls PATCH /api/admin/categories/[slug]

Add a CategoryMeta model to Prisma schema:
{ id, rawName (unique — maps to Product.category), displayName, slug (unique), sortOrder, showInNav, createdAt, updatedAt }

This table is seeded automatically when products are synced (any new category found in products creates a CategoryMeta row if it doesn't already exist).
```

---

## ADMIN TASK A7 — Order List & Filtering

**Prompt for Replit AI:**

```
Build the orders list page at /app/(admin)/admin/orders/page.tsx.

HEADER:
- Page title: "Orders" with total count
- "Export CSV" button (exports current filtered results as CSV download)

FILTER BAR:
- Search input: searches by Order #, customer email, or guest email (debounced)
- Status filter dropdown: All | Pending | Processing | Completed | Cancelled | Refunded
- Date range: "From" date picker + "To" date picker
- "Has Coupon" toggle filter
- "Has CPP" toggle filter
- Reset Filters link

ORDERS TABLE:
Columns:
- Order # (clickable → /admin/orders/[id])
- Customer: name + email (or "Guest" + email)
- Items: first product name, "+ N more" if multiple items, product count badge
- Subtotal, Discount (green negative if applied), CPP fee (if applicable), Card Fee, Total (bold)
- Discount Code used (small chip, or "—")
- CPP badge (blue "CPP" chip if cppAdded = true)
- Status badge (colored chip)
- Payment method icon (Visa/MC/etc.)
- Date (relative: "2 hours ago", tooltip shows full date)
- Actions: eye icon → detail page, envelope icon → resend confirmation email

BULK ACTIONS (when rows selected):
- "Mark as Completed"
- "Mark as Cancelled"
- "Export Selected"

PAGINATION: 25 per page.

Color coding: PENDING rows have a subtle yellow left border, PROCESSING rows blue, COMPLETED rows are normal, CANCELLED rows have grey text.

Summary bar below filters: "Showing X orders · Total revenue: €XX,XXX.XX" (for current filter/date range).
```

---

## ADMIN TASK A8 — Order Detail View

**Prompt for Replit AI:**

```
Build the order detail page at /app/(admin)/admin/orders/[id]/page.tsx.

HEADER:
- Back button → /admin/orders
- "Order #[orderNumber]" as title
- Status badge (large)
- Placed date/time
- Action buttons row (right side):
  - "Resend Confirmation Email" button
  - "Mark as Completed" button (if status is PENDING or PROCESSING)
  - "Mark as Cancelled" button (if status is PENDING or PROCESSING) — opens confirmation modal
  - "Issue Refund" button (if status is COMPLETED) — opens refund confirmation modal, calls Checkout.com refund API

TWO-COLUMN LAYOUT:

LEFT COLUMN:

ORDER ITEMS CARD:
- Table: product image, name, SKU, quantity, unit price, line total
- If upsell product was added, show it with a "Upsell" badge

PAYMENT INFORMATION CARD:
- Payment method: Card (Visa / Mastercard) + last 4 digits if available from Checkout.com
- Transaction ID (Checkout.com payment ID)
- Card Processing Fee applied
- Payment status (Authorized / Captured / Refunded)

METENZI ORDER CARD:
- Metenzi Order ID (link opens Metenzi dashboard if possible)
- Metenzi Order Status (fetched live from Metenzi API on page load)
- "Fetch Latest from Metenzi" refresh button
- If order is backorder: show "Stock expected soon — order will auto-fulfill"

LICENSE KEYS CARD (only shown when at least 1 key exists):
- Table: Product, Key Code (FULLY UNMASKED — admin can see full keys), Key Type (text/image), Status (assigned/delivered/claimed), Delivered At
- For image-type keys: clickable thumbnail → opens full image in lightbox
- "Submit Claim for this Key" button per row → opens claim modal (Task A14)
- "Copy Key" clipboard icon per row

ORDER NOTES CARD:
- Internal admin notes textarea (saved to Order.adminNotes field — not visible to customer)
- "Save Note" button

ORDER TIMELINE CARD:
- Vertical timeline of events:
  Order Placed → Payment Captured → Sent to Metenzi → Keys Delivered → Email Sent
  Each event has timestamp and description

RIGHT COLUMN:

ORDER SUMMARY CARD:
- Subtotal
- Discount (if applied, show code name)
- CPP Fee (if added)
- Card Processing Fee
- Total (bold, large)
- Currency

CUSTOMER INFORMATION CARD:
- Name, Email, Phone
- Country, City, Address
- Account link (if registered user): "View Customer Profile" → /admin/customers/[userId]
- "Send Email to Customer" button (opens compose modal with pre-filled To: address)

CPP STATUS CARD:
- Whether CPP was added: Yes / No
- CPP fee charged
```

---

## ADMIN TASK A9 — License Key Management

**Prompt for Replit AI:**

```
Build the license keys page at /app/(admin)/admin/keys/page.tsx.

This page shows all LicenseKey records in the database (delivered from Metenzi).

FILTER BAR:
- Search by: key code (partial match), order #, product name
- Status filter: All | Pending | Delivered | Claimed
- Product filter: dropdown of all products
- Date range filter

TABLE COLUMNS:
- Key Code: shows last 4 chars visible + "••••••••••" for security (hover or click "Reveal" button to show full code — log this action to AuditLog)
- Key Type: "TEXT" badge or "IMAGE" badge
- Product: name + SKU
- Order #: clickable → /admin/orders/[id]
- Customer email (from linked order)
- Status badge: PENDING (yellow), DELIVERED (green), CLAIMED (red)
- Assigned At / Delivered At date
- Actions:
  - "Copy" icon (copies key code to clipboard, logs to AuditLog: "Admin copied key [id]")
  - "Submit Claim" icon → opens claim submission modal (see Task A14)
  - "View Order" icon → /admin/orders/[orderId]

KEY REVEAL SECURITY:
- When admin clicks "Reveal" on a key: show confirmation dialog "This will log your access to the audit trail. Continue?"
- On confirm: fetch full key via POST /api/admin/keys/[id]/reveal (admin only, logs to AuditLog)
- Show full key in a highlighted input field with copy button
- Auto-hide after 30 seconds

SUMMARY STATS above the table:
- Total Keys: [N] | Delivered: [N] | Pending: [N] | Claimed: [N]

PAGINATION: 50 per page.
```

---

## ADMIN TASK A10 — Claims Management

**Prompt for Replit AI:**

```
Build the claims management page at /app/(admin)/admin/claims/page.tsx.

Claims are submitted when a customer reports a license key is defective. They are tracked via the Metenzi API and stored in a local Claims model.

Add to Prisma schema:
model Claim {
  id, metenziClaimId (unique), keyId (FK to LicenseKey), orderId (FK to Order),
  reason (invalid | already_used | wrong_region | other),
  status (open | resolved | rejected),
  notes, resolutionNotes,
  submittedAt, resolvedAt, createdAt
}

FILTER BAR:
- Status filter: All | Open | Resolved | Rejected
- Reason filter: All | Invalid | Already Used | Wrong Region | Other
- Date range

TABLE COLUMNS:
- Claim ID (Metenzi claim ID)
- Key (masked key code) → hovering shows product name
- Order # → link to order detail
- Customer email
- Reason (badge: INVALID red, ALREADY_USED orange, WRONG_REGION yellow, OTHER grey)
- Status badge: OPEN (red pulse), RESOLVED (green), REJECTED (grey)
- Notes (truncated, expand on hover)
- Resolution Notes (truncated)
- Submitted date | Resolved date
- Actions:
  - "Fetch Latest Status" (refreshes claim status from Metenzi API)
  - "View Order" link

SUBMIT CLAIM MODAL (used from both this page and the Keys page):
- Dropdown: Select Product / Order (search by order # or key)
- Reason dropdown: Invalid Key | Already Used | Wrong Region | Other
- Notes textarea (optional, max 1000 chars)
- "Submit Claim" button → calls Metenzi POST /api/public/claims + saves to local Claims table
- Success toast: "Claim submitted. Metenzi Claim ID: [id]"

STATS BAR: Open: [N] | Resolved: [N] | Average Resolution Time: [X] hours
```

---

## ADMIN TASK A11 — Discount Codes List

**Prompt for Replit AI:**

```
Build the discount codes list page at /app/(admin)/admin/discounts/page.tsx.

HEADER:
- Page title: "Discount Codes"
- "Create Discount Code" button (blue) → navigates to /admin/discounts/new

FILTER BAR:
- Search by code name
- Type filter: All | Percentage | Fixed Amount
- Status filter: All | Active | Inactive | Expired

TABLE COLUMNS:
- Code (bold monospace font, copy-to-clipboard icon)
- Type: "XX% OFF" badge or "€XX OFF" badge (green)
- Min Order: "Min €[X]" or "—"
- Usage: "[usedCount] / [maxUses]" with progress bar (e.g. ████░░ 40/100), or "[usedCount] / ∞" if maxUses is null
- Status: Active (green toggle), Inactive (grey toggle) — toggle is inline and calls PATCH without page reload
- Expires: formatted date or "Never"
- Created: relative date
- Actions: Edit (pencil → /admin/discounts/[id]/edit), Delete (trash icon with confirm modal)

Clicking a code row opens the edit page.

QUICK STATS above table:
- Total Codes: [N] | Active: [N] | Total Discount Given: €[sum of all discount amounts applied to completed orders]

PAGINATION: 25 per page.
```

---

## ADMIN TASK A12 — Discount Code Create & Edit

**Prompt for Replit AI:**

```
Build the discount code create and edit pages.
- Create: /app/(admin)/admin/discounts/new/page.tsx
- Edit: /app/(admin)/admin/discounts/[id]/edit/page.tsx (pre-fills form from DB)

FORM FIELDS (with Zod validation):

1. Code * — text input, uppercase enforced automatically
   - "Generate Random Code" button (generates a random 8-char alphanumeric code, e.g. "SUMMER8X")
   - Must be unique — validate on blur with GET /api/admin/discounts/check-code?code=[code]
   - Show green checkmark if available, red X if taken

2. Discount Type * — radio buttons:
   - Percentage (e.g. 15% off the subtotal)
   - Fixed Amount (e.g. €5 off the subtotal)

3. Discount Value * — number input
   - If Percentage: label "Discount (%)", max 100
   - If Fixed: label "Discount Amount (€)", min 0.01

4. Minimum Order Amount — number input (€), optional
   - "No minimum" checkbox (default ON)
   - If unchecked, show the amount input

5. Maximum Uses — number input, optional
   - "Unlimited uses" checkbox (default ON)
   - If unchecked, show uses input

6. Expiry Date — date picker, optional
   - "No expiry" checkbox (default ON)
   - If unchecked, show date picker

7. Status — Active / Inactive toggle (default: Active)

8. Description (internal only) — text input for admin notes (e.g. "Summer 2025 promo — only for newsletter subscribers")

PREVIEW PANEL (right side, live updates as fields change):
- "Discount Preview" heading
- Example: "Customer enters code: [CODE] → €50 order becomes €42.50 (15% off)"
- Eligibility: "Valid on orders over €[minAmount]", "Expires: [date]", "Limited to [X] uses"

SAVE: POST /api/admin/discounts (create) or PATCH /api/admin/discounts/[id] (edit)
Redirect to /admin/discounts on success with toast "Discount code [CODE] saved."
```

---

## ADMIN TASK A13 — Customer List & Detail

**Prompt for Replit AI:**

```
Build the customer management pages.

LIST PAGE at /app/(admin)/admin/customers/page.tsx:

FILTER BAR:
- Search by name or email
- Date range (registered between)
- Has Orders toggle
- Role filter: All | Customer | Admin

TABLE COLUMNS:
- Avatar initials circle (first letter of first + last name, random pastel color per user)
- Name (bold) + Email below
- Username
- Orders Count (clickable badge → /admin/orders?customer=[email])
- Total Spent (€, sum of COMPLETED orders)
- Last Order date (relative)
- Marketing Consent: ✓ or ✗ icon
- Registered date
- Role badge: CUSTOMER (grey), ADMIN (blue)
- Actions: View (eye → detail page), Promote to Admin (shown for CUSTOMER role only, requires confirm modal), Demote to Customer (shown for ADMIN role only), "Delete Account" (soft delete — anonymize data)

PAGINATION: 25 per page.
Stats above table: Total Customers: [N] | New This Month: [N] | With Orders: [N]

---

DETAIL PAGE at /app/(admin)/admin/customers/[id]/page.tsx:

HEADER:
- Back to Customers
- Customer full name + email as title
- Role badge + edit role button

TWO COLUMNS:

LEFT:
PROFILE CARD:
- First Name, Last Name, Email, Username, Phone (if available)
- Registered date
- Marketing Consent: Yes/No
- Role: CUSTOMER / ADMIN
- "Reset Password" button (sends password reset email to customer)
- "Edit Profile" button (opens modal to edit name/email)

ORDER HISTORY TABLE:
- All orders by this customer (same columns as main orders list, condensed)
- Link to each order detail

WISHLIST TABLE:
- Products currently in customer's wishlist: image, name, price, "View Product" link

RIGHT:
STATS CARD:
- Total Orders: [N]
- Completed Orders: [N]
- Total Spent: €[X]
- Average Order Value: €[X]
- Most Purchased Category: [category]

REVIEWS CARD:
- All reviews submitted by this customer
- Each review: product name, star rating, review text, approval status, date
- "Approve" / "Reject" buttons per review

NOTES CARD:
- Internal admin notes textarea about this customer (saved to User.adminNotes field)
- "Save Note" button
```

---

## ADMIN TASK A14 — Review Moderation

**Prompt for Replit AI:**

```
Build the review moderation page at /app/(admin)/admin/reviews/page.tsx.

FILTER BAR:
- Status filter: All | Pending Approval | Approved | Rejected
- Rating filter: All | 5★ | 4★ | 3★ | 2★ | 1★
- Product search: type to filter by product name
- Date range

TABLE COLUMNS:
- Product: thumbnail + name (link → product storefront page in new tab)
- Reviewer: name + email (or "Guest")
- Rating: star display (filled/empty stars, numeric e.g. "4.0 / 5.0")
- Sub-ratings: Value ★, Durability ★, Delivery ★ (compact, tooltip on hover)
- Review Text: first 100 chars, "Read more" expands inline
- Pros / Cons: truncated
- Status badge: PENDING (yellow), APPROVED (green), REJECTED (grey)
- Submitted date
- Actions:
  - "Approve" button (green) — PATCH status to approved, show on storefront
  - "Reject" button (grey) — PATCH status to rejected, hide from storefront
  - "Delete" button (red trash) — permanently delete

BULK ACTIONS (when rows selected):
- "Approve All Selected"
- "Reject All Selected"
- "Delete All Selected"

QUICK STATS above table:
- Pending: [N] (red badge) | Approved: [N] | Rejected: [N] | Average Rating: ★ [X.X]

REVIEW DETAIL MODAL (click anywhere on a row to open):
- Full review text, pros, cons
- All star ratings displayed
- Product link
- Customer link (if registered)
- Approve / Reject / Delete buttons
- "Reply" textarea (admin reply to review — saved as reviewReply field, shown on storefront below review)
```

---

## ADMIN TASK A15 — Homepage Banner Management

**Prompt for Replit AI:**

```
Build the banner management page at /app/(admin)/admin/banners/page.tsx.

Banners appear in the homepage hero slider (Task 4 of main tasks).

PAGE LAYOUT:

TOP: "Banners" heading + "Add Banner" button (blue)

BANNER LIST (drag-to-reorder using @dnd-kit/sortable):
- Each banner row shows:
  - Drag handle icon (left)
  - Small preview image (80×50px)
  - Title + subtitle (truncated)
  - Active toggle (inline toggle, PATCH on change)
  - Sort order number (auto-updates on drag)
  - "Edit" button → opens edit modal
  - "Delete" button → confirmation modal → DELETE /api/admin/banners/[id]

- Drag and drop to reorder (updates Banner.sortOrder for all items via PATCH /api/admin/banners/reorder with array of { id, sortOrder })

---

ADD / EDIT BANNER MODAL:
Fields:
- Title * — text input (shown as large heading on banner, e.g. "Office 2024 Professional Plus")
- Subtitle — text input (e.g. "AVAILABLE NOW!")
- Background Color — color picker (hex input with preview swatch)
- Product Image URL * — text input + live preview below (use Next.js Image for preview)
- Link URL — text input (where the banner navigates on click, e.g. /product/office-2024-pro)
- CTA Button Text — text input (optional, e.g. "Shop Now")
- CTA Button Color — color picker
- Active — toggle
- Sort Order — number input (auto-set to last position for new banners)

LIVE PREVIEW PANEL (inside the modal, below the form):
- Shows a scaled-down preview of how the banner will look, updating live as fields change
- Uses the same HTML/CSS structure as the homepage hero banner

SAVE: POST /api/admin/banners (new) or PATCH /api/admin/banners/[id] (edit)
```

---

## ADMIN TASK A16 — Static Page Content Editor

**Prompt for Replit AI:**

```
Build the static pages content editor at /app/(admin)/admin/pages/page.tsx and /app/(admin)/admin/pages/[slug]/edit/page.tsx.

Add to Prisma schema:
model Page {
  id, slug (unique), title, content (text — HTML), metaTitle, metaDescription,
  isEditable (boolean — some pages like /terms can be edited, system pages can't be deleted),
  updatedAt, createdAt
}

Seed initial pages: about-us, terms-and-conditions, privacy-policy, return-refund-policy, delivery-terms, payment-methods, faq, how-to-buy, reseller-application, contact.

LIST PAGE (/admin/pages):
- Table: Page Title, Slug (/[slug]), Last Updated, Actions (Edit, View on site)
- No delete for seeded system pages (show lock icon instead of delete)

EDIT PAGE (/admin/pages/[slug]/edit):

HEADER: Back button, page title "Editing: [Page Title]", "View on Site" button, "Save" button

FIELDS:
1. Page Title * — text input
2. Slug — read-only (shown greyed, cannot change system page slugs to avoid broken links)
3. Meta Title — text input (60 char limit, counter)
4. Meta Description — textarea (160 char limit, counter)
5. Content * — full rich text editor (TipTap):
   - Toolbar: Bold, Italic, Underline, Strikethrough
   - Headings: H1, H2, H3
   - Bullet list, Numbered list
   - Blockquote
   - Horizontal rule
   - Link (opens dialog for URL + "open in new tab" toggle)
   - Image (URL input)
   - Table (insert table with configurable rows/cols)
   - Undo / Redo
   - Clear formatting
   - "Source" toggle (switch between visual editor and raw HTML textarea)

FAQ SPECIAL CASE (/admin/pages/faq/edit):
- Instead of the rich text editor, show an "FAQ Items" manager:
  - List of { question, answer } pairs
  - Drag to reorder
  - "Add FAQ Item" button
  - Edit inline: question text input + answer rich text
  - Delete per item
  - Saves as structured JSON to Page.content

SAVE: PATCH /api/admin/pages/[slug] → returns 200, show toast "Page saved."
The frontend /[slug] route reads from this DB record (not hardcoded files).
```

---

## ADMIN TASK A17 — Settings: General

**Prompt for Replit AI:**

```
Build the Settings page at /app/(admin)/admin/settings/page.tsx with multiple tabs.

Implement Tab 1: General Settings.
(Other settings tabs are built in separate tasks A18–A22.)

Use shadcn/ui Tabs component for the tab structure. All tabs share the same /admin/settings page — active tab is controlled by a ?tab= query param.

TAB 1 — GENERAL:

FORM FIELDS (one form with a single "Save General Settings" button at the bottom):

Site Branding:
- Site Name * — text input (used in email subjects, footer, page titles)
- Site Logo URL — text input + live preview image (40px height)
  Note: "Paste a public image URL, e.g. https://yourdomain.com/logo.png"
- Favicon URL — text input + live preview (16×16px)

Contact:
- Support Email * — email input (shown in header "24/7 Support" and footer)
- From Email * — email input (used as sender for transactional emails)
- Support Phone — text input (optional, shown in footer)

Store Info:
- Company Name — text input (shown in footer "Company: [name]")
- Store Tagline — text input (short slogan, shown below logo in footer)
- Copyright Text — text input (defaults to "[SiteName] © [year] All Rights Reserved.")

Social Media Links (optional):
- Facebook URL — text input
- Twitter/X URL — text input
- Instagram URL — text input
- LinkedIn URL — text input
- YouTube URL — text input
These social icons appear in the footer if provided.

SAVE: PATCH /api/admin/settings/general — updates SiteSettings table fields.
Show toast "General settings saved." on success.
All saved values should reflect immediately across the site (use SWR/revalidatePath).
```

---

## ADMIN TASK A18 — Settings: API Keys

**Prompt for Replit AI:**

```
Build Tab 2 of /admin/settings: API Keys.

This tab manages the Metenzi and Checkout.com credentials.
ALL API keys are stored AES-256 encrypted in the SiteSettings table. They are NEVER returned in plain text to the frontend except when explicitly revealed by admin.

METENZI CREDENTIALS SECTION:

1. Metenzi API Key:
   - Masked input showing "••••••••••••••••[last4chars]" when saved
   - "Reveal" button → shows confirmation dialog → fetches decrypted value from POST /api/admin/settings/reveal (admin only, logs to AuditLog), displays in input for 60 seconds then re-masks
   - "Update" button opens an edit modal with: a plain text input for the new API key, a warning "Changing this key will affect all Metenzi API calls immediately", "Save New Key" button
   - Environment indicator badge: LIVE (green) if key starts with mtzi_live_, TEST (yellow) if mtzi_test_

2. Metenzi Signing Secret:
   - Same masked / reveal / update pattern as API key above

3. "Test Metenzi Connection" button:
   - Calls GET /api/admin/settings/test-metenzi (server-side: calls Metenzi GET /api/public/balance with stored key)
   - Success: green banner "✓ Connected — Balance: €[X]"
   - Failure: red banner "✗ Connection failed: [error message]"

CHECKOUT.COM CREDENTIALS SECTION:

4. Checkout.com Public Key:
   - Plain text input (public key, not sensitive — prefixed with pk_)
   - No masking needed

5. Checkout.com Secret Key:
   - Same masked / reveal / update pattern as Metenzi key
   - Prefixed with sk_ (live) or sk_test_ (sandbox)
   - Environment indicator: LIVE or TEST based on prefix

6. "Test Checkout.com Connection" button:
   - Calls GET /api/admin/settings/test-checkout
   - Success / failure banner

SECURITY NOTE (info card at bottom):
"Your API keys are encrypted at rest using AES-256. They are never logged or exposed in API responses. Key access is recorded in the Audit Log."

SAVE: PATCH /api/admin/settings/api-keys (each credential has its own save button to avoid accidentally overwriting)
```

---

## ADMIN TASK A19 — Settings: CPP & Fees

**Prompt for Replit AI:**

```
Build Tab 3 of /admin/settings: CPP & Fees.

This tab controls the Customer Protection Program and Card Processing Fee that appear at checkout.

CPP SECTION — "Customer Protection Program (CPP)":

1. Enable CPP toggle (SiteSettings.cppEnabled)
   - When OFF: CPP section is completely hidden on the checkout page
   - When ON: CPP option shown at checkout

2. CPP Label — text input
   - The heading shown at checkout, e.g. "ACME STORE CUSTOMER PROTECTION PROGRAM (CPP)"
   - Default: "[SiteName] CUSTOMER PROTECTION PROGRAM (CPP)"

3. CPP Price (€) — decimal number input (e.g. 1.00)
   - Shown as "(+€1.00)" in the checkout radio button label

4. CPP Default Selection — radio: "Opt-in by default (Add CPP pre-selected)" / "Opt-out by default (Do not add CPP pre-selected)"

5. CPP Description — textarea
   - Short text shown under the CPP section at checkout explaining what it covers
   - E.g. "Our CPP covers key replacement within 30 days if your key is defective."

6. CPP Benefits — multi-line text (one benefit per line, shown as bullet list in checkout)

LIVE PREVIEW (right panel, updates as you type):
- Shows how the CPP section will look in the checkout page, using the actual checkout CPP component rendered with the current form values

---

CARD PROCESSING FEE SECTION:

7. Enable Card Processing Fee toggle (if OFF, no fee is added)

8. Fee Label — text input (shown as the line item at checkout, e.g. "Card Processing Fee")

9. Fee Calculation Method — radio:
   - "Percentage only" → Fee = subtotal × percentage / 100
   - "Fixed only" → Fee = fixed amount
   - "Percentage + Fixed" → Fee = (subtotal × percentage / 100) + fixed amount

10. Fee Percentage — decimal input (e.g. 6.5 for 6.5%)

11. Fee Fixed Amount (€) — decimal input (e.g. 0.00)

CALCULATOR PREVIEW:
- Shows: "For a €50 order → Fee = €[calculated], Customer pays €[total]"
- Updates live as values change

SAVE: PATCH /api/admin/settings/cpp-fees
Show toast on success.
```

---

## ADMIN TASK A20 — Settings: Currency Management

**Prompt for Replit AI:**

```
Build Tab 4 of /admin/settings: Currencies.

This tab manages the currencies available in the store's currency switcher.

DEFAULT CURRENCY:
- Dropdown: select the store's base display currency (default: EUR)
- Note: "All prices from Metenzi are in EUR. Other currencies are display conversions only. Checkout always processes in EUR."

CURRENCY TABLE:
Display all currencies in the CurrencyRate table.

TABLE COLUMNS:
- Flag emoji + Currency Code (e.g. 🇪🇺 EUR)
- Currency Name (e.g. "Euro")
- Symbol (e.g. €)
- Exchange Rate (relative to EUR — editable inline number input)
  - If EUR: rate is always 1.00, locked
  - Others: editable
  - Rate input has 6 decimal places
  - Last Updated timestamp shown below the rate input
- Enabled toggle (show/hide in storefront currency switcher)
- Sort Order (number input, controls dropdown order)
- "Delete" (only for user-added currencies, not system defaults)

BUILT-IN CURRENCIES (pre-seeded, cannot be deleted):
EUR (€, 1.00), USD ($), GBP (£), PLN (zł), CZK (Kč), HUF (Ft)

ADD CURRENCY:
"+ Add Currency" button opens a modal:
- Currency Code * (e.g. SEK)
- Currency Name * (e.g. Swedish Krona)
- Symbol * (e.g. kr)
- Exchange Rate * (relative to EUR)
- Enabled toggle

BULK SAVE:
Instead of saving each row individually, show a "Save All Rates" button at the top right that saves all modified rates in one PATCH /api/admin/settings/currencies request.
Changed rows are highlighted with a yellow left border while unsaved.

AUTO-REFRESH NOTE:
Information card: "Exchange rates are updated manually. For automatic updates, consider integrating an exchange rate API (e.g. exchangerate-api.com) and adding a cron job to /api/admin/sync-rates."
```

---

## ADMIN TASK A21 — Settings: Email (SMTP)

**Prompt for Replit AI:**

```
Build Tab 5 of /admin/settings: Email (SMTP).

This tab configures the SMTP credentials used for sending transactional emails.

SMTP CONFIGURATION FORM:

1. SMTP Host * — text input (e.g. smtp.gmail.com, mail.yourdomain.com)
2. SMTP Port * — number input (common ports: 465, 587, 25) with helper "465 = SSL, 587 = TLS"
3. Encryption — dropdown: None | SSL/TLS | STARTTLS
4. SMTP Username * — text input
5. SMTP Password * — masked input with reveal toggle (stored encrypted in SiteSettings)
   - "Update Password" button opens modal with new password input + confirm
6. From Email * — email input (e.g. noreply@yourdomain.com)
7. From Name * — text input (e.g. "Dino's Software Store" — shown as the sender name in email clients)

QUICK CONFIG BUTTONS (below form):
Pre-fill the form for common providers:
- Gmail: smtp.gmail.com, port 587, STARTTLS
- Outlook/Hotmail: smtp-mail.outlook.com, port 587, STARTTLS
- Custom (clears fields)

---

TEST EMAIL SECTION:
- "Send Test Email" sub-section
- To: email input (pre-filled with admin's email)
- Subject: "Test Email from [SiteName]"
- "Send Test Email" button → POST /api/admin/settings/test-email
  - Server-side: creates Nodemailer transport with current settings, sends a test email
  - Success: green banner "✓ Test email sent to [email]. Check your inbox."
  - Failure: red banner "✗ Failed: [SMTP error message]"
  (Tests the connection before saving to avoid locking yourself out)

---

EMAIL QUEUE STATUS SECTION:
- Shows stats from the EmailQueue table:
  - Pending: [N] emails in queue
  - Sent in last 24h: [N]
  - Failed: [N] (with retry count)
- "Retry Failed Emails" button (triggers immediate retry of all failed emails with attempts < 3)
- "Clear Sent Emails" button (deletes sent/delivered queue items older than 30 days)
- Last queue run: [timestamp]

SAVE: PATCH /api/admin/settings/smtp
```

---

## ADMIN TASK A22 — Settings: Webhooks & Live Chat

**Prompt for Replit AI:**

```
Build Tab 6 (Webhooks) and Tab 7 (Live Chat) of /admin/settings.

---

TAB 6 — WEBHOOKS:

This tab manages the Metenzi webhook registration.

CURRENT WEBHOOK STATUS:
- Calls GET /api/public/webhooks from Metenzi (via server-side fetch using stored API key)
- If webhook is registered and verified: shows green "✓ Active" badge
  - URL: [webhook URL]
  - Events subscribed: [list of events as badges]
  - Verified: Yes / No
  - Created: [date]
- If no webhook registered: shows orange "⚠ Not Registered" badge

WEBHOOK URL (read-only info):
- Shows the expected webhook URL: "[NEXT_PUBLIC_SITE_URL]/api/webhooks/metenzi"
- Copy button

REGISTER WEBHOOK BUTTON:
- Shown only when no webhook is registered
- POST /api/admin/webhooks/register:
  - Calls Metenzi POST /api/public/webhooks with the above URL and events: ["order.fulfilled", "order.cancelled", "order.backorder", "claim.opened", "claim.resolved", "key.assigned"]
  - Saves the returned webhook secret (encrypted) to SiteSettings.metenziWebhookSecret
  - Returns webhook ID and verified status
- Loading spinner during registration
- Success: "✓ Webhook registered. Verification is automatic — Metenzi will send a challenge request."
- The webhook verification challenge is handled automatically by GET /api/webhooks/metenzi

DELETE WEBHOOK BUTTON:
- Shown when a webhook is registered
- Confirmation modal → DELETE /api/public/webhooks/[id] via Metenzi API + clear local record

SUBSCRIBED EVENTS checklist (informational, read-only):
- ✓ order.fulfilled — triggers license key delivery
- ✓ order.cancelled — triggers refund
- ✓ order.backorder — notifies customer
- ✓ claim.opened — logs to admin
- ✓ claim.resolved — notifies customer
- ✓ key.assigned — logs to system

---

TAB 7 — LIVE CHAT:

1. Enable Live Chat toggle (SiteSettings.liveChat)
   - When OFF: no chat widget on storefront
   - When ON: inject the embed code on all storefront pages

2. Chat Provider — informational dropdown (cosmetic, for admin notes):
   - Tawk.to, Crisp, Tidio, Intercom, Custom
   - No functional difference — just labels the embed code

3. Embed Code * — large textarea
   - Paste the full JavaScript embed snippet from your chat provider
   - e.g. Tawk.to <!-- Start of Tawk.to Live Chat Script --> ... <!-- End of Tawk.to Live Chat Script -->
   - Warning banner: "Only paste embed code from trusted providers. This script will run on every page of your store."

4. Chat Button Position — dropdown: Bottom Right | Bottom Left

5. "Preview on Store" note: "Save and visit your storefront to see the chat widget."

SAVE: PATCH /api/admin/settings/live-chat
```

---

## ADMIN TASK A23 — Audit Log

**Prompt for Replit AI:**

```
Build the audit log page at /app/(admin)/admin/audit-log/page.tsx.

The AuditLog table records all significant admin actions and system events.

Add/update Prisma schema model AuditLog:
{ id, userId (nullable — null for system events), userEmail (snapshot), action (string),
  target (string — e.g. "Order #1042", "Product: Windows 11 Pro"),
  details (JSON — any extra data), ipAddress, userAgent, createdAt }

EVENTS TO LOG (throughout the application):
Admin actions:
- admin.login — Admin logged in
- admin.product.status_changed — "Set Windows 11 Pro to inactive"
- admin.product.edited — "Updated description for [product]"
- admin.order.status_changed — "Marked Order #1042 as Completed"
- admin.order.email_resent — "Resent confirmation email for Order #1042"
- admin.key.revealed — "Revealed full key code for key_[id] (Order #1042)"
- admin.key.copied — "Copied key code for key_[id]"
- admin.discount.created — "Created discount code SUMMER25"
- admin.discount.deleted — "Deleted discount code SUMMER25"
- admin.review.approved — "Approved review for [product] by [user]"
- admin.review.rejected — "Rejected review for [product] by [user]"
- admin.settings.api_key_updated — "Updated Metenzi API key"
- admin.settings.smtp_updated — "Updated SMTP settings"
- admin.webhook.registered — "Registered Metenzi webhook"
- admin.customer.role_changed — "Promoted [email] to ADMIN"
System events:
- system.products.synced — "Synced 247 products from Metenzi"
- system.order.fulfilled — "Order #1042 fulfilled by Metenzi"
- system.order.cancelled — "Order #1042 cancelled by Metenzi"
- system.email.sent — "Sent order confirmation to [email]"
- system.email.failed — "Failed to send email to [email]: [error]"

LOG PAGE:

FILTER BAR:
- Search: by action, target, or user email
- Action category filter: All | Admin Actions | System Events | Auth Events | Settings Changes | Key Access
- User filter: dropdown of all admins + "System"
- Date range filter

TABLE COLUMNS:
- Icon (based on action category — shield for auth, settings gear, key icon, etc.)
- Action (human-readable, e.g. "Revealed key code")
- Target (e.g. "Order #1042")
- Details (expandable — click row to see full JSON details in a side drawer)
- User (admin email or "System")
- IP Address
- Timestamp (full datetime)

SIDE DRAWER (on row click):
- Full action details
- Request details (IP, User Agent)
- JSON details viewer (formatted, collapsible)

PAGINATION: 50 per page, newest first.
Export CSV button (exports current filter results).
Auto-purge: log entries older than 90 days are auto-deleted by a nightly cron job.
```

---

## ADMIN TASK A24 — Metenzi Balance & Account Info

**Prompt for Replit AI:**

```
Build the Metenzi balance page at /app/(admin)/admin/balance/page.tsx.

This page shows live account information from the Metenzi API.

All data on this page is fetched server-side on load from the Metenzi API using the stored credentials.

HEADER:
- Page title: "Metenzi Account"
- "Refresh" button (re-fetches all data without full page reload, using SWR revalidation)
- Environment badge: LIVE (green) or SANDBOX (yellow) based on API key prefix

BALANCE CARD (prominent, top of page):
- Large: "Current Balance" heading
- €[balance] in large blue text (from GET /api/public/balance?formatted=true)
- Currency: EUR
- Last Updated: [timestamp]
- Note card: "Your balance is used to fulfill orders. If balance is insufficient, orders will be cancelled automatically."

API KEY INFO CARD:
- Key Prefix (first 12 chars of the key, e.g. mtzi_live_xxxx)
- Environment: Live / Sandbox
- Scopes: list of all scopes granted (from SiteSettings, informational — fetched from the key rotation response if available)
- "Rotate API Key" button → opens confirmation modal:
  - Warning: "This will invalidate your current key after a 24-hour grace period. You will need to save the new key immediately."
  - "Proceed with Rotation" button → POST /api/admin/settings/rotate-metenzi-key
    - Calls Metenzi POST /api/public/keys/rotate
    - New key and signing secret are shown ONCE in a modal (large monospace text, copy buttons)
    - Admin must confirm "I have saved the new key" checkbox before the modal closes
    - Automatically saves new encrypted credentials to SiteSettings

RECENT ORDERS FROM METENZI CARD:
- Last 5 orders from Metenzi API (GET /api/public/orders?limit=5)
- Table: Metenzi Order ID, Number, Status, Total, Created
- "View All Metenzi Orders" link → new tab to metenzi.com dashboard (if available)

OPEN CLAIMS CARD:
- Fetches GET /api/public/claims?status=open from Metenzi
- Shows count and list: claim ID, key, reason, submitted date
- "View All Claims" link → /admin/claims

REGISTERED WEBHOOKS CARD:
- List from GET /api/public/webhooks
- Shows URL, events, verified status
- Link to Webhook settings tab (/admin/settings?tab=webhooks)

If Metenzi API is unreachable: show a full-page error card "Could not connect to Metenzi API. Check your API key in Settings → API Keys." with a "Check Settings" button.
```

---

## ADMIN TASK A25 — Checkout Upsell Product Manager

**Prompt for Replit AI:**

```
Build the checkout upsell product configuration at /app/(admin)/admin/upsell/page.tsx.
Link it in the admin sidebar under SALES as "Checkout Upsell".

This controls the "Product offer" box that appears on the right side of the checkout page, showing customers a recommended product they can add to their order.

PAGE LAYOUT:

CURRENT UPSELL CARD:
- Shows whether an upsell product is currently configured
- If configured: shows product image, name, price, urgency message, current status (enabled/disabled)
- "Disable Upsell" button (removes the upsell from checkout without deleting the config)
- "Edit" button → opens the edit form below

UPSELL CONFIGURATION FORM:

1. Enable Checkout Upsell — master toggle
   - When OFF: no product offer box shown on checkout

2. Select Upsell Product * — searchable product dropdown
   - Type to search products by name or SKU
   - Shows: product thumbnail + name + retail price
   - Only one product can be the upsell at a time

3. Display Price — two options via radio:
   - "Use product's retail price"
   - "Custom display price" → number input (€, shown with strikethrough over original price for urgency)

4. Original/Strikethrough Price (optional) — number input (€)
   - Shown with strikethrough to suggest it's on special offer
   - E.g. show €19.90 struck through, with "€18.91" as the offer price

5. Urgency Message * — text input
   - Shown in a highlighted box below the product
   - E.g. "WE ARE THE FIRST IN EUROPE TO OFFER OFFICE 2024 PROFESSIONAL PLUS! PRICE IS VALID ONLY FOR THE FIRST 500 CUSTOMERS!"

6. Checkbox Label — text input (default: "Get this exclusive offer now!")

7. Position — dropdown: "Right column, below payment info" (only option for now, but extensible)

LIVE PREVIEW CARD (right side):
- Renders a miniature preview of the checkout's right-column Product Offer box using the current form values
- Updates live as values change
- Shows the red border, blue header, product image, name, price, urgency text, and checkbox

SAVE: PATCH /api/admin/upsell → updates SiteSettings with the upsell config (add fields: upsellEnabled, upsellProductId, upsellCustomPrice, upsellOriginalPrice, upsellUrgencyMessage, upsellCheckboxLabel)

History: show the last 3 previously used upsell products as "quick switch" buttons.
```

---

## Summary: Admin Portal Task Map

| Task | Page | Description |
|------|------|-------------|
| A1 | Layout | Sidebar, top bar, mobile drawer, route protection middleware |
| A2 | /admin | Dashboard: KPI cards, recent orders, low stock, pending reviews |
| A3 | /admin/analytics | Revenue & orders charts, top products, category breakdown |
| A4 | /admin/products | Product list with search, filter, bulk actions, sync button |
| A5 | /admin/products/[id]/edit | Full product editor: content, SEO, cross-sells, upsell toggle |
| A6 | /admin/categories | Category display names, slugs, nav visibility, sort order |
| A7 | /admin/orders | Order list with filters, status badges, export CSV |
| A8 | /admin/orders/[id] | Order detail: keys, payment, timeline, Metenzi status, notes |
| A9 | /admin/keys | License key list, reveal with audit log, claim submission |
| A10 | /admin/claims | Claims list, Metenzi status sync, submit claim modal |
| A11 | /admin/discounts | Discount code list, inline toggle, usage progress bars |
| A12 | /admin/discounts/new + edit | Discount code form with live preview calculator |
| A13 | /admin/customers | Customer list + detail: orders, wishlist, reviews, notes |
| A14 | /admin/reviews | Review moderation: approve, reject, admin reply |
| A15 | /admin/banners | Homepage banner drag-to-reorder, live preview modal |
| A16 | /admin/pages | Static page WYSIWYG editor, FAQ item manager |
| A17 | /admin/settings (Tab 1) | General: site name, logo, contact info, social links |
| A18 | /admin/settings (Tab 2) | API Keys: Metenzi + Checkout.com masked reveal + test |
| A19 | /admin/settings (Tab 3) | CPP config + Card Processing Fee with live calculator |
| A20 | /admin/settings (Tab 4) | Currency rates table, add currency, bulk save |
| A21 | /admin/settings (Tab 5) | SMTP config, test email, email queue status |
| A22 | /admin/settings (Tabs 6–7) | Webhooks: register/delete + Live Chat embed code |
| A23 | /admin/audit-log | Full audit trail with filters, side drawer, CSV export |
| A24 | /admin/balance | Metenzi live balance, key rotation, claims, webhook status |
| A25 | /admin/upsell | Checkout upsell product config with live preview |

*25 admin-specific tasks, each self-contained and ready to paste into Replit AI.*
