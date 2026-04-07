# Admin Portal — Missing Tasks (A26–A35)

> These 10 tasks complete the admin portal alongside A1–A25.
> **Stack:** TypeScript · Next.js 14 App Router · Prisma · Tailwind CSS · shadcn/ui

---

## ADMIN TASK A26 — Discount Codes: Advanced Features

**What A11/A12 missed:** Bulk code generation, usage reporting, product/category restrictions, and per-customer single-use codes.

**Prompt for Replit AI:**

```
Extend the discount code system at /admin/discounts with three advanced sub-pages.

---

SUB-PAGE 1: Bulk Code Generator at /admin/discounts/bulk-generate

Add a "Bulk Generate" button on the /admin/discounts list page → navigates here.

FORM:
1. Code Prefix — text input (e.g. "PROMO" → generates PROMO-A3X9, PROMO-BK72, etc.)
2. Code Length — number input (total code length including prefix, default 12)
3. Quantity * — number input (how many unique codes to generate, max 1000)
4. Discount Type * — Percentage / Fixed Amount (same as regular discount form)
5. Discount Value * — number input
6. Minimum Order Amount — optional number input
7. Max Uses Per Code — number input (default: 1 — each code is single-use)
8. Expiry Date — date picker (optional)
9. Status — Active / Inactive (default: Active)
10. Internal Label — text input (e.g. "Black Friday 2025 campaign — batch 1", stored in DiscountCode.description)

PREVIEW: "Will generate 50 unique codes like: PROMO-A3X9BC, PROMO-BK72XD..."

GENERATE button:
- POST /api/admin/discounts/bulk-generate
- Server generates N cryptographically random unique codes (using crypto.randomBytes)
- Inserts all into DiscountCode table in a single Prisma createMany
- Returns { generated: N, failed: 0 }

RESULT PAGE (shown after generation):
- Success banner: "50 discount codes generated"
- Table showing all generated codes (code, value, expiry)
- "Download as CSV" button (downloads all generated codes as .csv with columns: Code, Type, Value, Expiry)
- "Back to Discount Codes" button

---

SUB-PAGE 2: Usage Report at /admin/discounts/[id]/report

Accessible from the DiscountCode list via a "Usage Report" icon button.

HEADER:
- Code name + type + value
- Created date, expiry, max uses

STATS ROW:
- Total Uses: [usedCount] / [maxUses or ∞]
- Usage Rate: [usedCount / maxUses]% as a progress bar
- Total Discount Given: €[sum of all discountAmount on orders using this code]
- Revenue from Orders Using Code: €[sum of totalAmount on those orders]
- Average Order Value with Code: €[average]

ORDERS TABLE (all orders that used this code):
- Order #, Customer email, Order Total, Discount Applied (€), Date
- Link to each order → /admin/orders/[id]
- "Export CSV" button

CHART: Daily usage over time (bar chart — how many orders per day used this code)

---

SUB-PAGE 3: Product/Category Restrictions
Add these fields to the existing DiscountCode create/edit form (Task A12):

APPLICABILITY SECTION (add below the existing form fields):
1. Applies To — radio buttons:
   - "All products" (default)
   - "Specific categories" → multi-select checkbox list of categories
   - "Specific products" → searchable multi-select of products (same search UI as cross-sells in A5)

2. Exclude Sale Items — toggle
   (If ON, code cannot be applied when cart contains products that already have isOnSale = true)

3. Single Use Per Customer — toggle
   (If ON, a logged-in customer can only use this code once. Checked against Order table by userId + discountCodeId.
   For guests: checked by email against guestEmail + discountCodeId.)

Update Prisma schema:
model DiscountCode {
  ... existing fields ...
  appliesToCategories  String[]   (array of category names, empty = all)
  appliesToProductIds  String[]   (array of product IDs, empty = all)
  excludeSaleItems     Boolean    @default(false)
  singleUsePerCustomer Boolean    @default(false)
}

Update the coupon validation API (/api/cart/coupon) to enforce these restrictions:
- If appliesToCategories is non-empty: check that at least one cart item belongs to those categories
- If appliesToProductIds is non-empty: check that at least one cart item is in that list
- If excludeSaleItems: reject if any cart item has isOnSale = true
- If singleUsePerCustomer: check Order table for prior use by this user/email
```

---

## ADMIN TASK A27 — Homepage Brand Partner Sections Manager

**What was missing:** The homepage has brand partner sections (Ashampoo, Kaspersky, ESET, Bitdefender, Norton, McAfee). Each has a branded left panel and a product carousel on the right. None of this was admin-configurable.

**Prompt for Replit AI:**

```
Build the brand partner sections manager at /app/(admin)/admin/brands/page.tsx.
Add "Brands" to the admin sidebar under CATALOGUE.

Brand sections appear on the homepage as two-column rows:
LEFT: Branded marketing banner (logo, product image, marketing text, color scheme)
RIGHT: "On Sale" label + horizontal product carousel (5 products visible, prev/next arrows)

Add to Prisma schema:
model BrandSection {
  id, name (e.g. "Kaspersky"), slug (unique),
  bannerImageUrl, bannerBackgroundColor,
  bannerTitle, bannerDescription,
  marketingPoints  String[]   (bullet points shown on banner, e.g. "Identity", "Privacy", "Performance", "Security")
  productIds       String[]   (ordered list of product IDs to show in the carousel — admin-selected)
  sortOrder, isActive, createdAt, updatedAt
}

---

LIST PAGE (/admin/brands):

HEADER: "Brand Sections" + "Add Brand" button

BRAND LIST (drag-to-reorder, using @dnd-kit/sortable):
- Each row: drag handle, brand name, banner preview thumbnail (40×40px), product count badge, active toggle, sort order, Edit button, Delete button (with confirmation)
- Reorder updates BrandSection.sortOrder for all items

---

ADD / EDIT BRAND MODAL (opens on "Add Brand" or "Edit"):

LEFT COLUMN — Banner Config:
1. Brand Name * — text input (e.g. "Kaspersky")
2. Slug * — text input (auto-generated, e.g. "kaspersky")
3. Banner Image URL * — text input + preview (the product stack / brand image shown on the left panel)
4. Banner Background Color * — color picker (hex, with preview swatch). The left panel background uses this color.
5. Banner Title — text input (optional large text on the banner, e.g. "New Kaspersky")
6. Banner Description — textarea (short text shown on banner)
7. Marketing Feature Points — repeatable text inputs (add/remove rows):
   - Each point becomes a bullet on the banner (e.g. "Identity ✓", "Privacy ✓", "Performance ✓", "Security ✓")
   - Up to 6 points

RIGHT COLUMN — Products in Carousel:
8. Select Products for Carousel — searchable multi-select:
   - Type to search products by name or SKU
   - Drag to reorder selected products (controls carousel order)
   - Show: product thumbnail + name + price for each selected item
   - Recommended: 5–10 products (more = more carousel pages)
   - Selected products shown as draggable chips with × remove

9. Carousel "On Sale" Label — text input (default: "On Sale") — label shown above the carousel

LIVE PREVIEW (below the form):
- Shows a mini-preview of how the brand section will render on the homepage
- Left panel: colored background, image, title, description, marketing points
- Right panel: first 3 product cards in a row with the "On Sale" label
- Updates live as form changes

SAVE: POST /api/admin/brands (new) or PATCH /api/admin/brands/[id] (edit)

On the homepage (storefront), the BrandSection data is fetched server-side and rendered in sortOrder, only showing isActive = true sections.
```

---

## ADMIN TASK A28 — Homepage Section Manager

**What was missing:** No way to control which sections appear on the homepage, in what order, or with which heading/category they display.

**Prompt for Replit AI:**

```
Build the homepage section manager at /app/(admin)/admin/homepage/page.tsx.
Add "Homepage" to the admin sidebar under CONTENT.

The homepage is made up of multiple named sections stacked vertically. This page lets the admin control each section.

Add to Prisma schema:
model HomepageSection {
  id,
  type  String  (HERO_SLIDER | CATEGORY_ROW | BRAND_SECTIONS | NEW_ADDITIONS | PRODUCT_SPOTLIGHT | FEATURED_TEXT_BANNER)
  label String  (admin-facing name, e.g. "Office 2024 products")
  heading String  (customer-facing heading shown on storefront)
  isActive Boolean @default(true)
  sortOrder Int
  config  Json   (type-specific config, see below)
  updatedAt, createdAt
}

---

PAGE LAYOUT:

HEADER: "Homepage Sections" + hint text "Drag sections to reorder how they appear on your homepage"

SECTION LIST (drag-to-reorder using @dnd-kit/sortable):
Each section row shows:
- Drag handle
- Section type icon (slider icon, grid icon, tag icon, etc.)
- Admin label (e.g. "Office 2024 Products", "Windows OS Row", "Kaspersky Brand Section")
- Type badge (e.g. CATEGORY_ROW, HERO_SLIDER)
- Active toggle (inline, PATCH without reload)
- "Edit" button → opens edit modal for that section
- Sort order number (updates on drag)

---

EDIT MODAL — fields vary by section type:

TYPE: HERO_SLIDER
- No extra config (managed in /admin/banners)
- Shows: "Slides are managed in Banner Management →" with a link

TYPE: CATEGORY_ROW
- Heading * — text input (shown above the product grid)
- Category Filter * — dropdown of all categories (products from this category are fetched)
- Max Products — number input (how many to show, default 6)
- Sort Products By — dropdown: Newest First | Lowest Price | Highest Rated | Manual Order
- If Manual Order: drag-to-reorder product picker (same multi-select + reorder UI as brand sections)

TYPE: BRAND_SECTIONS
- No extra config (managed in /admin/brands)
- Shows: "Brand sections are managed in Brand Management →" with a link

TYPE: NEW_ADDITIONS
- Heading * — text input (default: "New Additions")
- Max Products — number input (default 6)
- Time Window — dropdown: Last 7 days | Last 30 days | Last 90 days | All time (sorted by createdAt desc)

TYPE: PRODUCT_SPOTLIGHT (the Norton-style large feature block)
- Heading * — text input
- Description * — textarea
- Left Image URL * — text input + preview
- Variant Tabs — repeatable inputs: Tab Label + Product ID (search). Shows "View Details" button per tab.
- CTA Button Text — text input

TYPE: FEATURED_TEXT_BANNER (simple colored promotional banner)
- Text * — text input
- Background Color — color picker
- Link URL — text input
- Button Text — text input

SAVE: PATCH /api/admin/homepage/[id]
Reorder: PATCH /api/admin/homepage/reorder with array of { id, sortOrder }

---

DEFAULT SECTIONS (seeded on first run, in order):
1. HERO_SLIDER — "Hero Banner"
2. CATEGORY_ROW — "Office 2024 Products" (category: Office 2024)
3. CATEGORY_ROW — "Windows OS" (category: Windows)
4. CATEGORY_ROW — "Office 2021" (category: Office 2021)
5. CATEGORY_ROW — "Office For MAC" (category: Office For MAC)
6. CATEGORY_ROW — "Windows Servers" (category: Windows Servers)
7. BRAND_SECTIONS — "Brand Partner Sections"
8. NEW_ADDITIONS — "New Additions"
9. PRODUCT_SPOTLIGHT — "Norton Products"

On the homepage (storefront), fetch all HomepageSection records where isActive=true, ordered by sortOrder, and render the appropriate component for each type.
```

---

## ADMIN TASK A29 — Email Template Editor

**What was missing:** Task A21 only covered SMTP credentials. The admin had no way to edit the content, layout, or variables in transactional emails.

**Prompt for Replit AI:**

```
Build the email template editor at /app/(admin)/admin/email-templates/page.tsx.
Add "Email Templates" to the admin sidebar under CONTENT.

Add to Prisma schema:
model EmailTemplate {
  id,
  key  String  @unique  (e.g. "order_confirmation", "key_delivery", "welcome", "password_reset", "order_cancelled", "claim_resolved")
  name String  (human-readable, e.g. "Order Confirmation")
  subject * String  (email subject line, supports variables like {{orderNumber}}, {{customerName}})
  bodyHtml  String  (full HTML email body)
  isActive  Boolean  @default(true)
  updatedAt, createdAt
}

Seed with 6 default templates (one per key above) using sensible default HTML.

---

LIST PAGE (/admin/email-templates):

Table:
- Template Name
- Subject line (truncated)
- Key (grey monospace badge)
- Last Updated
- Active toggle (inactive = email type is not sent)
- "Edit" button → /admin/email-templates/[key]/edit
- "Send Test" button → opens test send modal

---

EDIT PAGE (/admin/email-templates/[key]/edit):

HEADER: Back button + template name + "Send Test Email" button + "Save" button

TWO COLUMN LAYOUT:

LEFT COLUMN — Editor:

1. Template Name — read-only display (label only, key is the identifier)

2. Subject Line * — text input
   - Supports template variables listed in the VARIABLES REFERENCE below
   - e.g. "Order Confirmation #{{orderNumber}} — Thank you, {{customerName}}!"

3. Email Body — rich HTML editor (TipTap or CodeMirror for HTML mode):
   Two modes (toggle button):
   - VISUAL mode: TipTap editor with toolbar (bold, italic, headings, lists, links, images, dividers, button blocks)
   - HTML SOURCE mode: raw HTML textarea (for advanced customization)
   Both modes stay in sync.

4. VARIABLES REFERENCE panel (below editor — collapsible):
   Shows all available template variables for the current template type:

   All templates:
     {{siteName}}, {{siteUrl}}, {{supportEmail}}, {{logoUrl}}

   Order-related templates (order_confirmation, key_delivery, order_cancelled):
     {{orderNumber}}, {{orderDate}}, {{customerName}}, {{customerEmail}},
     {{customerPhone}}, {{billingAddress}}, {{orderItemsTable}},
     {{subtotal}}, {{discount}}, {{cppFee}}, {{cardFee}}, {{total}},
     {{discountCode}}

   Key delivery template (key_delivery):
     {{licenseKeysSection}} (renders a styled box for each key code)

   Welcome template:
     {{loginUrl}}

   Password reset template:
     {{resetLink}}, {{resetLinkExpiry}}

   Claim resolved template:
     {{claimId}}, {{claimReason}}, {{resolutionNotes}}, {{keyCode}}

   Clicking any variable copies it to clipboard with a brief toast.

RIGHT COLUMN — Live Preview:

5. PREVIEW PANEL:
   - "Preview With Sample Data" toggle (replaces all {{variables}} with realistic sample values)
   - Rendered iframe preview of the email at real email width (600px)
   - Updates live as the body HTML changes (debounced 500ms)
   - "Preview on Desktop" / "Preview on Mobile (375px)" toggle to check responsive rendering

---

TEST SEND MODAL:
- To: email input (pre-filled with admin email)
- "Send Test" button → POST /api/admin/email-templates/[key]/test
  - Server renders the template with sample data, sends via current SMTP config
  - Success: "Test email sent to [address]"
  - Failure: shows SMTP error

SAVE: PATCH /api/admin/email-templates/[key]
Show toast "Email template saved."
All transactional emails throughout the app (Task 13) must load their subject + bodyHtml from the EmailTemplate table instead of hardcoded strings.
```

---

## ADMIN TASK A30 — Tax / VAT Settings

**What was missing:** The Metenzi API returns `taxRate` and `taxAmount` on orders, but there was no admin control over tax configuration.

**Prompt for Replit AI:**

```
Build the tax/VAT settings page at /app/(admin)/admin/settings with a new tab "Tab 8: Tax / VAT".
Also add tax calculation logic throughout the checkout flow.

TAB 8 — TAX / VAT:

MASTER TAX TOGGLE:
1. Enable Tax / VAT — master toggle (SiteSettings.taxEnabled)
   - When OFF: no tax applied to any order, no tax lines shown at checkout
   - When ON: tax rules below are applied

TAX DISPLAY:
2. Price Display — radio:
   - "Show prices inclusive of tax" (e.g. €19.90 incl. VAT)
   - "Show prices exclusive of tax (add tax at checkout)" (e.g. €16.55 + €3.35 VAT = €19.90)

3. Tax Label — text input (e.g. "VAT", "Sales Tax", "GST")
   Shown on checkout as "VAT (20%): €3.35"

DEFAULT TAX RATE:
4. Default Tax Rate (%) — number input (e.g. 20 for 20% EU VAT)
   Applied when no country-specific rate matches.

COUNTRY-SPECIFIC RATES TABLE:
5. "Country Tax Rates" table:
   - One row per country
   - Columns: Country (dropdown), Tax Rate (%), Tax Label override (optional), Is Active toggle
   - "+ Add Country Rate" button
   - "× Remove" button per row
   - Pre-seeded with common EU countries and standard VAT rates:
     Austria 20%, Belgium 21%, Croatia 25%, Cyprus 19%, Czech Republic 21%,
     Denmark 25%, Estonia 22%, Finland 25.5%, France 20%, Germany 19%,
     Greece 24%, Hungary 27%, Ireland 23%, Italy 22%, Latvia 21%, Lithuania 21%,
     Luxembourg 17%, Malta 18%, Netherlands 21%, Poland 23%, Portugal 23%,
     Romania 19%, Slovakia 20%, Slovenia 22%, Spain 21%, Sweden 25%

TAX IDENTIFICATION:
6. Merchant VAT Number — text input (shown on order invoices/receipts)
7. Show VAT Number on Invoices — toggle

B2B TAX EXEMPTION:
8. Enable B2B Tax Exemption — toggle
   When ON: customers who provide a valid VAT number at checkout are exempt from tax (reverse charge mechanism).
9. Require VAT Number Validation — toggle
   When ON: validate the provided VAT number format (regex check for EU VAT format, e.g. DE123456789).
   Add a "VAT Number" field to the checkout billing form (optional, shown only when B2B exemption is enabled).

---

CHECKOUT INTEGRATION:
Update the order summary at checkout (/app/(shop)/checkout-page) to:
- Detect customer's country from the billing form Country/Region field
- Look up the tax rate for that country from the TaxRate table (or use default)
- If prices are exclusive: add a "VAT ([rate]%): €[amount]" line item to the order total
- If prices are inclusive: show "Incl. VAT ([rate]%): €[amount]" as an informational line (not added, just displayed)
- Pass the tax amount and rate to the Order record (Order.taxRate, Order.taxAmount)
- Pass the same to the Metenzi order (items price should be the pre-tax B2B price)

Add to Prisma Order model:
  taxRate     Decimal?
  taxAmount   Decimal?
  vatNumber   String?    (customer's VAT number, if provided)

SAVE: PATCH /api/admin/settings/tax
```

---

## ADMIN TASK A31 — Admin User Management

**What was missing:** Only one hardcoded admin exists. No way to add/remove admin accounts or manage permissions.

**Prompt for Replit AI:**

```
Build the admin user management page at /app/(admin)/admin/admin-users/page.tsx.
Add "Admin Users" to the admin sidebar under SYSTEM.

Only SUPER_ADMIN role can access this page (add SUPER_ADMIN to the User role enum alongside CUSTOMER and ADMIN).
The first admin created (seeded) is automatically SUPER_ADMIN. Subsequent admins are ADMIN role.

Update Prisma User model:
  role  UserRole  @default(CUSTOMER)

Update UserRole enum:
  enum UserRole { CUSTOMER, ADMIN, SUPER_ADMIN }

Add AdminPermission model:
model AdminPermission {
  id, userId (FK to User, unique),
  canManageProducts  Boolean @default(true)
  canManageOrders    Boolean @default(true)
  canManageCustomers Boolean @default(true)
  canManageDiscounts Boolean @default(true)
  canManageContent   Boolean @default(true)  (banners, pages, email templates)
  canViewAnalytics   Boolean @default(true)
  canManageSettings  Boolean @default(false)  (API keys, SMTP, etc. — restricted by default)
  canManageAdmins    Boolean @default(false)  (only SUPER_ADMIN can do this)
  canViewAuditLog    Boolean @default(true)
  createdAt, updatedAt
}

---

LIST PAGE (/admin/admin-users):

HEADER: "Admin Users" + "Invite Admin" button (SUPER_ADMIN only)

TABLE COLUMNS:
- Avatar initials + Name + Email
- Role badge: SUPER_ADMIN (gold crown), ADMIN (blue shield)
- Permissions summary: small icons for each permission area (green checkmark or grey dash)
- Last Login date
- Created date
- Actions (SUPER_ADMIN only):
  - Edit Permissions (pencil) → opens permissions modal
  - Revoke Admin Access (red trash) — confirmation modal:
    "This will demote [name] to a regular customer. They will lose all admin access immediately."
    → PATCH User.role to CUSTOMER, delete AdminPermission record

---

INVITE ADMIN MODAL:
1. Email * — email input
   - If email matches an existing user: shows "Existing user: [name]. They will be promoted to Admin."
   - If no match: "A new admin account will be created. An invitation email will be sent."
2. First Name * (only shown if no existing user)
3. Last Name * (only shown if no existing user)
4. Permissions checkboxes: same as AdminPermission model fields, with labels:
   - ✅ Manage Products
   - ✅ Manage Orders
   - ✅ Manage Customers
   - ✅ Manage Discounts
   - ✅ Manage Content (Banners, Pages, Email Templates)
   - ✅ View Analytics
   - ☐ Manage Settings (API keys, SMTP, CPP, Fees — OFF by default)
   - ☐ Manage Admin Users (OFF by default — only SUPER_ADMIN)

INVITE FLOW:
- If existing user: immediately promote to ADMIN, create AdminPermission record, send "You've been granted admin access" email
- If new user: generate a secure invite token (stored in DB), send invitation email with a link to /admin/accept-invite/[token]

ACCEPT INVITE PAGE (/admin/accept-invite/[token]):
- Token validation (expires in 7 days)
- Set password form (if new user) + Name fields
- On submit: create User with ADMIN role + AdminPermission record, log in, redirect to /admin

PERMISSION ENFORCEMENT:
In the admin middleware and on each admin page, check the relevant AdminPermission flag.
If a permission is false: show a "403 — You don't have permission to access this page" message with a link back to dashboard.
Example: if canManageSettings = false, /admin/settings redirect to /admin with toast "Access denied: Settings management requires elevated permissions."
```

---

## ADMIN TASK A32 — Refunds Management

**What was missing:** Task A8 has a per-order refund button but no consolidated refunds view or refund status tracking.

**Prompt for Replit AI:**

```
Build the refunds management page at /app/(admin)/admin/refunds/page.tsx.
Add "Refunds" to the admin sidebar under SALES.

Add to Prisma schema:
model Refund {
  id,
  orderId    String  (FK to Order)
  amount     Decimal
  currency   String  @default("EUR")
  reason     String  (e.g. "customer_request", "defective_key", "order_cancelled", "duplicate_order", "other")
  notes      String?
  status     RefundStatus  @default(PENDING)
  checkoutPaymentId  String  (Checkout.com payment ID to refund against)
  checkoutRefundId   String?  (returned by Checkout.com on success)
  processedBy  String  (admin user email who initiated it)
  processedAt  DateTime?
  createdAt    DateTime  @default(now())
}

enum RefundStatus { PENDING, PROCESSING, COMPLETED, FAILED }

---

LIST PAGE (/admin/refunds):

HEADER: "Refunds" + "Total Refunded This Month: €[X]" stat chip

FILTER BAR:
- Status filter: All | Pending | Processing | Completed | Failed
- Date range
- Search by Order # or customer email

TABLE COLUMNS:
- Order # (link → /admin/orders/[id])
- Customer email
- Refund Amount (€, red text)
- Reason badge (color-coded)
- Status badge: PENDING (yellow), PROCESSING (blue spinner), COMPLETED (green), FAILED (red)
- Initiated By (admin email)
- Created date | Processed date
- Checkout Refund ID (monospace, shown when completed)
- Actions:
  - "Retry" button (shown for FAILED status) → re-attempts the Checkout.com refund API call
  - "View Order" link

---

INITIATE REFUND FLOW (triggered from Order Detail page — A8):
When admin clicks "Issue Refund" on /admin/orders/[id]:

REFUND MODAL:
1. Order and payment summary:
   - Order #, Total charged: €[X], Already refunded: €[Y] (if partial refunds exist)
   - Available to refund: €[X - Y]
2. Refund Amount * — number input (pre-filled with full refundable amount, editable for partial)
3. Reason * — dropdown:
   - Customer Request
   - Defective Key
   - Order Cancelled
   - Duplicate Order
   - Other
4. Notes — textarea (internal, not shown to customer)
5. "Notify customer by email" toggle (default ON — sends refund confirmation email)
6. "Confirm Refund" button (blue)

ON SUBMIT:
- Create Refund record in DB with status PENDING
- Call Checkout.com Refund API: POST https://api.checkout.com/payments/[checkoutPaymentId]/refunds
  with { amount: amountInCents, reference: refundId }
- If Checkout.com returns 202 Accepted: update Refund.status to PROCESSING, store checkoutRefundId
- If Checkout.com returns error: update Refund.status to FAILED, show error message
- Checkout.com sends a webhook when refund is settled — update to COMPLETED (handle in /api/webhooks/checkout)
- Update Order.status to REFUNDED if full amount is refunded
- If "notify customer" toggle was ON: send refund confirmation email from EmailTemplate key "refund_confirmation"
  Add this template to the email template system (Task A29)

PARTIAL REFUND SUPPORT:
- Multiple refunds against one order are allowed as long as cumulative total ≤ original charge
- Track total refunded on Order model: Order.totalRefunded (sum of completed Refund.amount for this order)
- Show "Partially Refunded" badge on order if 0 < totalRefunded < totalAmount
```

---

## ADMIN TASK A33 — Reseller Applications

**What was missing:** The storefront has a /reseller-application page with a contact form, but there was no admin side to review, approve, or reject applications.

**Prompt for Replit AI:**

```
Build the reseller application management system.

Add to Prisma schema:
model ResellerApplication {
  id,
  companyName   String
  contactName   String
  email         String
  phone         String?
  website       String?
  message       String
  estimatedMonthlyVolume  String?  (e.g. "100-500 orders/month")
  status        ResellerStatus  @default(PENDING)
  adminNotes    String?
  reviewedBy    String?   (admin email)
  reviewedAt    DateTime?
  approvedAt    DateTime?
  rejectedAt    DateTime?
  userId        String?   (FK to User — set when approved and account created)
  createdAt     DateTime  @default(now())
}

enum ResellerStatus { PENDING, UNDER_REVIEW, APPROVED, REJECTED }

Also add to User model:
  isReseller       Boolean  @default(false)
  resellerDiscount Decimal? (% discount on all products for this reseller, e.g. 15.00)

---

LIST PAGE at /app/(admin)/admin/resellers/page.tsx:
Add "Resellers" to admin sidebar under CUSTOMERS.

TABS at top: "Applications" tab | "Active Resellers" tab

---

APPLICATIONS TAB:

FILTER BAR:
- Status filter: All | Pending | Under Review | Approved | Rejected
- Date range

TABLE COLUMNS:
- Company Name + Contact Name below
- Email (clickable → mailto)
- Phone, Website
- Message (truncated, expand on click)
- Estimated Volume
- Status badge
- Applied date
- Actions:
  - "Review" button (blue) → opens Review modal
  - "View Details" → opens full application side drawer

REVIEW MODAL (opens on "Review"):
- Full application details (all fields)
- Admin Notes textarea (internal)
- Status change buttons:
  - "Mark Under Review" → status = UNDER_REVIEW
  - "Approve" (green) → opens Approve sub-form
  - "Reject" (red) → opens Reject sub-form

APPROVE SUB-FORM:
- "Create Account?" toggle (default ON)
  If ON: a User account is created (or linked if email already exists) with isReseller = true
- Reseller Discount (%) — number input (e.g. 15)
  This % is applied to all orders from this user's account at checkout
- Welcome message to include in email — textarea
- "Confirm Approval" button:
  → Update ResellerApplication.status = APPROVED, set reviewedBy + approvedAt
  → If creating account: create User (CUSTOMER role, isReseller = true, resellerDiscount = X%)
    send welcome email from EmailTemplate "reseller_welcome" (add this template to A29)
  → Send approval notification email to the applicant

REJECT SUB-FORM:
- Reason for rejection — dropdown: Not enough volume | Unable to verify business | Duplicate application | Other
- Rejection message to send applicant — textarea (pre-filled with a polite default)
- "Confirm Rejection" button:
  → Update status = REJECTED, set reviewedBy + rejectedAt
  → Send rejection email to applicant using the typed message

---

ACTIVE RESELLERS TAB:

Table of all Users where isReseller = true:
- Name, Email, Reseller Discount %, Total Orders, Total Revenue, Member Since
- "Edit Discount" button (opens modal to change their discount %)
- "Revoke Reseller Status" button (sets isReseller = false, sends notification email)

---

STOREFRONT INTEGRATION:
Update the checkout flow: if session.user.isReseller = true:
- Apply their resellerDiscount % automatically to the order total (shown as a "Reseller Discount" line)
- This discount stacks with or replaces regular discount codes (admin-configurable in the Approve sub-form: "Allow stacking with discount codes" toggle)
```

---

## ADMIN TASK A34 — Admin Notification Preferences

**What was missing:** No way for the admin to configure which email alerts they receive and at what thresholds.

**Prompt for Replit AI:**

```
Build the admin notification preferences page as Tab 9 of /admin/settings: "Notifications".

Add to Prisma schema:
model AdminNotificationPrefs {
  id  Int  @id @default(1)  (single-row table)

  -- Order Alerts
  notifyNewOrder          Boolean  @default(true)
  notifyNewOrderEmails    String[] (list of email addresses to notify, defaults to admin email)
  notifyOrderCancelled    Boolean  @default(true)
  notifyOrderRefunded     Boolean  @default(true)

  -- Stock Alerts
  notifyLowStock          Boolean  @default(true)
  lowStockThreshold       Int      @default(5)  (alert when stock drops below this number)
  notifyOutOfStock        Boolean  @default(true)

  -- Customer Alerts
  notifyNewCustomer       Boolean  @default(false)
  notifyNewResellerApp    Boolean  @default(true)

  -- Review Alerts
  notifyNewReview         Boolean  @default(true)

  -- Claim Alerts
  notifyNewClaim          Boolean  @default(true)
  notifyClaimResolved     Boolean  @default(false)

  -- Payment Alerts
  notifyFailedPayment     Boolean  @default(true)
  notifyRefundProcessed   Boolean  @default(true)

  -- System Alerts
  notifyLowMetenziBalance Boolean  @default(true)
  lowBalanceThreshold     Decimal  @default(100.00)  (alert when Metenzi balance drops below €X)
  notifySyncError         Boolean  @default(true)

  -- Digest
  dailyDigestEnabled      Boolean  @default(false)
  dailyDigestTime         String   @default("09:00")  (HH:MM, local server time)
  dailyDigestEmails       String[]
}

---

TAB 9 — NOTIFICATIONS FORM:

SECTION: Notification Recipients
- "Additional notification email addresses" — tag input (type email + Enter to add, × to remove)
- Note: "The primary admin email ([admin.email]) always receives notifications regardless of this list."

SECTION: Order Notifications (toggle + email list per notification type, but email list only shown once — shared from global list above)
- ✅ New order placed — "Notify when a customer places a new order"
- ✅ Order cancelled — "Notify when an order is cancelled"
- ✅ Order refunded — "Notify when a refund is processed"

SECTION: Stock Notifications
- ✅ Low stock alert
  - When enabled: show "Alert when stock drops below: [N] units" number input
- ✅ Out of stock — "Notify when a product goes out of stock (stock = 0)"

SECTION: Customer Notifications
- ☐ New customer registered (OFF by default — can be noisy)
- ✅ New reseller application submitted

SECTION: Review Notifications
- ✅ New review submitted (pending approval)

SECTION: Claim Notifications
- ✅ New claim submitted — "Notify when a customer submits a license key claim"
- ☐ Claim resolved by Metenzi (OFF by default)

SECTION: Payment Notifications
- ✅ Payment failed — "Notify when a payment attempt fails at checkout"
- ✅ Refund processed — "Notify when Checkout.com confirms a refund"

SECTION: System Notifications
- ✅ Low Metenzi balance — "Alert when your Metenzi account balance drops below:"
  When enabled: show "Alert threshold: €[X]" number input (default 100)
- ✅ Product sync error — "Notify if the Metenzi product sync fails"

SECTION: Daily Digest Email
- ☐ Send a daily summary email
  When enabled:
  - Send time — time picker (HH:MM, 15-min increments)
  - Send to — email tag input (separate from immediate notifications)
  Digest content: orders today, revenue today, new customers, pending reviews, low stock products, Metenzi balance

---

SAVE: PATCH /api/admin/settings/notifications

IMPLEMENTATION:
Throughout the application, after each relevant event, check AdminNotificationPrefs and send notification emails if the flag is true. Use the existing email queue system (Task 13) for delivery.

For the daily digest: add a cron job at /lib/cron/daily-digest.ts that runs at the configured time and sends a structured summary email using the "daily_digest" EmailTemplate (add this template to Task A29's seed data).
```

---

## ADMIN TASK A35 — Maintenance Mode, SEO & Tracking Settings

**What was missing:** No maintenance mode toggle, no global SEO defaults, no Google Analytics/GTM integration managed from admin.

**Prompt for Replit AI:**

```
Build Tab 10 of /admin/settings: "SEO & Tracking", and add Maintenance Mode as a standalone feature.

---

ADD TO SiteSettings model:
  -- Maintenance
  maintenanceMode     Boolean   @default(false)
  maintenanceMessage  String    @default("We'll be back soon. Maintenance in progress.")
  maintenanceEstimate String?   (e.g. "Back online at 3:00 PM UTC")
  maintenanceBypassIps String[] (admin IPs that bypass maintenance and see the real site)

  -- SEO
  defaultMetaTitleSuffix  String  @default("| {siteName}")  (appended to all page titles)
  defaultMetaDescription  String
  defaultOgImage          String  (URL of fallback social share image)
  robotsTxt               String  (full content of robots.txt)
  googleVerificationCode  String? (for Google Search Console verification meta tag)

  -- Tracking
  googleAnalyticsId  String?  (UA-XXXXX or G-XXXXXX)
  googleTagManagerId String?  (GTM-XXXXXX)
  facebookPixelId    String?
  customHeadScripts  String?  (arbitrary scripts injected into <head> of all pages)
  customBodyScripts  String?  (injected just before </body>)

---

TAB 10 — SEO & TRACKING:

SECTION: Default SEO

1. Page Title Format — text input
   "How page titles are formatted: {pageTitle} | {siteName}"
   Template tokens: {pageTitle}, {siteName}, {category}
   Live preview: "Microsoft Windows 11 Pro | Acme Store"

2. Default Meta Description — textarea (160 chars, shown when page has no specific description)

3. Default Social Share Image URL — text input + 200×100px preview
   "Used as the og:image on pages without a specific product image"

4. Google Search Console Verification Code — text input
   "Paste the content attribute value from Google's meta verification tag"
   e.g. "abc123def456" (from <meta name="google-site-verification" content="abc123def456"/>)

SECTION: Robots.txt

5. Robots.txt Content — monospace textarea (full content)
   Default content:
   ```
   User-agent: *
   Allow: /
   Disallow: /admin/
   Disallow: /api/
   Sitemap: {siteUrl}/sitemap.xml
   ```
   "Saved robots.txt is served at /robots.txt"

6. "View current robots.txt" button — opens /robots.txt in new tab
7. "Regenerate Sitemap" button → POST /api/admin/sitemap/regenerate
   Shows "Sitemap regenerated — [N] URLs" toast. Sitemap served at /sitemap.xml.

SECTION: Analytics & Tracking

8. Google Analytics 4 ID — text input (e.g. G-XXXXXXXXXX)
   When provided: inject the GA4 script in <head> via Next.js Script component on all pages
   Note: "Uses 'afterInteractive' loading strategy to avoid blocking page render"

9. Google Tag Manager ID — text input (e.g. GTM-XXXXXXX)
   When provided: inject GTM <head> + <body> snippets on all pages

10. Facebook Pixel ID — text input (e.g. 123456789012345)
    When provided: inject Meta Pixel script on all pages
    Also fires Purchase event on order complete page with { value, currency, content_ids }

11. Custom <head> Scripts — code textarea (HTML/JS)
    "Injected verbatim into <head> on all storefront pages. Use for custom tracking scripts."
    Warning banner: "Only add scripts from trusted sources."

12. Custom <body> Scripts — code textarea
    "Injected before </body> on all storefront pages."

---

MAINTENANCE MODE (separate card, prominently placed at the TOP of the Settings page before the tabs):

MAINTENANCE MODE CARD:
- Large red toggle: "Maintenance Mode" — ON/OFF
- When toggled ON: show a confirmation dialog:
  "Enabling maintenance mode will show a maintenance page to ALL visitors immediately.
  Only IPs on the bypass list can access the real site. Are you sure?"
  Confirm → enable + save

When maintenance mode is active:
- Card background turns red/orange
- Shows "⚠ MAINTENANCE MODE ACTIVE — Your store is offline to visitors"
- "Disable Now" button (prominent)

Maintenance Message — text input (shown to visitors)
Estimated Back Online — text input (e.g. "3:00 PM UTC", shown to visitors)
Bypass IP Addresses — tag input (add your own IP so you can still access the site)
  "Your current IP: [detected from request headers]" — "Add my IP" button

IMPLEMENTATION:
In Next.js middleware (/middleware.ts):
- On every request to the storefront (not /admin/*, not /api/webhooks/*, not bypass IPs):
  - Check SiteSettings.maintenanceMode (cached in memory, refreshed every 30 seconds)
  - If true AND request IP not in maintenanceBypassIps: rewrite to /maintenance page
- /maintenance page: full-screen styled page showing the maintenance message, estimate, and the site logo

SAVE: PATCH /api/admin/settings/seo-tracking
Separate save button for maintenance mode (PATCH /api/admin/settings/maintenance) for safety.
```

---

## ADMIN TASK A36 — Automatic Discounts & Promotions Engine

**What A11/A12/A26 missed:** All existing discount tasks only cover *coupon codes* (customer must enter a code). Missing entirely: automatic discounts that apply with no code required, rule-based promotions, and Buy X Get Y deals.

**Prompt for Replit AI:**

```
Build an Automatic Discounts system at /admin/discounts/automatic (new tab/section inside /admin/discounts).

---

PRISMA SCHEMA — Add:

model AutomaticDiscount {
  id            Int      @id @default(autoincrement())
  name          String   (internal admin label, e.g. "Summer Spend & Save")
  displayLabel  String   (shown to customer in cart/checkout, e.g. "Summer Promo Applied!")
  isActive      Boolean  @default(false)
  priority      Int      @default(0)  (higher = applied first; only one auto-discount applies per order by default)
  stackable     Boolean  @default(false)  (allow stacking with coupon codes and other auto discounts)

  -- Trigger conditions (ALL must be met)
  triggerType         TriggerType   (CART_TOTAL | QUANTITY | FIRST_ORDER | CUSTOMER_TAG | PRODUCT_IN_CART)
  minCartTotal        Decimal?      (applies if cart subtotal >= this value; used when triggerType = CART_TOTAL)
  minQuantity         Int?          (total item count threshold; used when triggerType = QUANTITY)
  requiredProductIds  Int[]         (at least one of these must be in cart; used when triggerType = PRODUCT_IN_CART)
  firstOrderOnly      Boolean       @default(false)  (only for brand-new customers with 0 previous orders)
  customerTag         String?       (e.g. "vip", checked against User.tags field)

  -- Discount reward
  discountType    DiscountType    (PERCENTAGE | FIXED_AMOUNT | FREE_SHIPPING | BUY_X_GET_Y)
  discountValue   Decimal?        (percentage or fixed amount; null for BUY_X_GET_Y and FREE_SHIPPING)

  -- Buy X Get Y config (used when discountType = BUY_X_GET_Y)
  buyQuantity     Int?    (e.g. 2 — "buy 2")
  getQuantity     Int?    (e.g. 1 — "get 1")
  getProductIds   Int[]   (which products qualify as the "get" products; empty = any product)
  getDiscount     Decimal @default(100)  (% off the "get" items — 100 = free, 50 = half price)

  -- Scheduling
  startsAt    DateTime?
  endsAt      DateTime?

  -- Tracking
  usageCount  Int       @default(0)
  maxUses     Int?      (null = unlimited)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}

enum TriggerType { CART_TOTAL QUANTITY FIRST_ORDER CUSTOMER_TAG PRODUCT_IN_CART }

---

LIST PAGE at /admin/discounts/automatic:

Add a tab "Automatic Discounts" next to "Coupon Codes" on the /admin/discounts page.

TABLE:
- Name | Trigger Summary | Reward Summary | Status (Active/Inactive toggle) | Start–End dates | Uses | Actions (Edit, Delete)
- Trigger Summary: auto-generated readable text, e.g. "Cart ≥ €100", "Buy 2 + Get 1 Free", "First Order"
- Reward Summary: e.g. "10% off entire order", "Free shipping", "Get 1 item free"
- "Add Automatic Discount" button (top right)

---

CREATE / EDIT FORM at /admin/discounts/automatic/new and /admin/discounts/automatic/[id]/edit:

SECTION 1 — BASICS:
- Internal Name * — text input
- Display Label * — text input (shown at checkout, e.g. "🎉 10% off your first order!")
- Active toggle
- Priority — number input (tooltip: "If multiple auto-discounts apply, higher priority wins unless both are stackable")
- Allow stacking with coupon codes — checkbox
- Allow stacking with other auto-discounts — checkbox

SECTION 2 — TRIGGER CONDITIONS:
Trigger Type — segmented control / radio:
  A) Cart Total Threshold
     - Minimum cart subtotal — number input (€)
  B) Quantity Threshold
     - Minimum total items in cart — number input
  C) First Order (new customers only)
     - No extra fields; checks if customer has 0 previous orders
  D) Product in Cart
     - Required Products — multi-select from product list
     - "Discount applies if ANY of these are in the cart"
  E) Customer Tag
     - Tag name — text input

Additional conditions (shown regardless of trigger type, all optional):
- Applies to products — "All products" / select specific products (multi-select)
- Applies to categories — "All categories" / select specific categories

SECTION 3 — DISCOUNT REWARD:
Discount Type — tabs/radio:
  A) Percentage Off
     - Percentage * — number input
     - Applied to — "Entire order" / "Qualifying products only"
  B) Fixed Amount Off
     - Amount * — €number input
     - Applied to — "Entire order" / "Qualifying products only"
  C) Free Shipping
     - No extra fields
  D) Buy X Get Y
     - Customer must buy — number input (X) — "of these products" — multi-select product picker (leave empty = any products)
     - Customer gets — number input (Y) — "of these products" — multi-select product picker (leave empty = cheapest items auto-selected)
     - Discount on "get" items — number input % (default 100 = free)
     - Example preview: "Buy 2 Windows 11 Pro → Get 1 Office 365 free"

SECTION 4 — SCHEDULING:
- Start Date (optional) — date-time picker
- End Date (optional) — date-time picker
- Maximum total uses — number input (optional; leave blank = unlimited)

LIVE PREVIEW CALCULATOR (right column):
Shows a simulated cart and calculates what the discount would be:
- Sample cart total — editable €amount input
- Sample item count — number input
- Customer type — "New customer" / "Existing customer" toggle
- Output: "This discount WOULD apply" / "This discount would NOT apply — [reason]"
- If applies: "Customer saves: €X.XX (Y%)"

SAVE: POST/PATCH /api/admin/automatic-discounts
GET /api/admin/automatic-discounts for list

---

STOREFRONT INTEGRATION:
In the cart and checkout calculation function (/lib/pricing.ts or similar):

1. After calculating subtotal, fetch all active AutomaticDiscounts where:
   - isActive = true
   - (startsAt is null OR startsAt <= now) AND (endsAt is null OR endsAt >= now)
   - (maxUses is null OR usageCount < maxUses)

2. For each AutomaticDiscount, evaluate trigger:
   - CART_TOTAL: subtotal >= minCartTotal
   - QUANTITY: total item count >= minQuantity
   - FIRST_ORDER: user has 0 previous completed orders
   - PRODUCT_IN_CART: at least one requiredProductId is in cart
   - CUSTOMER_TAG: user.tags includes customerTag

3. Sort qualifying discounts by priority DESC

4. Apply the highest-priority qualifying discount (or all if stackable = true)

5. For BUY_X_GET_Y:
   - Count qualifying "buy" items in cart
   - For every complete set of buyQuantity items, identify getQuantity cheapest "get" items
   - Apply getDiscount% to those items

6. Display in cart:
   - Show applied automatic discount label (displayLabel) as a green tag
   - Show savings amount as a line item: "Summer Promo: −€X.XX"

7. On order completion: increment AutomaticDiscount.usageCount

IMPORTANT: Automatic discounts apply BEFORE coupon codes in the calculation order. Show both as separate line items at checkout.
```

---

## ADMIN TASK A37 — Discount Code Import (CSV Upload)

**What was missing:** Admins may have codes generated by external systems (e.g. partner campaigns, gift card platforms). There's currently no way to import a batch of existing codes into the system — only the bulk generator in A26 (which creates random codes).

**Prompt for Replit AI:**

```
Add a "Import Codes (CSV)" feature to the /admin/discounts page alongside the existing "Add New" and "Bulk Generate" buttons.

---

IMPORT BUTTON & FLOW:

"Import CSV" button on /admin/discounts → opens an Import Modal.

IMPORT MODAL — Step 1: Upload & Configure

UPLOAD AREA:
- Drag-and-drop or click-to-browse file input for .csv files
- "Download sample CSV template" link (downloads sample.csv with correct column headers)

CSV FORMAT:
Required columns:
  code       — the discount code string (e.g. "PARTNER-XYZ9")
Optional columns (if omitted, the defaults below are used):
  type       — "percentage" or "fixed" (default: "percentage")
  value      — numeric discount amount (default: from the form below)
  minOrder   — minimum order amount (default: from the form below)
  maxUses    — max uses per code (default: from the form below)
  expiry     — YYYY-MM-DD expiry date (default: from the form below)
  status     — "active" or "inactive" (default: "active")

DEFAULT VALUES FORM (applies to all rows that don't specify their own value):
- Discount Type — Percentage / Fixed Amount
- Default Discount Value — number input
- Default Minimum Order Amount — number input (optional)
- Default Max Uses Per Code — number input (default: 1)
- Default Expiry Date — date picker (optional)
- Default Status — Active / Inactive

IMPORT MODAL — Step 2: Preview & Validation (after file selected)

VALIDATION PREVIEW TABLE:
After parsing the CSV, show a preview table with first 10 rows:
- Code | Type | Value | Min Order | Max Uses | Expiry | Status | Valid? (green tick / red X)

VALIDATION RULES:
- Code must be 3–50 chars, alphanumeric + hyphens only
- Code must not already exist in the DiscountCode table (duplicate check)
- Value must be a positive number
- Type must be "percentage" or "fixed"
- If percentage: value must be 1–100
- Expiry (if provided) must be a future date

SUMMARY BAR above the table:
- "✓ 45 valid codes ready to import"
- "✗ 5 rows have errors — they will be skipped (or fix the CSV and re-upload)"
- Toggle: "Skip errors and import valid rows" (default ON) / "Abort if any errors found"

IMPORT MODAL — Step 3: Confirm & Import

"Import [N] Codes" button → POST /api/admin/discounts/import (multipart/form-data with CSV + config JSON)

Server-side:
- Re-validates all rows
- Runs Prisma createMany for all valid rows (skipDuplicates: true as safety net)
- Returns { imported: N, skipped: M, errors: [...] }

RESULT:
- Success banner: "47 discount codes imported successfully. 3 rows were skipped due to errors."
- "Download error report" link if any rows failed (downloads a CSV with failed rows + reason column)
- "View All Discount Codes" button → navigates to /admin/discounts
- "Import Another File" button

---

AUDIT LOG:
Log a single event on import completion:
  type: "DISCOUNT_CODES_IMPORTED"
  details: { filename, imported: N, skipped: M, adminId }
```

---

## Updated Complete Admin Portal Task Map (A1–A37)

| Task | Page | Description |
|------|------|-------------|
| A1 | Layout | Sidebar, top bar, mobile drawer, route protection |
| A2 | /admin | Dashboard: KPIs, recent orders, low stock, pending reviews |
| A3 | /admin/analytics | Revenue & order charts, top products, category breakdown |
| A4 | /admin/products | Product list: search, filter, bulk actions, Metenzi sync |
| A5 | /admin/products/[id]/edit | Product editor: content, SEO, cross-sells, upsell, image |
| A6 | /admin/categories | Category display names, slugs, nav visibility, sort |
| A7 | /admin/orders | Order list: filters, CSV export, status badges |
| A8 | /admin/orders/[id] | Order detail: keys, payment, Metenzi status, timeline |
| A9 | /admin/keys | License keys: reveal with audit log, claim submission |
| A10 | /admin/claims | Claims list, Metenzi sync, submit claim modal |
| A11 | /admin/discounts (Coupon Codes tab) | Coupon code list: inline toggle, usage progress bars |
| A12 | /admin/discounts/new + edit | Coupon code form with live preview calculator |
| **A26** | /admin/discounts/bulk-generate | **Bulk code generation + usage report + product restrictions** |
| **A36** | /admin/discounts (Automatic tab) | **Automatic discounts: rule-based, Buy X Get Y, free shipping** |
| **A37** | /admin/discounts (Import modal) | **CSV import of external discount codes with validation** |
| A13 | /admin/customers | Customer list + detail: orders, wishlist, reviews, notes |
| A14 | /admin/reviews | Review moderation: approve, reject, admin reply |
| A15 | /admin/banners | Homepage banner drag-to-reorder, live preview modal |
| **A27** | /admin/brands | **Brand partner sections: banner + product carousel per brand** |
| **A28** | /admin/homepage | **Homepage section order manager: reorder/show/hide all sections** |
| A16 | /admin/pages | Static page WYSIWYG editor, FAQ item manager |
| **A29** | /admin/email-templates | **Email template editor: subject, body, variables, live preview** |
| A17 | /admin/settings Tab 1 | General: site name, logo, contact info, social links |
| A18 | /admin/settings Tab 2 | API Keys: Metenzi + Checkout.com with masked reveal + test |
| A19 | /admin/settings Tab 3 | CPP config + card fee with live calculator |
| A20 | /admin/settings Tab 4 | Currency rates table, add currency, bulk save |
| A21 | /admin/settings Tab 5 | SMTP config, test email, email queue status |
| A22 | /admin/settings Tabs 6–7 | Webhooks registration + live chat embed code |
| **A30** | /admin/settings Tab 8 | **Tax/VAT: country rates, B2B exemption, checkout integration** |
| **A34** | /admin/settings Tab 9 | **Notification preferences: per-event toggles + daily digest** |
| **A35** | /admin/settings Tab 10 | **SEO defaults, robots.txt, GA4/GTM/Pixel, maintenance mode** |
| A23 | /admin/audit-log | Full audit trail with 20+ event types, CSV export |
| A24 | /admin/balance | Metenzi live balance, key rotation, open claims |
| A25 | /admin/upsell | Checkout upsell product config with live preview |
| **A31** | /admin/admin-users | **Multi-admin management: invite, permissions, revoke** |
| **A32** | /admin/refunds | **Refunds list, initiate/retry refunds, Checkout.com sync** |
| **A33** | /admin/resellers | **Reseller applications: review, approve/reject, active resellers** |

**Total admin tasks: 37 (A1–A37)**
**Added in this revision: A36 (Automatic Discounts & Promotions Engine), A37 (Discount Code CSV Import)**

### Complete Discount Coverage Summary
| Feature | Task |
|---------|------|
| Coupon code list & management | A11 |
| Coupon code create/edit with live preview | A12 |
| Bulk code generator (random, up to 1000) | A26 |
| Per-code usage report & analytics | A26 |
| Product/category restrictions on codes | A26 |
| Automatic discounts (no code, rule-based) | **A36** |
| Buy X Get Y promotions | **A36** |
| Free shipping discount type | **A36** |
| First-order automatic discount | **A36** |
| Discount priority & stacking rules | **A36** |
| CSV import of external codes | **A37** |
| Import validation & error report | **A37** |

---

## ADMIN TASK A38 — Gift Cards Admin (/admin/gift-cards)

**Covers the admin management side of storefront Task S1.**

**Prompt for Replit AI:**

```
Build the Gift Cards admin page at /admin/gift-cards.

Add to admin sidebar under SALES section: "Gift Cards → /admin/gift-cards"

LIST PAGE:
Table columns: Code (masked — show first 4 + last 4 chars, e.g. GIFT-****-****-CD45) | Face Value | Remaining Balance | Recipient Email | Purchased By (customer name/email or "Admin") | Created | Expiry | Status (Active / Used Up / Expired / Deactivated)

FILTERS: All / Active / Used Up / Expired / Deactivated | Date range | Search by code or recipient email

ACTIONS per row:
- "View" → opens Gift Card Detail modal:
  * Full unmasked code
  * All fields (originalValue, balance, currency, recipientEmail, recipientName, senderName, personalMessage, orderId, expiresAt)
  * Redemption history table: Order # | Amount Used | Date
  * "Deactivate" button (sets isActive=false); "Reactivate" if already inactive
- "Resend Email" → re-sends the gift_card_delivery email to recipientEmail

MANUAL CREATE button ("+ Create Gift Card"):
Form fields: Face Value *, Currency (default EUR), Recipient Email *, Recipient Name, Sender Name, Personal Message, Expiry Date (optional), Send delivery email now toggle (default ON)
→ POST /api/admin/gift-cards → creates GiftCard record; if toggle ON, sends gift_card_delivery email
→ Useful for customer compensation, contest prizes, manual issue

STATS BAR (top of page):
- Total Active Cards | Total Value Outstanding (sum of balance on all active cards) | Total Redeemed This Month (sum of GiftCardRedemption.amountUsed this month) | Cards Created This Month

AUDIT LOG: log "GIFT_CARD_CREATED" and "GIFT_CARD_DEACTIVATED" events.
```

---

## ADMIN TASK A39 — Affiliate Program Admin (/admin/affiliates)

**Covers the admin management side of storefront Task S2.**

**Prompt for Replit AI:**

```
Build the Affiliate Program admin pages at /admin/affiliates.

Add to admin sidebar under CUSTOMERS section: "Affiliates → /admin/affiliates"

TWO TABS:

TAB 1 — APPLICATIONS:
- Shows AffiliateProfiles with status = PENDING, sorted by newest first
- Table: Name | Email | Applied | Website/Social | Promotion Plan (truncated) | Actions
- "Review" button → opens Review Modal:
  * All application details
  * Admin Notes textarea
  * "Approve" button → opens Approve sub-form:
    - Commission Rate (%) — number input (pre-filled with default from settings)
    - Custom referral code (optional; auto-generates from username if blank)
    - Internal notes
    - "Confirm Approval" → sets status=ACTIVE, approvedAt=now(), sends "affiliate_approved" email with dashboard link
  * "Reject" button → rejection reason dropdown + custom message → sends "affiliate_rejected" email
- Badge count on tab showing number of pending applications

TAB 2 — ACTIVE AFFILIATES:
- Table: Name | Referral Code | Commission Rate | Total Clicks | Conversions | Conv. Rate % | Total Earned | Pending Balance | Status (Active/Suspended) | Actions
- "View" → Affiliate Detail page /admin/affiliates/[id]:
  * Stats cards: Clicks | Conversions | Total Earned | Paid Out | Pending Balance
  * Chart: daily clicks + conversions over last 30 days (Recharts line chart)
  * Commission history table: Order # | Date | Order Amount | Rate | Earned | Status | Paid?
  * Payout Requests section: list of pending payout requests; "Mark as Paid" button per request (sets commissions to PAID, zeroes pendingBalance for those commissions, records payment)
  * Edit Commission Rate button (inline edit)
  * "Suspend" / "Reactivate" button
- CSV Export button (all affiliates: name, code, earned, paid, balance)

ADMIN SETTINGS (extend A17 — General or new sub-section):
- Affiliate Program toggle (enable/disable)
- Default commission rate (%)
- Minimum payout threshold (€)
- Commission hold period (days)
- Auto-approval toggle (skip manual review)

AUDIT LOG: log "AFFILIATE_APPROVED", "AFFILIATE_REJECTED", "AFFILIATE_PAYOUT_MARKED", "AFFILIATE_SUSPENDED".
```

---

## ADMIN TASK A40 — Abandoned Cart Admin

**Covers the admin management side of storefront Task S3.**

**Prompt for Replit AI:**

```
Build the Abandoned Cart management section within /admin/analytics (add as a new tab "Abandoned Carts") or as a standalone page at /admin/abandoned-carts.

Add to admin sidebar under SALES: "Abandoned Carts → /admin/abandoned-carts"

STATS ROW (top):
- Total Abandoned This Month | Total Recovered This Month | Recovery Rate % | Revenue Recovered (€)
- Comparison to last month (↑/↓ delta)

TABLE:
Columns: Email | Customer (link if registered user) | Cart Value | Items (count) | Abandoned At | Status (Pending / Email 1 Sent / Email 2 Sent / Email 3 Sent / Recovered / Unsubscribed) | Emails Sent count | Recovered?
Filter: All / Pending / Recovered / Unsubscribed | Date range | Min cart value

ROW ACTIONS:
- "View Cart" → modal showing cart snapshot (product thumbnails, names, quantities, prices, total)
- "Email Log" → modal showing which emails were sent and when
- "Send Next Email Now" button (manually trigger the next email in the sequence regardless of time delay — useful for testing or priority follow-up)
- "Mark Recovered Manually" button (closes the sequence if customer purchased via other means)
- "Unsubscribe" button (stops further emails for this cart)

SETTINGS (extend A34/A35 or add to relevant settings tab):
Abandoned Cart Recovery section:
- Enable/Disable toggle
- Email 1 delay — hours (default 1)
- Email 2 delay — hours after Email 1 (default 23)
- Email 3 delay — hours after Email 2 (default 48)
- Email 3 discount % (default 10)
- Minimum cart value to trigger recovery (€, default 0)

AUDIT LOG: log "ABANDONED_CART_EMAIL_SENT", "ABANDONED_CART_RECOVERED".
```

---

## ADMIN TASK A41 — Product Alerts Admin

**Covers the admin management side of storefront Task S4.**

**Prompt for Replit AI:**

```
Build product alert management within the existing admin products area and a dedicated alerts overview.

PRODUCT LIST PAGE (extend Task A4 — /admin/products):
- Add two new columns to the product table:
  * "📬 Waiting" — count of subscribers with type=BACK_IN_STOCK and notifiedAt=null for this product; shown as a clickable badge
  * "🔔 Price Alerts" — count of PRICE_DROP subscribers; clickable badge
- Clicking either badge opens an Alert Subscribers Modal:
  * Table: Email | Alert Type | Subscribed On | Price at Subscription | Current Price | Notified?
  * "Send Notification Now" button (top of modal) → manually trigger the back-in-stock OR price-drop email for this product to ALL pending subscribers
  * "Export Emails" button (downloads CSV of subscriber emails for this product + type)
  * "Remove" button per subscriber (deletes the ProductAlert record)

GLOBAL ALERTS PAGE at /admin/alerts:
Add to admin sidebar under CUSTOMERS: "Product Alerts → /admin/alerts"

STATS ROW: Total Active Subscriptions | Back-in-Stock Subscribers | Price Drop Subscribers | Notifications Sent This Month

TABLE:
Columns: Product | Alert Type | Subscribers | Avg Price at Sub | Current Price | Last Notification Sent | Actions
Filter: All / Back-in-Stock / Price Drop | Products with 0 subscribers / >10 subscribers
Click row → same subscriber modal as above

NOTIFICATION LOG tab:
- Table of all alert emails sent: Product | Type | Subscriber Email | Sent At | Price Before | Price After

SETTINGS (in Admin Settings): alert system enable toggle.
```

---

## ADMIN TASK A42 — Product Q&A Admin (/admin/qa)

**Covers the admin management side of storefront Task S5.**

**Prompt for Replit AI:**

```
Build the Product Q&A moderation page at /admin/qa.

Add to admin sidebar under CATALOGUE: "Q&A → /admin/qa"

LIST PAGE:
TABLE:
Columns: Product (thumbnail + name + link) | Question (truncated) | Asked By (name + email) | Date | Answers | Status (Pending / Public / Rejected) | Actions

FILTER: Pending (default) / All / Public / Rejected | Product filter (search/select) | Date range

STATS (top): Total Questions | Pending Moderation | Answered | Unanswered Public Questions

ROW ACTIONS:
- "Moderate" button → opens Q&A Detail Modal:

  QUESTION SECTION:
  - Full question text
  - Asker: name, email, date
  - Status controls: "Make Public" | "Reject" | "Delete" buttons (with confirm on Delete)

  EXISTING ANSWERS (if any):
  - List of answers with: answerer name, isAdminAnswer badge, date, text, "Delete" button per answer

  POST ADMIN ANSWER:
  - Rich textarea (markdown-supported)
  - "Post as Store Admin" button:
    → Creates ProductAnswer with isAdminAnswer=true, isPublic=true
    → Automatically sets the parent ProductQuestion.isPublic=true
    → Sends "question_answered" email to askerEmail with the answer text
    → Toast: "Answer posted and question made public"

  If question already has a public admin answer: show "Edit Answer" instead (update the existing answer, no re-notification)

BULK ACTIONS (checkbox selection):
- "Make Public" selected
- "Reject" selected
- "Delete" selected

Dashboard notification badge: add pending Q&A count to admin dashboard (A2) and top-bar notification bell.

AUDIT LOG: log "QA_QUESTION_APPROVED", "QA_QUESTION_REJECTED", "QA_ANSWER_POSTED".
```

---

## ADMIN TASK A43 — Newsletter Admin (/admin/newsletter)

**Covers the admin management side of storefront Task S6.**

**Prompt for Replit AI:**

```
Build the Newsletter admin page at /admin/newsletter.

Add to admin sidebar under CUSTOMERS: "Newsletter → /admin/newsletter"

STATS ROW:
- Total Subscribers | Confirmed | Unconfirmed | Unsubscribed | Subscribed This Month | Growth rate % vs last month

TWO TABS:

TAB 1 — SUBSCRIBERS:
TABLE: Email | Name | Source (footer/popup/checkout/account) | Confirmed (✓ or ✗) | Subscribed On | Tags | Unsubscribed? | Actions
FILTER: All / Confirmed / Unconfirmed / Unsubscribed | Source filter | Date range | Tag filter
SEARCH: by email or name

ROW ACTIONS:
- "Resend Confirmation" (for unconfirmed subscribers) → re-sends the confirmation email
- "Confirm Manually" (marks isConfirmed=true without email) → useful for manually-added subscribers
- "Unsubscribe" button → sets unsubscribed=true (for GDPR removal requests)
- "Delete" button (hard delete for GDPR right-to-erasure) → confirm dialog

BULK ACTIONS (checkbox):
- Export Selected as CSV
- Delete Selected (GDPR erasure)
- Add Tag to Selected

"Import Subscribers" button: upload CSV with columns email, name (optional), source (optional) → validates emails, creates records with isConfirmed=true and source="admin_import" → shows result: N imported, M skipped (duplicates)

"Export All Confirmed" CSV button (downloads email, name, source, subscribed date for all confirmed non-unsubscribed)

TAB 2 — MAILCHIMP SYNC (shown only if Mailchimp is configured in settings):
- Last sync timestamp
- Total synced to Mailchimp | Total pending sync
- "Sync All Subscribers Now" button → bulk exports confirmed, non-unsubscribed to Mailchimp; shows progress + result
- Sync error log (last 10 errors)

SETTINGS SECTION (add to Admin Settings A17 — General tab or new Integrations tab):
- Newsletter system enable toggle
- Mailchimp API Key (masked, encrypted in DB)
- Mailchimp Audience ID
- "Test Connection" → validates credentials, shows "Connected: [audience name]" or error
- Auto-sync to Mailchimp toggle (sync new subscribers automatically in real time)
- Exit-intent popup enable toggle
- Exit-intent discount % (default 10%)
- Exit-intent popup headline text
```

---

## ADMIN TASK A44 — Flash Sales Admin (/admin/flash-sales)

**Covers the admin management side of storefront Task S7.**

**Prompt for Replit AI:**

```
Build the Flash Sales admin page at /admin/flash-sales.

Add to admin sidebar under SALES: "Flash Sales → /admin/flash-sales"

LIST PAGE:
TABLE: Name | Start Date-Time | End Date-Time | Products Count | Status (Scheduled / Active / Ended) | Actions
STATUS LOGIC: "Scheduled" if startsAt > now; "Active" if startsAt <= now <= endsAt AND isActive=true; "Ended" if endsAt < now OR isActive=false
FILTER: All / Active / Scheduled / Ended
"+ New Flash Sale" button

CREATE / EDIT at /admin/flash-sales/new and /admin/flash-sales/[id]/edit:

SECTION 1 — BASICS:
- Internal Name *, Banner Title *, Banner Subtitle (optional)
- Start Date-Time * | End Date-Time * — date-time pickers
- Active toggle
- Show Countdown toggle

SECTION 2 — PRODUCTS TABLE:
- Search field: type product name → auto-complete results → click to add to table
- Per product row:
  * Product thumbnail + name
  * Original Price (auto-filled from Product.price, read-only — "price at time of adding")
  * Flash Sale Price * — number input (must be < originalPrice; validation error if not)
  * Max Quantity (optional) — number input; "Leave blank for unlimited"
  * Sold Count — read-only (shows live sold count during active sale)
  * Stock remaining: if maxQuantity set → shows "[maxQuantity - soldCount] left"
  * Remove button
- Drag-to-reorder rows (@dnd-kit/sortable) — affects display order on /flash-sale page
- Auto-calculated savings column: "Saves €X (Y%)"

SECTION 3 — LIVE PREVIEW button:
Opens a modal showing a simulated version of the announcement banner as it will appear, using the current bannerTitle + bannerSubtitle + a fake countdown.

SAVE: POST /PATCH /api/admin/flash-sales

DUPLICATE button on list page: clones a flash sale with all products, new start/end dates cleared for manual entry (useful for recurring sales)

SALES ANALYTICS (tab on the detail/edit page of a past or ended sale):
- Total Units Sold at Flash Price | Total Revenue | Average Savings per Order
- Per-product breakdown: Product | Units Sold | Revenue | Max Qty | Sold Out? (yes/no)

AUDIT LOG: log "FLASH_SALE_CREATED", "FLASH_SALE_ACTIVATED", "FLASH_SALE_ENDED".
```

---

## ADMIN TASK A45 — Google OAuth & Integrations Settings

**Covers the admin settings side of storefront Task S8 (and consolidates other 3rd-party credentials).**

**Prompt for Replit AI:**

```
Extend Admin Settings Tab 2 (API Keys — Task A18) to also manage Google OAuth credentials and the Mailchimp newsletter integration. Rename the tab to "Integrations & API Keys".

GOOGLE OAUTH CARD (add to the existing tab alongside Metenzi and Checkout.com cards):

Header: "Google OAuth (Social Login)"
- Enable Google Login — toggle (if OFF: Google login button hidden on storefront)
- Google Client ID — masked input (shows last 6 chars; "Reveal" button; stored AES-256 encrypted in SiteSettings)
- Google Client Secret — masked input (same pattern)
- "Test Connection" button → attempts to validate credentials by constructing the OAuth URL; shows "✓ Credentials valid" or error message
- Instructions link: "How to get your Google Client ID & Secret" → opens Google Cloud Console docs in new tab
- Authorized redirect URI to copy: "[SITE_URL]/api/auth/callback/google" (copy-to-clipboard button — must be added in Google Cloud Console)

MAILCHIMP CARD:
- Mailchimp API Key — masked input (encrypted in DB)
- Mailchimp Audience (List) ID — text input
- "Test Connection" → GET Mailchimp audience details; shows "✓ Connected: [Audience Name] — [N] contacts" or error
- Auto-sync new subscribers — toggle

AFFILIATE PROGRAM CARD:
- Affiliate Program — enable/disable toggle
- Default Commission Rate (%) — number input
- Minimum Payout Threshold (€) — number input
- Commission Hold Period (days) — number input (default 14)
- Auto-approve Applications — toggle

Save all cards with individual "Save" buttons per card (not one global save) so changes to one integration don't inadvertently affect others.
```

---

## ADMIN TASK A46 — Loyalty Program Admin

**Covers the admin management side of storefront Task S9.**

**Prompt for Replit AI:**

```
Build the Loyalty Program admin features integrated into existing pages and a new settings tab.

ADMIN SETTINGS — new tab "Loyalty Program" (extend /admin/settings):
- Enable Loyalty Program — toggle (default: OFF)
- Points earned per €1 spent — number (default 10)
- Points value: [___] points = €1 — number (default 100)
- Minimum points to redeem per order — number (default 500)
- Maximum redemption per order (% of order total) — number (default 50)
- Point expiry — months (0 = never expire; default 0)
- Welcome bonus points — number (default 100)
- Review bonus points — number (default 50)
- TIER THRESHOLDS TABLE:
  | Tier     | Total Points Earned | Multiplier | Perks                    |
  | Silver   | 1,000               | 1.25×      | (editable text field)    |
  | Gold     | 5,000               | 1.50×      | (editable text field)    |
  | Platinum | 15,000              | 2.00×      | Free shipping on all orders (editable) |
  Each threshold and multiplier is editable; perks description is a free-text field.
- Save button

CUSTOMER DETAIL PAGE (extend Task A13 — /admin/customers/[id]):
Add a "Loyalty" tab to the customer detail page:
- Current Tier (badge) + Points Balance + Total Earned + Total Redeemed
- Progress bar to next tier: "X / Y points to [NextTier]"
- Transaction History table: Date | Type | Description | Points (+/-) | Running Balance | Expiry
- MANUAL ADJUSTMENT section:
  * Adjustment Type: Add Points / Remove Points
  * Amount — number input
  * Reason — text input (required)
  * "Apply Adjustment" button → creates LoyaltyTransaction with type=ADMIN_ADJUSTMENT; positive or negative points as appropriate
  * Validates: cannot remove more points than current balance

ANALYTICS (add to Task A3 — /admin/analytics):
Add a "Loyalty" section or tab:
- Stats: Total Points in Circulation | Total Points Redeemed (€ value) | Active Loyalty Accounts | Points Expiring This Month
- Tier Distribution: donut chart (Bronze / Silver / Gold / Platinum accounts)
- Top Earners table: Customer | Tier | Points Balance | Total Earned

AUDIT LOG: log "LOYALTY_POINTS_ADJUSTED", "LOYALTY_TIER_CHANGED".
```

---

## ADMIN TASK A47 — Product Bundles Admin (/admin/bundles)

**Covers the admin management side of storefront Task S10.**

**Prompt for Replit AI:**

```
Build the Product Bundles admin page at /admin/bundles.

Add to admin sidebar under CATALOGUE: "Bundles → /admin/bundles"

LIST PAGE:
TABLE: Name | Slug | Bundle Price | Individual Total | Savings (€ + %) | Products Count | Active | Homepage? | Actions
FILTER: All / Active / Inactive
"+ New Bundle" button

CREATE / EDIT at /admin/bundles/new and /admin/bundles/[id]/edit:

SECTION 1 — BASICS:
- Bundle Name * — text input
- Slug * — auto-generated from name (editable); validates uniqueness
- Description — TipTap rich text editor
- Bundle Image URL — text input with preview
- Active toggle
- Show on Homepage toggle (appears in FEATURED_BUNDLES homepage section)
- Sort Order — number (for ordering on /bundles listing page)

SECTION 2 — PRODUCTS:
- Search + add products (same pattern as flash sale products)
- Per product row:
  * Thumbnail + Name + Individual Price (read-only from Product) + Quantity (editable, default 1) + Sort Handle (@dnd-kit) + Remove
- AUTO-CALCULATED at bottom of table (updates live as products added/removed/quantity changed):
  * Individual Total: €X.XX (sum of price × quantity for all items)
  * Bundle Price * — number input (must be ≤ individual total; shows validation error if not)
  * You save: €Y.YY (Z%) — read-only computed display

SECTION 3 — SEO:
- SEO Title — text input (default: "[Bundle Name] | [Site Name]")
- SEO Description — textarea

SAVE: POST/PATCH /api/admin/bundles

DUPLICATE button: clones bundle with "(Copy)" appended to name, slug suffixed with "-copy", isActive=false

DELETE button: confirm dialog → deletes bundle + BundleItem records (does not affect products)

ANALYTICS (add to each bundle's edit page — only shown after bundle has been active):
- Times viewed (/bundles/[slug] page views — from analytics if GA is configured, or count a BundleView event)
- Times purchased (count of orders where all bundle items were in the cart at bundle price)
- Revenue from bundle purchases

AUDIT LOG: log "BUNDLE_CREATED", "BUNDLE_UPDATED", "BUNDLE_DELETED".
```

---

## ADMIN TASK A48 — Support Tickets Admin (/admin/support)

**Covers the admin management side of storefront Task S11.**

**Prompt for Replit AI:**

```
Build the Support Tickets admin section at /admin/support.

Add to admin sidebar under CUSTOMERS: "Support → /admin/support" with a badge showing count of OPEN tickets.

QUEUE PAGE at /admin/support:

STATS BAR (top):
- Open | Waiting Customer | In Progress | Resolved Today | Avg First Response Time (hours) | Avg Resolution Time (hours)

TABLE:
Columns: # | Subject | Customer (name + email; "Guest" if no account) | Category | Priority (colour-coded badge: Low=grey, Normal=blue, High=orange, Urgent=red) | Status | Assigned To | Created | Last Activity
FILTER: Status (All / Open / Waiting Customer / Waiting Admin / In Progress / Resolved / Closed) | Category | Priority | Assigned To | Date range
SEARCH: by ticket number, subject, customer email

Sort by: Newest / Oldest / Priority (Urgent first) / Last Activity

BULK ACTIONS (checkbox):
- Assign to [admin user] selected
- Close selected
- Set Priority for selected

TICKET DETAIL at /admin/support/[id]:

LEFT COLUMN — Message Thread:
- Full chronological thread: avatar (initials), name, "Customer" or "Admin [Name]" label, timestamp, message body
- Internal notes (isInternalNote=true) shown in amber/yellow background with "Internal Note" tag — NOT visible to customer
- Thread scrolls to bottom on load

REPLY FORM (bottom of thread):
- Rich text textarea (TipTap — bold, italic, links, code blocks)
- "Internal Note" toggle (grey background when ON; message only visible to admins)
- Status action buttons:
  * "Send Reply" (keeps current status)
  * "Send & Set Waiting Customer" (sets status=WAITING_CUSTOMER after sending)
  * "Send & Resolve" (sets status=RESOLVED after sending + sends "ticket_replied" email to customer + sets resolvedAt=now())
- Cancel button

RIGHT SIDEBAR — Ticket Metadata:
- Ticket # + Created date
- Status dropdown (change manually)
- Priority dropdown (change manually)
- Assign To — admin user select (shows all ADMIN/SUPER_ADMIN users)
- Category label
- Linked Order — if orderId set: link to /admin/orders/[id]; if not set: "Link to Order" button (search field to attach an order)
- Customer Info box: name, email, registration date, total orders, total spent, account link; if guest: name + email only
- "Open Metenzi Claim" button — only shown if orderId is set + category is ORDER_ISSUE or KEY_NOT_WORKING → prefills the claim modal (Task A10) with order details
- "Create Refund" button — only shown if orderId is set → opens refund form (Task A32)

TICKET TIMELINE (below sidebar):
- Chronological list of status changes: "Opened by Customer", "Assigned to [Admin]", "Status → In Progress", "Resolved by [Admin]", etc.

NOTIFICATIONS:
- When customer replies: send admin notification per AdminNotificationPrefs
- When admin replies: send "ticket_replied" email to customer with reply text + link to view ticket

AUDIT LOG: log "TICKET_OPENED", "TICKET_REPLIED", "TICKET_RESOLVED", "TICKET_CLOSED", "TICKET_ASSIGNED".
Dashboard (A2): add "Open Tickets" KPI card and pending ticket count to notification bell.
```

---

## ADMIN TASK A49 — Post-Purchase Upsell & Gift Card Analytics (extend A25 + A38)

**Covers the admin analytics/settings side of storefront Task S12 and expands A25.**

**Prompt for Replit AI:**

```
Extend the Checkout Upsell Manager (Task A25) at /admin/upsell with the Post-Purchase Upsell configuration and analytics.

EXTEND /admin/upsell with a second tab "Post-Purchase Upsell":

TAB — POST-PURCHASE UPSELL SETTINGS:
(Full field set as described in Task S12 admin configuration section)
- Enable Post-Purchase Upsell — toggle
- Upsell Product — product selector (search by name; shows thumbnail + current price)
- Headline * — text input
- Custom Price (optional) — number input; "Override product's regular price in the modal"
- Strikethrough Price (optional) — number input; "Shown as the 'original' price"
- Urgency Message (optional) — text input
- Show 10-minute countdown timer — toggle
- CTA Text (default: "Add to My Order") — text input
- CTA Color — Green / Blue / Red radio buttons
- Decline Text (default: "No thanks, I don't need this") — text input

LIVE PREVIEW: right column shows a simulated modal using current config values — updates live as fields change. Preview includes the countdown timer animation if enabled.

ANALYTICS CARDS (below the form, always visible):
- Times Shown (all time + this month)
- Times Accepted (all time + this month)
- Acceptance Rate % (Accepted / Shown × 100)
- Revenue Generated (€, all time + this month)
- Avg Order Value of accepted upsells

ANALYTICS CHART: 30-day bar chart — daily impressions vs. acceptances (dual-bar Recharts chart)

---

ALSO EXTEND /admin/gift-cards (Task A38) with analytics tab:

GIFT CARD ANALYTICS TAB:
- Total Cards Issued (all time) | Total Face Value Issued | Total Value Redeemed | Outstanding Balance (sum of all active card balances)
- Monthly chart: cards issued vs. redemption value (Recharts)
- Expiring soon alert: "X cards with €Y.YY combined balance expire in the next 30 days" — with "View" link

AUDIT LOG: log "POST_PURCHASE_UPSELL_SHOWN", "POST_PURCHASE_UPSELL_ACCEPTED", "POST_PURCHASE_UPSELL_DECLINED".
```

---

## ADMIN TASK A50 — Language & Translation Admin (Settings Tab 11)

**Covers the admin management side of storefront Task S13.**

**Prompt for Replit AI:**

```
Add a "Languages & Translations" tab (Tab 11) to /admin/settings.

TAB 11 — LANGUAGES & TRANSLATIONS:

SECTION 1 — ENABLED LANGUAGES:
- Default Language — select dropdown (options: all 5 supported locales; default: English)
- Language toggles (one per non-English locale):
  | Language | Flag | Code | Status | Toggle |
  | Polish   | 🇵🇱  | pl   | Enabled | ● |
  | Czech    | 🇨🇿  | cs   | Enabled | ● |
  | German   | 🇩🇪  | de   | Enabled | ● |
  | French   | 🇫🇷  | fr   | Enabled | ● |
- Disabled locales: language selector hidden on storefront for that locale; if a user navigates to /[locale]/... they are redirected to the English version
- "Disable All Non-English" shortcut toggle (useful for soft launches)

SECTION 2 — TRANSLATION OVERRIDES:

Purpose: lets admin override any translation string for custom branding without editing JSON files. Stored in LocaleOverride model.

UI:
- Locale selector (tab row: EN | PL | CS | DE | FR)
- Search field: type any key or value text → filters the table
- Table: Key (monospace) | Default Value (from JSON, read-only grey) | Override Value (editable inline text input)
  * Only rows with existing overrides are shown by default; "Show All Keys" toggle reveals the full translation table
  * Edited cells highlighted in yellow until saved
- "Save Overrides" button → bulk PATCH /api/admin/locale-overrides
- "Reset to Defaults" button per locale → deletes all LocaleOverride rows for that locale (with confirmation dialog)

SECTION 3 — EMAIL LANGUAGE SETTINGS:
- "Send transactional emails in customer's preferred language" — toggle (uses User.preferredLocale)
- If OFF: all emails sent in Default Language regardless of customer locale
- Note: "Email templates must be created for each language in the Email Templates section (Task A29)"
- Quick link: "Manage Email Templates →" button

SAVE: PATCH /api/admin/settings/languages
Show toast "Language settings saved."

SIDEBAR UPDATE: ensure admin sidebar A1 reflects that Settings now has 11 tabs.
```

---

## Updated Complete Admin Portal Task Map (A1–A50)

| Task | Page / Area | Description |
|------|-------------|-------------|
| A1 | Layout | Sidebar (updated for new pages), top bar, mobile drawer, route protection |
| A2 | /admin | Dashboard: KPIs, recent orders, low stock, pending reviews, open tickets |
| A3 | /admin/analytics | Revenue & order charts, top products, category breakdown, loyalty stats |
| A4 | /admin/products | Product list: search, filter, bulk actions, Metenzi sync, alert badges |
| A5 | /admin/products/[id]/edit | Product editor: content, SEO, cross-sells, upsell, image |
| A6 | /admin/categories | Category display names, slugs, nav visibility, sort |
| A7 | /admin/orders | Order list: filters, CSV export, status badges |
| A8 | /admin/orders/[id] | Order detail: keys, payment, Metenzi status, timeline |
| A9 | /admin/keys | License keys: reveal with audit log, claim submission |
| A10 | /admin/claims | Claims list, Metenzi sync, submit claim modal |
| A11 | /admin/discounts (Coupon tab) | Coupon code list: inline toggle, usage progress bars |
| A12 | /admin/discounts/new + edit | Coupon code form with live preview calculator |
| A13 | /admin/customers | Customer list + detail: orders, wishlist, reviews, loyalty, notes |
| A14 | /admin/reviews | Review moderation: approve, reject, admin reply |
| A15 | /admin/banners | Homepage banner drag-to-reorder, live preview modal |
| A16 | /admin/pages | Static page WYSIWYG editor, FAQ item manager |
| A17 | /admin/settings Tab 1 | General: site name, logo, contact info, social links |
| A18 | /admin/settings Tab 2 | Integrations & API Keys: Metenzi, Checkout.com, Google OAuth, Mailchimp, Affiliate settings |
| A19 | /admin/settings Tab 3 | CPP config + card fee with live calculator |
| A20 | /admin/settings Tab 4 | Currency rates table, add currency, bulk save |
| A21 | /admin/settings Tab 5 | SMTP config, test email, email queue status |
| A22 | /admin/settings Tabs 6–7 | Webhooks registration + live chat embed code |
| A23 | /admin/audit-log | Full audit trail with 20+ event types, CSV export |
| A24 | /admin/balance | Metenzi live balance, key rotation, open claims |
| A25 | /admin/upsell | Checkout + post-purchase upsell config with analytics |
| A26 | /admin/discounts/bulk-generate | Bulk code generation + usage report + product restrictions |
| A27 | /admin/brands | Brand partner sections: banner + product carousel per brand |
| A28 | /admin/homepage | Homepage section order manager: reorder/show/hide all sections |
| A29 | /admin/email-templates | Email template editor: subject, body, variables, live preview |
| A30 | /admin/settings Tab 8 | Tax/VAT: country rates, B2B exemption, checkout integration |
| A31 | /admin/admin-users | Multi-admin management: invite, permissions, revoke |
| A32 | /admin/refunds | Refunds list, initiate/retry refunds, Checkout.com sync |
| A33 | /admin/resellers | Reseller applications: review, approve/reject, active resellers |
| A34 | /admin/settings Tab 9 | Notification preferences: per-event toggles + daily digest |
| A35 | /admin/settings Tab 10 | SEO defaults, robots.txt, GA4/GTM/Pixel, maintenance mode |
| A36 | /admin/discounts (Automatic tab) | Automatic discounts: rule-based, Buy X Get Y, free shipping |
| A37 | /admin/discounts (Import modal) | CSV import of external discount codes with validation |
| **A38** | **/admin/gift-cards** | **Gift card list, manual create, deactivate, resend email, analytics** |
| **A39** | **/admin/affiliates** | **Affiliate applications review + active affiliates + payout management** |
| **A40** | **/admin/abandoned-carts** | **Abandoned cart queue, manual email trigger, recovery stats** |
| **A41** | **/admin/alerts** | **Product alert subscribers, manual notification trigger, notification log** |
| **A42** | **/admin/qa** | **Q&A moderation: approve, reject, post admin answer, notify asker** |
| **A43** | **/admin/newsletter** | **Newsletter subscriber list, CSV export/import, Mailchimp sync** |
| **A44** | **/admin/flash-sales** | **Flash sale create/edit, product table, live banner preview, analytics** |
| **A45** | /admin/settings Tab 2 (extended) | **Google OAuth card + Mailchimp card + Affiliate settings card** |
| **A46** | /admin/settings + /admin/customers/[id] | **Loyalty program settings tab + customer loyalty tab + admin adjustments** |
| **A47** | **/admin/bundles** | **Bundle create/edit, product table, savings calculator, analytics** |
| **A48** | **/admin/support** | **Support ticket queue, thread view, reply, assign, resolve, internal notes** |
| **A49** | /admin/upsell (extended) | **Post-purchase upsell settings + analytics + gift card analytics** |
| **A50** | /admin/settings Tab 11 | **Language toggles, translation override editor, email language setting** |

**Total admin tasks: 50 (A1–A50)**
**Tasks added in this revision: A38–A50 (admin coverage for S1–S13)**

---

### Updated Admin Sidebar Navigation (A1)

Add these routes to the admin sidebar alongside existing ones:

```
OVERVIEW
  Dashboard        /admin
  Analytics        /admin/analytics

CATALOGUE
  Products         /admin/products
  Categories       /admin/categories
  Bundles          /admin/bundles          ← NEW (A47)
  Banners          /admin/banners
  Q&A              /admin/qa               ← NEW (A42)

SALES
  Orders           /admin/orders
  License Keys     /admin/keys
  Claims           /admin/claims
  Discount Codes   /admin/discounts
  Gift Cards       /admin/gift-cards       ← NEW (A38)
  Flash Sales      /admin/flash-sales      ← NEW (A44)
  Abandoned Carts  /admin/abandoned-carts  ← NEW (A40)
  Refunds          /admin/refunds

CUSTOMERS
  Customers        /admin/customers
  Reviews          /admin/reviews
  Newsletter       /admin/newsletter       ← NEW (A43)
  Product Alerts   /admin/alerts           ← NEW (A41)
  Affiliates       /admin/affiliates       ← NEW (A39)
  Resellers        /admin/resellers
  Support          /admin/support          ← NEW (A48)

CONTENT
  Pages            /admin/pages
  Homepage         /admin/homepage
  Brands           /admin/brands
  Email Templates  /admin/email-templates
  Live Chat        /admin/live-chat

SYSTEM
  Settings         /admin/settings        (11 tabs)
  Admin Users      /admin/admin-users
  Webhooks         /admin/webhooks
  Audit Log        /admin/audit-log
  Metenzi Balance  /admin/balance
```

---

## ADMIN TASK A51 — Scheduled Email Reports

**Prompt for Replit AI:**

```
Build a Scheduled Reports system that automatically emails sales and performance summaries to the admin.

PRISMA SCHEMA — Add:
model ScheduledReport {
  id           Int          @id @default(autoincrement())
  name         String
  type         ReportType
  frequency    ReportFrequency
  dayOfWeek    Int?         (0=Sun, 1=Mon, …; used when frequency=WEEKLY)
  sendTime     String       (HH:MM local time, default "09:00")
  recipients   String[]     (email addresses)
  isEnabled    Boolean      @default(true)
  lastSentAt   DateTime?
  createdAt    DateTime     @default(now())
}
enum ReportType    { SALES_SUMMARY TOP_PRODUCTS CUSTOMER_GROWTH SUPPORT_SUMMARY FULL_DIGEST }
enum ReportFrequency { DAILY WEEKLY MONTHLY }

ADMIN PAGE at /admin/reports:
Add to admin sidebar under SYSTEM: "Reports → /admin/reports"

LIST PAGE:
Table: Name | Type | Frequency | Recipients | Last Sent | Enabled toggle | Actions (Edit, Send Now, Delete)
"+ New Report" button

CREATE / EDIT FORM:
- Report Name * — text input
- Report Type * — select:
  * Sales Summary: orders count, revenue, avg order value, top 5 products, period-over-period comparison
  * Top Products: top 10 products by revenue and by units sold
  * Customer Growth: new customers, returning customers, churn rate
  * Support Summary: tickets opened, resolved, avg resolution time, open tickets count
  * Full Digest: combines all of the above
- Frequency * — Daily / Weekly / Monthly
- Day of Week (shown if Weekly) — Mon/Tue/Wed/Thu/Fri/Sat/Sun
- Send Time — time picker (HH:MM)
- Recipients * — tag input (email addresses; pre-filled with admin email)
- Enable on create — toggle (default ON)

REPORT GENERATION (node-cron runs every minute, checks if any report is due):
- Checks: isEnabled=true AND next due time has passed (based on frequency + lastSentAt + sendTime)
- Generates HTML email with:
  * Report title + period (e.g. "Weekly Sales Summary — 1–7 Apr 2026")
  * Data tables + mini bar charts (rendered as HTML tables with inline CSS, not images)
  * Key metrics highlighted: total revenue (large, green), orders count, top product
  * "View Full Analytics →" button linking to /admin/analytics
- Sends to all recipients[] via SMTP (Task A21)
- Updates lastSentAt = now()

"SEND NOW" BUTTON: manually triggers the report generation + send immediately regardless of schedule.

Add "report_scheduled" to EmailTemplate system for the report email wrapper/header/footer.
```

---

## ADMIN TASK A52 — Social Proof Admin Settings

**Covers the admin management side of storefront Task S14.**

**Prompt for Replit AI:**

```
Add Social Proof configuration to Admin Settings.

Add a "Social Proof" section to /admin/settings Tab 10 (SEO & Maintenance — Task A35), or create a dedicated card within the General settings tab (A17).

SOCIAL PROOF SETTINGS CARD:

- Enable Social Proof Widgets — master toggle (default: OFF)

VIEWER COUNT:
- Show "X people viewing now" — toggle
- Minimum viewers to display (default: 3) — "Hide counter if fewer than this many viewers"
- Tracking window — minutes (default: 30) — "Count views within the last X minutes"

SOLD COUNT:
- Show "X sold in last 24 hours" — toggle
- Minimum sales to display (default: 5) — "Hide counter if fewer than this many sales"
- Time window — hours (default: 24)

RECENT PURCHASE NOTIFICATIONS (toast popups):
- Enable purchase notification popups — toggle
- Min interval between popups — seconds (default: 45)
- Max interval between popups — seconds (default: 90)
- Max notifications per session — number (default: 3)
- Show on pages — multi-checkbox: Homepage / Product Pages / Listing Pages / Cart

STOCK URGENCY BADGES:
- Show "Only X left!" badge — toggle
- Amber threshold (show "Only N left!") — number (default: 10)
- Red threshold (show "Almost gone!") — number (default: 3)

Save all as a single JSON blob in SiteSettings.socialProofConfig (Json field).
Provide a "Preview" button that opens a modal simulating what each widget looks like.
```

---

## ADMIN TASK A53 — Trustpilot Integration Admin

**Covers the admin management side of storefront Task S15.**

**Prompt for Replit AI:**

```
Add Trustpilot configuration to the Integrations & API Keys settings tab (A45 / Admin Settings Tab 2).

TRUSTPILOT CARD (add to /admin/settings Tab 2 alongside Google OAuth, Mailchimp, etc.):

- Trustpilot Business Unit ID — text input (found in Business.trustpilot.com → Integrations)
- Trustpilot API Key — masked input (encrypted in DB, same pattern as other keys)
- "Test Connection" button → GET Trustpilot /v1/business-units/[id]:
  * Success: shows "✓ Connected: [Business Name] — [score]/5 based on [N] reviews"
  * Failure: shows error message

WIDGET DISPLAY TOGGLES:
- Show TrustBox in footer — toggle
- Show review carousel on homepage — toggle
- Show rating badge on product pages — toggle

REVIEW IMPORT:
- Import reviews from Trustpilot — toggle (enables daily cron import)
- "Import Reviews Now" button → POST /api/admin/trustpilot/import:
  * Fetches reviews from Trustpilot API
  * Upserts into Review table (deduplicates by externalId)
  * Returns "N reviews imported, M already existed"
- Last import timestamp display
- "View Imported Reviews" link → /admin/reviews filtered by source=trustpilot

CACHED SCORE:
- Show current cached score: "Current cached score: 4.8/5 (last updated 2h ago)"
- "Refresh Score" button → immediately re-fetches score from Trustpilot API + updates SiteSettings.trustpilotScore and trustpilotScoreUpdatedAt
- node-cron job: refresh score every 6 hours automatically
```

---

## ADMIN TASK A54 — Verified Purchase Badge Settings

**Covers the admin management side of storefront Task S16.**

**Prompt for Replit AI:**

```
Add Verified Purchase configuration and controls to the Review Moderation admin page (A14).

EXTEND /admin/reviews (Task A14):

SETTINGS SECTION (add as a collapsed card at top of /admin/reviews):
- Enable Verified Purchase Badge — toggle (default: ON)
  "When enabled, reviews from customers who have a completed order for the product are automatically marked with a ✓ Verified Purchase badge"
- Badge Label — text input (default: "Verified Purchase") — allows custom label e.g. "Confirmed Buyer"
- Show "X of Y reviews are verified purchases" on product page — toggle

REVIEW TABLE — new column:
- "Verified?" column: ✓ (green) or ✗ (grey) badge
- Filter: All / Verified Only / Unverified Only

ROW ACTION — manual override:
- Each review row gets a "Toggle Verified" button (shown on hover or in the row action menu)
- Click: toggles isVerifiedPurchase → confirms with a brief toast "Review marked as Verified / Unverified"
- Audit log entry: "REVIEW_VERIFIED_OVERRIDE" with admin user and review ID

BACKFILL BUTTON:
"Backfill Verified Badges" — POST /api/admin/reviews/backfill-verified:
- Iterates all existing reviews where isVerifiedPurchase=false
- Checks if reviewer has a completed order for that product
- Updates those that qualify to isVerifiedPurchase=true
- Returns { updated: N }
- Shows toast: "N reviews updated as Verified Purchase"
- This is a one-time tool (but safe to re-run; idempotent)
```

---

## ADMIN TASK A55 — Push Notifications Admin (/admin/push-notifications)

**Covers the admin management side of storefront Task S18.**

**Prompt for Replit AI:**

```
Build the Push Notifications admin section at /admin/push-notifications.

Add to admin sidebar under CUSTOMERS: "Push Notifications → /admin/push-notifications"

TWO TABS:

TAB 1 — SUBSCRIBERS:
STATS ROW: Total Push Subscribers | Active (endpoint not expired) | Added This Month

TABLE: ID | User (name + email if linked, "Anonymous" if not) | Subscribed On | Last Notified | Status (Active/Expired)
FILTER: All / Active / Expired | Date range
- "Delete" per row (removes PushSubscription; GDPR erasure)
- "Bulk Delete Expired" button (removes all subscriptions that returned 410 Gone on last send)

TAB 2 — SEND CAMPAIGN:
Purpose: manually send a push notification to ALL subscribers (for store-wide announcements, flash sale launches, etc.)

FORM:
- Notification Title * — text input (max 50 chars)
- Notification Body * — textarea (max 120 chars)
- Target URL * — text input (where clicking the notification takes the user, e.g. /flash-sale)
- Icon — image URL (defaults to site logo)
- Target Audience — "All Subscribers" / "Subscribers with tag [select tag]"

PREVIEW: shows simulated notification as it will appear on desktop (Chrome-style notification card)

"Send to [N] subscribers" button → POST /api/admin/push/send-campaign:
- Iterates all active PushSubscriptions
- Sends via web-push in batches of 100 (with 100ms delay between batches to avoid rate limits)
- Removes expired subscriptions (410 responses) in real time
- Returns { sent: N, failed: M, expired: P }
- Shows result toast

CAMPAIGN HISTORY (below the form):
Simple log of past manual campaigns: Date | Title | Recipients | Sent | Failed

SETTINGS SECTION:
- Web Push enable toggle
- VAPID Public Key — text input (safe to display)
- VAPID Private Key — masked input (encrypted in DB)
- VAPID Contact Email — text input (required by web-push spec)
- "Generate New VAPID Keys" button: with strong warning "This invalidates ALL existing subscriptions. All users must re-subscribe." — requires typing "CONFIRM" before proceeding
```

---

## ADMIN TASK A56 — PDF Invoice Admin

**Covers the admin management side of storefront Task S19.**

**Prompt for Replit AI:**

```
Add PDF Invoice management and configuration to the admin portal.

EXTEND /admin/orders/[id] (Task A8):
- Add "Download Invoice (PDF)" button in the order header actions row → GET /api/orders/[id]/invoice (admin bypasses ownership check)
- Add "Regenerate Invoice" button → forces re-render of the PDF (useful if template changed after order was placed)
- Invoice download button also available in the orders list (/admin/orders) as an icon button per row

INVOICE SETTINGS (add to /admin/settings Tab 1 — General, Task A17):
New "Invoices & Receipts" card:

- Invoice Prefix — text input (default: "INV") — generates invoice numbers like INV-1042
- Company/Seller Name — text input (pre-filled from SiteSettings.siteName)
- Company Address — textarea (multi-line; shown on invoice as seller address)
- Company VAT Number — text input (shown on invoice; optional)
- Company Registration Number — text input (optional; e.g. for UK companies: "Company No. 12345678")
- Invoice footer note — text input (default: "Thank you for your purchase! This is a computer-generated invoice.")
- Attach invoice PDF to order confirmation email — toggle (default: ON)
- Attach invoice PDF to key delivery email — toggle (default: OFF)

INVOICE TEMPLATE PREVIEW:
"Preview Invoice Template" button → generates a sample PDF using dummy order data and opens it in a new browser tab so admin can see exactly how it will look before sending real invoices.

BULK EXPORT:
In /admin/orders list page: add to bulk actions (when orders are selected):
"Download Selected Invoices as ZIP" → POST /api/admin/invoices/bulk-export with orderIds[] → generates all PDFs server-side → packages into a .zip file → returns download link.

AUDIT LOG: log "INVOICE_DOWNLOADED" (admin action) and "INVOICE_BULK_EXPORTED".
```

---

## ADMIN TASK A57 — Customer Segments Admin (/admin/segments)

**Covers the admin management side of storefront Task S20.**

**Prompt for Replit AI:**

```
Build the Customer Segments admin page at /admin/segments.

Add to admin sidebar under CUSTOMERS: "Segments → /admin/segments"

LIST PAGE:
TABLE: Segment Name | Colour badge | Customer Count | Type (Manual/Auto) | Last Updated | Actions
- "Auto" segments show a ⚡ icon (rule-based, updated by cron)
- "+ New Segment" button

CREATE / EDIT at /admin/segments/new and /admin/segments/[id]/edit:

SECTION 1 — BASICS:
- Segment Name * — text input
- Description — text input
- Colour — colour picker (for the UI badge)
- Tag name * — text input (the tag string added to User.tags, e.g. "vip" — lowercase, no spaces)

SECTION 2 — MEMBERSHIP TYPE:
- Manual: admin manually adds/removes customers
- Auto: define rules that automatically tag customers nightly

AUTO RULES (shown when Auto selected):
Each rule is an AND condition (all must be true):
  - Min total orders — number (optional)
  - Min total spend (€) — number (optional)
  - Inactive for X days — number (optional)
  - Registered within last X days — number (optional)
  - Has existing tag — tag selector (optional)
  - Is reseller — checkbox
  - Is affiliate — checkbox
"Preview: ~X customers currently match these rules" — live count (GET /api/admin/segments/preview with rules)

"Run Auto-Assign Now" button: immediately applies rules to all users (normally runs nightly via cron)

SECTION 3 — MANUAL MEMBERS (shown when Manual selected):
- Customer search: type name or email → auto-complete → add to members list
- Members table: Name | Email | Added On | Remove button

---

CUSTOMER LIST INTEGRATION (extend Task A13 — /admin/customers):
- Add "Tags" column to customer table showing all their tags as coloured badges
- Add "Segment" filter dropdown: filter customers by tag
- Per customer row: "Add Tag" button (opens a tag selector modal)
- In customer detail: "Tags & Segments" section showing all current tags with "Remove" button per tag, plus "Add Tag" button

BULK TAG OPERATIONS (in /admin/customers bulk actions):
- "Add Tag to Selected" → select a tag → applies to all selected customers
- "Remove Tag from Selected" → same workflow

INTEGRATION CROSS-REFERENCES (shown on segment edit page):
"This tag is used in:" section listing:
- Discount codes restricted to this tag: [list with links]
- Automatic discounts with this tag trigger: [list with links]
- Flash sales restricted to this tag: [list with links]
This helps admin understand the impact before deleting a segment/tag.

AUDIT LOG: log "CUSTOMER_TAGGED", "CUSTOMER_UNTAGGED", "SEGMENT_AUTO_RUN".
```

---

## Final Complete Admin Portal Task Map (A1–A57)

| Task | Page / Area | Category | Description |
|------|-------------|----------|-------------|
| A1 | /admin/* Layout | Foundation | Sidebar (all pages), top bar, mobile drawer, route protection |
| A2 | /admin | Overview | Dashboard: KPIs, recent orders, low stock, tickets, reviews |
| A3 | /admin/analytics | Overview | Charts, top products, category breakdown, loyalty stats |
| A4 | /admin/products | Catalogue | List: search, filter, bulk, Metenzi sync, alert badges |
| A5 | /admin/products/[id]/edit | Catalogue | Editor: content, SEO, cross-sells, upsell, image |
| A6 | /admin/categories | Catalogue | Display names, slugs, nav visibility, sort order |
| A7 | /admin/orders | Sales | List: filters, CSV export, status badges |
| A8 | /admin/orders/[id] | Sales | Detail: keys, payment, Metenzi status, timeline, invoice |
| A9 | /admin/keys | Sales | Reveal with audit log, claim submission |
| A10 | /admin/claims | Sales | Claims list, Metenzi sync, submit claim modal |
| A11 | /admin/discounts (Coupon tab) | Sales | Coupon list: inline toggle, usage progress bars |
| A12 | /admin/discounts/new + edit | Sales | Coupon form with live preview calculator |
| A13 | /admin/customers | Customers | List + detail: orders, wishlist, reviews, loyalty, tags |
| A14 | /admin/reviews | Customers | Moderate: approve, reject, reply, verified badge controls |
| A15 | /admin/banners | Content | Homepage banner drag-to-reorder, live preview |
| A16 | /admin/pages | Content | Static page WYSIWYG editor, FAQ manager |
| A17 | /admin/settings Tab 1 | Settings | General: site name, logo, contact, invoices, social proof |
| A18 | /admin/settings Tab 2 | Settings | Integrations: Metenzi, Checkout.com, Google OAuth, Mailchimp, Trustpilot, Affiliate |
| A19 | /admin/settings Tab 3 | Settings | CPP + card fee with live calculator |
| A20 | /admin/settings Tab 4 | Settings | Currency rates table, add currency |
| A21 | /admin/settings Tab 5 | Settings | SMTP config, test email, email queue |
| A22 | /admin/settings Tabs 6–7 | Settings | Webhooks registration + live chat embed |
| A23 | /admin/audit-log | System | 20+ event types, 90-day retention, CSV export |
| A24 | /admin/balance | System | Metenzi balance, API key rotation, open claims |
| A25 | /admin/upsell | Sales | Pre + post-purchase upsell config + analytics |
| A26 | /admin/discounts/bulk-generate | Sales | Bulk generation, usage report, product restrictions |
| A27 | /admin/brands | Content | Brand sections: banner + product carousel |
| A28 | /admin/homepage | Content | Homepage section order + show/hide manager |
| A29 | /admin/email-templates | Content | Email editor: subject, body, variables, live preview |
| A30 | /admin/settings Tab 8 | Settings | Tax/VAT: country rates, B2B exemption |
| A31 | /admin/admin-users | System | Multi-admin: invite, permissions, revoke |
| A32 | /admin/refunds | Sales | Initiate/retry refunds, Checkout.com sync |
| A33 | /admin/resellers | Customers | Applications: review, approve/reject, active list |
| A34 | /admin/settings Tab 9 | Settings | Notification preferences + daily digest |
| A35 | /admin/settings Tab 10 | Settings | SEO defaults, robots.txt, GA4/GTM/Pixel, maintenance mode |
| A36 | /admin/discounts (Auto tab) | Sales | Automatic discounts: rule-based, Buy X Get Y |
| A37 | /admin/discounts (Import) | Sales | CSV import with validation + error report |
| A38 | /admin/gift-cards | Sales | List, manual create, deactivate, analytics |
| A39 | /admin/affiliates | Customers | Applications + active affiliates + payout management |
| A40 | /admin/abandoned-carts | Sales | Queue, manual email trigger, recovery stats |
| A41 | /admin/alerts | Catalogue | Alert subscribers, manual notification, log |
| A42 | /admin/qa | Catalogue | Q&A moderation, post admin answer, notify asker |
| A43 | /admin/newsletter | Customers | Subscriber list, import/export, Mailchimp sync |
| A44 | /admin/flash-sales | Sales | Create/edit, product table, preview, analytics |
| A45 | /admin/settings Tab 2 (ext.) | Settings | Google OAuth + Mailchimp + Affiliate + Trustpilot cards |
| A46 | /admin/settings + customers/[id] | Customers | Loyalty settings + customer loyalty tab + adjustments |
| A47 | /admin/bundles | Catalogue | Create/edit, product table, savings calc, analytics |
| A48 | /admin/support | Customers | Ticket queue, thread, reply, assign, resolve, internal notes |
| A49 | /admin/upsell (ext.) | Sales | Post-purchase upsell + analytics + gift card analytics |
| A50 | /admin/settings Tab 11 | Settings | Language toggles, translation override editor |
| A51 | /admin/reports | System | Scheduled email reports: daily/weekly/monthly digests |
| A52 | /admin/settings (Social Proof) | Settings | Viewer count, sold counter, popup notification config |
| A53 | /admin/settings Tab 2 (ext.) | Settings | Trustpilot API, widget toggles, review import |
| A54 | /admin/reviews (ext.) | Customers | Verified badge settings, manual override, backfill tool |
| A55 | /admin/push-notifications | Customers | Push subscriber list, send campaigns, VAPID settings |
| A56 | /admin/orders/[id] + settings | Sales | Invoice download, bulk ZIP export, template settings |
| A57 | /admin/segments | Customers | Create segments, auto-rules, tag customers, bulk operations |

**Total admin tasks: 57 (A1–A57)**
**Added in this revision: A51 (Scheduled Reports), A52 (Social Proof Settings), A53 (Trustpilot Settings), A54 (Verified Badge Settings), A55 (Push Notifications), A56 (PDF Invoice Admin), A57 (Customer Segments)**
