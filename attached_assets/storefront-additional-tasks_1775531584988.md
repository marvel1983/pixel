# Storefront Additional Feature Tasks (S1–S13)

> These tasks extend the core storefront (Tasks 1–20) with features commonly found on professional digital software stores but not yet covered.
> **Stack:** TypeScript · Next.js 14 App Router · Prisma · Tailwind CSS · shadcn/ui

---

## TASK S1 — Gift Cards

**What's missing:** Customers can't buy or redeem gift cards. This is a high-value feature for digital stores — it creates new revenue streams and drives new customers.

**Prompt for Replit AI:**

```
Implement a complete Gift Card system covering purchase, delivery, and redemption at checkout.

---

PRISMA SCHEMA — Add:

model GiftCard {
  id            Int       @id @default(autoincrement())
  code          String    @unique  (e.g. "GIFT-A3X9-BK72-CD45", generated on purchase)
  originalValue Decimal   (the amount paid / face value of the card)
  balance       Decimal   (remaining balance; starts equal to originalValue)
  currency      String    @default("EUR")
  isActive      Boolean   @default(true)
  purchasedById Int?      @relation(fields: [purchasedById], references: [id]) (User who bought it — null for admin-created)
  recipientEmail String   (email the gift card was sent to)
  recipientName  String?  (optional personalised recipient name)
  senderName     String?  (optional personalised sender name)
  personalMessage String? (optional message from sender to recipient)
  orderId       Int?      (the order where this card was purchased)
  expiresAt     DateTime? (optional expiry date)
  createdAt     DateTime  @default(now())

  redemptions   GiftCardRedemption[]
}

model GiftCardRedemption {
  id          Int      @id @default(autoincrement())
  giftCardId  Int      @relation(...)
  orderId     Int      @relation(...)
  amountUsed  Decimal
  createdAt   DateTime @default(now())
}

---

STOREFRONT — PURCHASE FLOW:

1. Gift Card product page at /gift-cards:
   - Page title: "Gift Cards — Give the Gift of Software"
   - Amount selector: preset buttons (€10, €20, €50, €100, €200) + custom amount input (min €5, max €500)
   - Recipient Email * — text input
   - Recipient Name (optional) — text input
   - Your Name (optional) — text input (shown as "From: [Your Name]" in delivery email)
   - Personal Message (optional) — textarea (max 200 chars)
   - Delivery: "Sent instantly by email after payment"
   - "Add to Cart" button → adds a gift card item with the configured amount to the cart

2. In the cart: Gift card shows as "Gift Card (€50) → [recipient@email.com]" with a gift icon.

3. On successful order:
   - Generate a cryptographically unique gift card code (format: GIFT-XXXX-XXXX-XXXX using crypto.randomBytes)
   - Create GiftCard record in DB
   - Send a beautifully styled gift card delivery email to recipientEmail:
     * Shows the code in a prominent gift card design
     * Shows the balance, expiry (if set), and personal message
     * "Redeem at [site URL]" button
   - Add a new EmailTemplate key "gift_card_delivery" to the email template system (Task A29)

---

STOREFRONT — REDEMPTION AT CHECKOUT:

In the checkout page (Task 9), add a "Gift Card" input below the coupon code field:

1. "Have a gift card?" — collapsible section with a text input + "Apply" button
2. On apply: POST /api/checkout/apply-gift-card { code }
   - Validate code exists, isActive = true, balance > 0, not expired
   - Return: { valid: true, balance: 47.50, amountToApply: 47.50 } (capped at order total)
   - Display: "Gift card applied — €47.50 credit" as a line item (green)
3. Multiple gift cards can be applied to one order (stacks with coupon codes)
4. On order completion:
   - Deduct amountUsed from GiftCard.balance
   - Create GiftCardRedemption record
   - If balance reaches 0: set isActive = false

---

CUSTOMER ACCOUNT — GIFT CARD BALANCE CHECK:

Add a "Gift Cards" tab to the customer account page (/account/gift-cards):
- "Check a Gift Card Balance" — enter code → shows remaining balance and expiry
- "Your Purchased Gift Cards" — list of gift cards bought by this customer (code masked, balance, recipient)

---

ADMIN PORTAL ADDITIONS:

Add /admin/gift-cards page:
- List of all gift cards: Code, Face Value, Remaining Balance, Recipient, Purchased By, Created, Expiry, Active status
- "Create Gift Card" button: admin can manually create gift cards (useful for customer compensation, contests, etc.)
  - Fill same fields as purchase form above; no payment taken
  - Send gift card delivery email on creation
- "Deactivate" button per card (sets isActive = false)
- Filter by: Active/Inactive/Expired/Zero Balance
- Search by code or recipient email
- Click any card → view all redemptions (order #, amount used, date)
```

---

## TASK S2 — Affiliate & Referral Program

**What's missing:** No way for customers or partners to earn commissions by referring buyers. Referral programs are extremely effective for digital software stores.

**Prompt for Replit AI:**

```
Build a complete Affiliate & Referral Program.

---

PRISMA SCHEMA — Add:

model AffiliateProfile {
  id              Int      @id @default(autoincrement())
  userId          Int      @unique @relation(...)
  referralCode    String   @unique  (e.g. "DINO20" — custom or auto-generated)
  commissionRate  Decimal  @default(10.00)  (% of referred order revenue)
  status          AffiliateStatus @default(PENDING)
  paypalEmail     String?  (where commissions are paid out)
  bankDetails     Json?    (alternative payout details)
  totalEarned     Decimal  @default(0)
  totalPaid       Decimal  @default(0)
  pendingBalance  Decimal  @default(0)  (earned but not yet paid out)
  notes           String?  (admin notes)
  approvedAt      DateTime?
  createdAt       DateTime @default(now())
}

enum AffiliateStatus { PENDING ACTIVE SUSPENDED REJECTED }

model AffiliateClick {
  id            Int      @id @default(autoincrement())
  affiliateId   Int      @relation(...)
  ipAddress     String
  userAgent     String?
  landingPage   String   (which page they landed on)
  converted     Boolean  @default(false)  (did this click lead to an order?)
  createdAt     DateTime @default(now())
}

model AffiliateCommission {
  id            Int      @id @default(autoincrement())
  affiliateId   Int      @relation(...)
  orderId       Int      @relation(...)
  orderAmount   Decimal
  commissionRate Decimal
  commissionAmount Decimal
  status        CommissionStatus @default(PENDING)
  paidAt        DateTime?
  createdAt     DateTime @default(now())
}

enum CommissionStatus { PENDING APPROVED PAID REVERSED }

---

STOREFRONT — REFERRAL LINKS:

1. Referral tracking:
   - When a visitor arrives via /?ref=DINO20:
     * Store referralCode in a cookie (30-day expiry, survives page navigation)
     * Record an AffiliateClick (IP, user agent, landing page)
   - At checkout: if referral cookie exists, attach affiliateCode to the order

2. On order completion (webhook: order.fulfilled):
   - Look up AffiliateProfile by referralCode
   - If found and status = ACTIVE:
     * Create AffiliateCommission: commissionAmount = order.totalAmount × (commissionRate / 100)
     * Add commissionAmount to AffiliateProfile.pendingBalance + totalEarned
     * Update AffiliateClick.converted = true for the click that led to this order

3. Commission is in PENDING status for 14 days (fraud/refund protection)
   - After 14 days, a cron job (node-cron) automatically sets status = APPROVED
   - If the order is refunded: set commission status = REVERSED, deduct from pendingBalance

---

STOREFRONT — AFFILIATE SIGNUP:

1. Public page at /affiliates:
   - Hero section explaining the program ("Earn X% on every sale you refer")
   - How it works: 3-step visual (Get your link → Share it → Earn commission)
   - "Apply to Become an Affiliate" CTA button → /affiliates/apply

2. Application form at /affiliates/apply:
   - Requires login (redirect to /login?redirect=/affiliates/apply if not logged in)
   - Fields: Website/social media URL (optional), How do you plan to promote us? (textarea), PayPal email for payouts
   - Submit → Creates AffiliateProfile with status = PENDING
   - "Thanks! We'll review your application within 48 hours."
   - Sends notification email to admin (AdminNotificationPrefs.notifyNewAffiliateApp)

3. Affiliate Dashboard at /account/affiliate (tab in customer account):
   - Only shown if AffiliateProfile exists for this user
   - If status = PENDING: "Your application is under review"
   - If status = ACTIVE:

   STATS ROW:
   - Total Clicks | Total Conversions | Conversion Rate | Total Earned | Pending Balance

   REFERRAL LINK BOX:
   - Your link: [siteUrl]/?ref=[referralCode]
   - Copy-to-clipboard button
   - "Or use your code: [referralCode]" (can be added to any URL as ?ref=CODE)
   - QR code of the referral link (generated client-side via qrcode.react library)

   COMMISSION HISTORY table:
   - Order # | Date | Order Amount | Commission % | Commission Earned | Status (Pending/Approved/Paid/Reversed)

   PAYOUT REQUEST:
   - "Request Payout" button (available when approved balance ≥ minimum payout threshold, default €20)
   - Creates a PayoutRequest record, notifies admin
   - Admin processes manually and marks as paid

---

ADMIN PORTAL ADDITIONS:

Add /admin/affiliates page with two tabs:

TAB 1 — APPLICATIONS:
- List of PENDING affiliate applications
- Click → review modal: see all fields, approve (set status=ACTIVE, set commissionRate) or reject (send email)
- Approve modal: custom commission rate field (override default), welcome message to include in email

TAB 2 — ACTIVE AFFILIATES:
- Table: Name, Code, Commission Rate, Total Clicks, Conversions, Conv. Rate, Total Earned, Pending Balance
- Click → Affiliate detail:
  * Edit commission rate
  * View all clicks and commissions
  * Payout history
  * "Mark payout as sent" (records payment, zeroes pendingBalance)
  * Suspend / Reactivate

Add to Admin Settings:
- Affiliate Program Enable/Disable toggle
- Default commission rate (%)
- Minimum payout threshold (€)
- Commission hold period (days, default 14)
- Auto-approval toggle (skip manual review)
```

---

## TASK S3 — Abandoned Cart Recovery

**What's missing:** If a customer adds items to their cart but never completes checkout, there's no follow-up. Abandoned cart emails recover 5–15% of lost sales.

**Prompt for Replit AI:**

```
Build an abandoned cart recovery system that emails customers who leave without checking out.

---

PRISMA SCHEMA — Add:

model AbandonedCart {
  id            Int      @id @default(autoincrement())
  userId        Int?     @relation(...)  (null for guests who entered email at checkout)
  email         String   (the customer's email — saved when they enter it at checkout step 1)
  cartSnapshot  Json     (serialized cart items: [{productId, name, price, qty, imageUrl}])
  cartTotal     Decimal
  recoveryToken String   @unique  (used in email link to restore cart)
  status        AbandonedCartStatus @default(PENDING)
  email1SentAt  DateTime?  (first email sent at ~1 hour after abandonment)
  email2SentAt  DateTime?  (second email sent at ~24 hours)
  email3SentAt  DateTime?  (third email sent at ~72 hours — with discount offer)
  recoveredAt   DateTime?  (when customer clicked the recovery link and completed purchase)
  recoveredOrderId Int?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

enum AbandonedCartStatus { PENDING EMAIL1_SENT EMAIL2_SENT EMAIL3_SENT RECOVERED UNSUBSCRIBED }

---

CART CAPTURE LOGIC:

1. In the checkout form (Task 9), as soon as the customer types their email address:
   - Debounced 2 seconds after typing stops
   - POST /api/checkout/capture-cart with { email, cartItems, cartTotal }
   - Creates or updates an AbandonedCart record for this email
   - Generate a unique recoveryToken (crypto.randomBytes(32).toString('hex'))
   - If the customer completes checkout → mark AbandonedCart.status = RECOVERED

2. If the customer is already logged in: capture cart immediately when items are added to cart (no need to wait for checkout)

---

RECOVERY EMAIL SEQUENCE (triggered by node-cron job running every 15 minutes):

The cron job checks for AbandonedCarts where:
- status = PENDING and createdAt was > 1 hour ago → send Email 1
- status = EMAIL1_SENT and email1SentAt was > 23 hours ago → send Email 2
- status = EMAIL2_SENT and email2SentAt was > 48 hours ago → send Email 3

EMAIL 1 (1 hour later) — Subject: "You left something behind 🛒"
- Warm, friendly tone
- Shows the abandoned cart items with images, names, prices
- "Complete your order" CTA button → links to /cart/recover/[recoveryToken]
- No discount offered yet

EMAIL 2 (24 hours later) — Subject: "Still thinking it over? Your cart is saved"
- Slightly more urgent
- Shows items again
- "Your items are selling fast" social proof line
- "Complete your order" CTA

EMAIL 3 (72 hours later) — Subject: "Last chance — here's 10% off your cart"
- Auto-generates a single-use discount code (10% off, this customer only, 48-hour expiry)
- Shows items + the discount code prominently
- "Use code [CODE] at checkout" — "Complete your order" CTA

Each email has an unsubscribe link → POST /api/cart/recovery/unsubscribe → sets status = UNSUBSCRIBED (no more emails sent for this email address)

---

CART RECOVERY PAGE at /cart/recover/[token]:

1. Validate the token → load AbandonedCart record
2. If not found or already RECOVERED: show "This link has expired."
3. If valid:
   - Restore the cart items into the current session/Zustand store
   - Redirect to /cart with a toast: "Your saved cart has been restored! Complete your order below."
4. When the customer completes an order after clicking recovery link:
   - POST /api/cart/recovery/mark-recovered → sets AbandonedCart.recoveredAt, recoveredOrderId, status = RECOVERED

---

ADMIN PORTAL ADDITIONS:

Add an "Abandoned Carts" section to /admin/analytics or as a standalone tab in /admin/orders:
- Stats: Total Abandoned (this month) | Recovered (this month) | Recovery Rate % | Revenue Recovered
- Table: Email | Cart Value | Items | Abandoned At | Status | Emails Sent | Recovered?
- Click row → see cart snapshot, email sequence log
- "Send Recovery Email Now" button (manually trigger the next email in sequence)
- "Mark as Recovered Manually" button

Add to Admin Settings (A34 — Notification Preferences or A35):
- Abandoned Cart Recovery toggle (enable/disable the entire system)
- Email 1 delay — hours (default: 1)
- Email 2 delay — hours (default: 24)
- Email 3 delay — hours (default: 72)
- Email 3 discount percentage (default: 10%)
- Minimum cart value to trigger recovery (default: €0 — all carts)
```

---

## TASK S4 — Price Drop Alerts & Back-in-Stock Notifications

**What's missing:** No way for customers to subscribe to get notified when a product's price drops or when an out-of-stock product becomes available. This drives return visits.

**Prompt for Replit AI:**

```
Build price drop alert and back-in-stock notification subscriptions.

---

PRISMA SCHEMA — Add:

model ProductAlert {
  id          Int        @id @default(autoincrement())
  email       String
  productId   Int        @relation(...)
  type        AlertType
  priceAtSubscription Decimal?  (current price when they subscribed — for price drop comparison)
  notifiedAt  DateTime?  (when the alert email was sent; null = not yet sent)
  createdAt   DateTime   @default(now())

  @@unique([email, productId, type])
}

enum AlertType { BACK_IN_STOCK PRICE_DROP }

---

PRODUCT PAGE INTEGRATION (Task 7):

1. BACK-IN-STOCK BUTTON:
   When a product's stock = 0 (out of stock), instead of/below the "Add to Cart" button show:
   - "Notify Me When Available" button
   - Click → opens a small modal:
     * If logged in: email pre-filled with account email
     * If not logged in: email input field
     * "Notify Me" button → POST /api/alerts/subscribe { productId, email, type: "BACK_IN_STOCK" }
     * "You'll be notified at [email] when this product is back in stock."
     * Deduplicates: if already subscribed, show "You're already on the waitlist for this product."

2. PRICE DROP ALERT (shown on all products regardless of stock):
   - "🔔 Alert me if the price drops" link (small, below price)
   - Click → same modal with type: "PRICE_DROP" and records priceAtSubscription = current price

---

NOTIFICATION TRIGGERS:

Back-in-stock:
- When a product sync from Metenzi runs (Task A4) and a product's stock goes from 0 to > 0:
  → Find all ProductAlerts for this productId with type = BACK_IN_STOCK and notifiedAt = null
  → Send "Back in Stock" email to each subscriber
  → Set notifiedAt = now()
  → Email: "Good news! [Product Name] is back in stock. Get it before it sells out again." + "Shop Now" button

Price drop:
- When a product sync runs and a product's price is lower than stored priceAtSubscription:
  → Find all ProductAlerts for this productId with type = PRICE_DROP and notifiedAt = null
    AND priceAtSubscription > currentPrice
  → Send "Price Drop" email: "The price of [Product Name] just dropped from €X to €Y — save €Z today!" + "Buy Now" button
  → Set notifiedAt = now() (customer gets one notification per price drop; if price drops again later, trigger again by checking notifiedAt is > 7 days ago)

Add "back_in_stock" and "price_drop" to the EmailTemplate system (Task A29).

---

CUSTOMER ACCOUNT:

Add a "My Alerts" tab to /account:
- Table: Product (with thumbnail) | Alert Type | Price When Subscribed | Current Price | Status (Pending/Notified)
- "Remove" button per alert
- "Add Alert" button → opens product search to subscribe to new alerts

---

ADMIN PORTAL ADDITIONS:

Add a section in /admin/products listing:
- Per-product: show count of back-in-stock subscribers (shown as a badge e.g. "47 waiting")
- Clicking the badge → modal showing all subscriber emails for that product
- "Send Manual Notification" button → manually trigger the back-in-stock email for a specific product (useful if you want to notify before a product sync runs)
```

---

## TASK S5 — Product Q&A Section

**What's missing:** Customers often have questions before buying (e.g. "Does this work on Windows 11?"). A Q&A section on product pages reduces support tickets and increases conversion.

**Prompt for Replit AI:**

```
Add a Question & Answer section to every product page.

---

PRISMA SCHEMA — Add:

model ProductQuestion {
  id          Int       @id @default(autoincrement())
  productId   Int       @relation(...)
  askedBy     Int?      @relation(...)  (User id; null for guest questions)
  askerEmail  String    (stored for notification)
  askerName   String
  questionText String
  isPublic    Boolean   @default(false)  (only shown publicly after admin approves)
  createdAt   DateTime  @default(now())

  answers     ProductAnswer[]
}

model ProductAnswer {
  id          Int       @id @default(autoincrement())
  questionId  Int       @relation(...)
  answeredBy  Int?      @relation(...)  (User id — null for admin answers)
  answererName String   (displayed name; "Store Admin" for admin answers)
  isAdminAnswer Boolean @default(false)  (admin answers shown with a verified badge)
  answerText  String
  isPublic    Boolean   @default(false)  (public after admin approves)
  createdAt   DateTime  @default(now())
}

---

PRODUCT PAGE — Q&A SECTION (below reviews section, Task 7):

SECTION HEADER: "Questions & Answers" + count of approved Q&As

EXISTING Q&As LIST:
- Shows all approved questions (isPublic = true) with their approved answers
- Each question: askerName + date + questionText
- Below each question: admin answer (with "✓ Store Admin" badge) or community answers
- "Was this helpful?" thumbs up (tracks helpfulness, not stored — just UX)
- Pagination: show 5 Q&As, "Load More" button

ASK A QUESTION FORM:
- "Have a question about this product?" section at the bottom
- Fields:
  * Your Name * — text input (pre-filled if logged in)
  * Email * — text input (pre-filled if logged in; not shown publicly)
  * Your Question * — textarea (min 10 chars)
- "Submit Question" button → POST /api/products/[id]/questions
  * Creates ProductQuestion with isPublic = false (pending moderation)
  * Sends admin notification email: "New question on [Product Name]: [question text]"
  * Shows success: "Your question has been submitted! We'll answer it soon."

---

ADMIN PORTAL ADDITIONS:

Add a "Q&A" section inside the product edit page (/admin/products/[id]/edit), OR a global "Q&A" page at /admin/qa.

Q&A MANAGEMENT:
- Table: Product | Question | Asked By | Date | Status (Pending/Public/Rejected) | Answers Count
- Filter by: Pending | Approved | All products or specific product
- Click question → opens Q&A moderation modal:
  * See full question text
  * "Make Public" / "Reject" / "Delete" buttons
  * ANSWER FORM:
    - Answer text — textarea
    - "Post as Store Admin" button → creates ProductAnswer with isAdminAnswer = true, isPublic = true
    - Automatically makes the question isPublic = true when an admin answer is posted
    - Sends email to askerEmail: "Your question about [Product Name] has been answered!" + the answer text

Dashboard badge: Add "Pending Q&A" count to the admin dashboard (A2) notification badges.
```

---

## TASK S6 — Newsletter Subscription & Marketing Emails

**What's missing:** No newsletter signup, no way to send marketing emails to customers, no integration with email marketing platforms.

**Prompt for Replit AI:**

```
Build a newsletter subscription system with optional Mailchimp integration.

---

PRISMA SCHEMA — Add:

model NewsletterSubscriber {
  id            Int       @id @default(autoincrement())
  email         String    @unique
  name          String?
  isConfirmed   Boolean   @default(false)  (double opt-in: true after clicking confirm link)
  confirmToken  String?   @unique
  source        String?   (where they signed up: "footer", "popup", "checkout", "account")
  tags          String[]  (e.g. ["customer", "newsletter"])
  unsubscribed  Boolean   @default(false)
  unsubscribedAt DateTime?
  createdAt     DateTime  @default(now())
}

---

STOREFRONT NEWSLETTER SIGNUP LOCATIONS:

1. FOOTER SIGNUP (all pages):
   - "Subscribe to our newsletter for exclusive deals and product updates"
   - Email input + "Subscribe" button
   - POST /api/newsletter/subscribe { email, source: "footer" }

2. EXIT-INTENT POPUP:
   - Triggered when mouse moves toward the top of the browser window (mouseleave on document)
   - Only shown once per session (sessionStorage flag)
   - Only shown to visitors who haven't subscribed (check cookie "newsletter_subscribed")
   - Small centered modal with dismiss X:
     * "Wait! Get 10% off your first order"
     * Email input + "Claim Discount" button
     * On subscribe: also generates a first-order discount code (10% off, single-use, 7-day expiry) and shows it in a success message
     * Set sessionStorage + cookie to not show again

3. CHECKOUT SIGNUP:
   - On the checkout form (Task 9), add a pre-checked checkbox:
     "✓ Subscribe to our newsletter for exclusive deals" (GDPR note: unchecked by default in EU mode if Tax/VAT EU mode is enabled — configurable in settings)
   - If checked on order completion: subscribe their email with source: "checkout", isConfirmed: true (no need for double opt-in since they're completing a transaction)

4. ACCOUNT PAGE:
   - "Newsletter" toggle in account settings tab
   - Shows current subscription status
   - Toggle ON/OFF to subscribe/unsubscribe

---

DOUBLE OPT-IN FLOW (footer + popup subscriptions):
1. Subscribe → create NewsletterSubscriber with isConfirmed = false + generate confirmToken
2. Send confirmation email: "Confirm your subscription" → link to /newsletter/confirm/[token]
3. /newsletter/confirm/[token]: sets isConfirmed = true, shows "You're subscribed!" + optional discount code
4. Add "newsletter_confirm" to EmailTemplate system (Task A29)

UNSUBSCRIBE:
- All marketing emails include an Unsubscribe link → /newsletter/unsubscribe/[token]
- Sets unsubscribed = true, unsubscribedAt = now()
- One-click unsubscribe (no confirmation page needed, per GDPR/CAN-SPAM)

---

MAILCHIMP INTEGRATION (optional, configured from admin settings):

Add to Admin Settings (A17 — General tab or new tab):
- Mailchimp API Key — password input (stored encrypted in DB)
- Mailchimp Audience/List ID — text input
- "Sync subscribers to Mailchimp" toggle

When sync is enabled:
- On new confirmed subscription: POST to Mailchimp API (members endpoint) to add subscriber
- On unsubscribe: PATCH Mailchimp member status to "unsubscribed"
- "Sync All Subscribers Now" button → bulk exports all confirmed, non-unsubscribed emails to Mailchimp

If Mailchimp is not configured: subscribers are stored only in local DB and can be exported as CSV.

---

ADMIN PORTAL ADDITIONS:

Add /admin/newsletter page:
- Stats row: Total Subscribers | Confirmed | Unsubscribed | Subscribed This Month
- Subscriber table: Email | Name | Source | Confirmed | Subscribed On | Tags | Unsubscribed?
- Filter: All / Confirmed / Unconfirmed / Unsubscribed
- "Export CSV" button (confirmed subscribers only for marketing use)
- "Delete" per subscriber (for GDPR right-to-erasure requests)
- "Send Confirmation Email" re-send button for unconfirmed subscribers
- If Mailchimp sync is enabled: "Sync to Mailchimp" button + last sync timestamp
```

---

## TASK S7 — Flash Sales with Countdown Timers

**What's missing:** No time-limited sale mechanism with visible countdown timers. Flash sales create urgency and significantly boost conversion rates on digital product stores.

**Prompt for Replit AI:**

```
Build a Flash Sale system with configurable countdown timers shown on product pages, category listings, and a dedicated Flash Sale page.

---

PRISMA SCHEMA — Add:

model FlashSale {
  id              Int      @id @default(autoincrement())
  name            String   (internal label, e.g. "Weekend Flash Sale")
  bannerTitle     String   (shown on storefront, e.g. "⚡ Flash Sale — Ends in:")
  bannerSubtitle  String?  (e.g. "Up to 60% off — limited time only!")
  startsAt        DateTime
  endsAt          DateTime
  isActive        Boolean  @default(true)
  showCountdown   Boolean  @default(true)
  products        FlashSaleProduct[]
  createdAt       DateTime @default(now())
}

model FlashSaleProduct {
  id            Int      @id @default(autoincrement())
  flashSaleId   Int      @relation(...)
  productId     Int      @relation(...)
  salePrice     Decimal  (the flash sale price)
  originalPrice Decimal  (shown as strikethrough; fetched from Product.price at time of creation)
  maxQuantity   Int?     (optional: limit total units sold at flash price; null = unlimited)
  soldCount     Int      @default(0)
}

---

STOREFRONT — FLASH SALE BANNER:

1. When a FlashSale is active (startsAt <= now <= endsAt, isActive = true):
   - Show a full-width announcement bar ABOVE the header (or as the top section of homepage):
     * "[bannerTitle] [COUNTDOWN TIMER] [bannerSubtitle]"
     * Countdown timer: real-time HH:MM:SS countdown rendered client-side
     * "Shop Now" button → /flash-sale
   - Banner is sticky — stays visible when scrolling (or can be dismissed)

2. DEDICATED FLASH SALE PAGE at /flash-sale:
   - If no active flash sale: "No flash sales right now — check back soon!"
   - If active: show all FlashSaleProducts in a grid
     * Each product card shows: sale price (big, red), original price (strikethrough), % saved badge
     * Countdown timer on the page header: "Sale ends in: HH:MM:SS"
     * If maxQuantity is set: progress bar showing "X of Y sold" or "Only N left!"
   - Sort by: Biggest Discount | Lowest Price | Name
   - SEO: generateMetadata with sale-specific title and description (from bannerTitle + bannerSubtitle)

3. PRODUCT PAGES during flash sale:
   - If the product is part of an active flash sale:
     * Replace the price display with: flash sale price (large, red) + original price (strikethrough)
     * Add a red countdown badge below the price: "⚡ Flash price ends in: HH:MM:SS"
     * If maxQuantity is set: "Only [N] left at this price!" urgency badge

4. PRODUCT LISTING PAGES (category, search, etc.):
   - Flash sale products in listings get a "FLASH SALE" badge on their card
   - Show sale price + original price strikethrough

5. PRICING LOGIC:
   - In the pricing calculation function, when building cart/checkout prices:
     * Check if any item is in an active FlashSaleProduct
     * If yes AND soldCount < maxQuantity (or maxQuantity is null): use salePrice instead of regular price
     * This overrides all other discounts? (or is additive — configurable in admin)
   - When an order containing flash sale items is completed:
     * Increment FlashSaleProduct.soldCount for each unit sold
     * If soldCount >= maxQuantity: product is no longer at flash price (show as "Sold Out" of flash deal)

---

CLIENT-SIDE COUNTDOWN TIMER COMPONENT:

Create a reusable <CountdownTimer endsAt={Date} /> React component:
- Renders: "02:14:37" (HH:MM:SS) or "2d 14h 37m" for sales > 24 hours away
- Updates every second using setInterval
- When timer reaches 0: shows "Sale Ended" and triggers a page refresh after 3 seconds to revert prices
- Used in: flash sale banner, /flash-sale page, product pages

---

ADMIN PORTAL ADDITIONS:

Add /admin/flash-sales page:
- List of all flash sales (past and upcoming): Name | Start | End | Products | Status | Actions
- "New Flash Sale" button → /admin/flash-sales/new

CREATE / EDIT FORM:
- Internal Name, Banner Title, Banner Subtitle
- Start Date-Time picker, End Date-Time picker
- Show Countdown toggle
- Active toggle

PRODUCTS TABLE:
- Add products via search (search by name, add to table)
- Per product row: Product name | Original Price (auto-filled) | Flash Sale Price * | Max Quantity (optional) | Sold Count (readonly)
- Drag-to-reorder products in the flash sale page
- "Remove" button per product

LIVE PREVIEW button: shows a modal with a simulated version of the flash sale banner as it will appear.
```

---

## TASK S8 — Social Login (Google OAuth)

**What's missing:** Customers can only log in with email + password. Adding Google sign-in removes friction and significantly improves conversion at registration.

**Prompt for Replit AI:**

```
Add Google OAuth sign-in alongside the existing credentials-based login using NextAuth.js.

---

SETUP:

1. Install: next-auth is already installed. No new packages needed.

2. Google OAuth credentials:
   - Add to .env.example: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
   - These are obtained from Google Cloud Console → APIs & Services → Credentials
   - Add instructions in .env.example: "# Get from console.cloud.google.com"
   - Store in DB (like other API keys) for admin management: add GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET fields to SiteSettings with the masked/reveal UI (like A18)

3. In /app/api/auth/[...nextauth]/route.ts — add GoogleProvider:

   providers: [
     GoogleProvider({
       clientId: process.env.GOOGLE_CLIENT_ID ?? await getGoogleClientId(), // fetches from DB
       clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? await getGoogleClientSecret(),
     }),
     CredentialsProvider({ ... })  // existing
   ]

4. Update NextAuth callbacks:
   - signIn callback: if provider === "google":
     * Check if User with this email already exists
     * If exists AND has no googleId: link accounts (set googleId on existing user)
     * If exists AND already has googleId: allow sign in
     * If doesn't exist: create new User (name from Google profile, emailVerified = now(), no password)
   - Update User model: add googleId String? @unique, emailVerified DateTime?

---

STOREFRONT — LOGIN & REGISTRATION PAGES:

On /login page — add above the email/password form:
  [Google icon] "Continue with Google" button → triggers NextAuth signIn("google")

On /register page — add above the registration form:
  [Google icon] "Sign up with Google" button
  "--- or register with email ---" divider below

Button styling: white background, Google multi-color G icon (use SVG), "Continue with Google" text, subtle border, hover shadow. Use the exact Google button design guidelines.

---

ACCOUNT LINKING:

On /account/settings tab, add a "Connected Accounts" section:
- Shows: "Google: [google email] ✓ Connected" / "Google: Not connected — Link account" button
- "Link Google Account" → triggers the OAuth flow and links on return
- "Unlink Google Account" → removes googleId from User (only allowed if user has a password set; otherwise show error "You must set a password before unlinking Google")
- "Set Password" option for Google-only accounts (no password currently): shows a "Set a Password" form in account settings

---

ADMIN PORTAL ADDITIONS:

In /admin/settings Tab 2 (API Keys, Task A18) — add a new card:
  "Google OAuth"
  - Google Client ID — masked input (same pattern as Metenzi/Checkout.com keys)
  - Google Client Secret — masked input
  - "Test Connection" button → attempts to construct the OAuth URL and validates the credentials
  - "Enable Google Login" toggle
```

---

## TASK S9 — Loyalty Points & Rewards Program

**What's missing:** No incentive for repeat purchases. A points/rewards system increases customer lifetime value and encourages customers to come back.

**Prompt for Replit AI:**

```
Build a Loyalty Points system where customers earn points on every purchase and can redeem them for discounts.

---

PRISMA SCHEMA — Add:

model LoyaltyAccount {
  id          Int      @id @default(autoincrement())
  userId      Int      @unique @relation(...)
  pointsBalance Int    @default(0)  (current redeemable points)
  totalEarned Int      @default(0)
  totalRedeemed Int    @default(0)
  tier        LoyaltyTier @default(BRONZE)
  createdAt   DateTime @default(now())

  transactions LoyaltyTransaction[]
}

model LoyaltyTransaction {
  id          Int       @id @default(autoincrement())
  accountId   Int       @relation(...)
  orderId     Int?      @relation(...)
  type        LoyaltyTxType
  points      Int       (positive = earned, negative = redeemed/expired)
  description String    (e.g. "Earned for order #1234", "Redeemed for €5 discount", "Welcome bonus")
  expiresAt   DateTime? (points can expire if admin enables expiry)
  createdAt   DateTime  @default(now())
}

enum LoyaltyTxType { EARNED_ORDER EARNED_REVIEW EARNED_REFERRAL EARNED_WELCOME REDEEMED EXPIRED ADMIN_ADJUSTMENT }
enum LoyaltyTier { BRONZE SILVER GOLD PLATINUM }

---

LOYALTY SETTINGS (add to Admin Settings as a new tab or section):

- Enable Loyalty Program — toggle (default: off)
- Points earned per €1 spent — number input (default: 10 points per €1)
- Points value — "X points = €1" — number input (default: 100 points = €1)
- Minimum points to redeem — number input (default: 500 points)
- Maximum redemption per order (%) — number input (default: 50% of order value)
- Point expiry — number input in months (0 = never expire)
- Welcome bonus — number input (points given on first account creation, default: 100)
- Review bonus — points given for leaving an approved product review (default: 50)
- Tier thresholds:
  * Bronze: 0+ points earned (always)
  * Silver: 1,000+ total points earned
  * Gold: 5,000+ total points earned
  * Platinum: 15,000+ total points earned
- Tier benefits (configurable multipliers):
  * Silver: 1.25× points earned
  * Gold: 1.5× points earned
  * Platinum: 2× points earned + free shipping on all orders

---

POINTS EARNING LOGIC:

1. On order completion (order.fulfilled webhook):
   - Calculate points: Math.floor(order.totalAmount × pointsPerEuro × tierMultiplier)
   - Create LoyaltyTransaction: type = EARNED_ORDER, points = +N, expiresAt = now + expiryMonths
   - Update LoyaltyAccount.pointsBalance += N, totalEarned += N
   - Re-evaluate tier based on new totalEarned, update LoyaltyAccount.tier if changed
   - If tier increased: send "You've reached [Tier] status!" email

2. On account creation:
   - Create LoyaltyAccount for the new user
   - If welcome bonus > 0: add EARNED_WELCOME transaction

3. On review approved (Task A14):
   - If review author has a LoyaltyAccount: add EARNED_REVIEW transaction

---

STOREFRONT — CHECKOUT REDEMPTION:

In the checkout page (below coupon code and gift card fields), add "Use Loyalty Points" section:
- "You have [N] points (worth €X.XX)" — only shown for logged-in users with redeemable balance
- Slider or input: "Use [_____] points — saves €[X.XX]"
  * Minimum: min redemption threshold
  * Maximum: lesser of (full balance OR maximum redemption % of order total)
- "Apply" button → deducts from order total
- Shows as line item: "Loyalty Points (500 pts): −€5.00"
- Points are only actually deducted from LoyaltyAccount when the order is COMPLETED (not at checkout time — to handle abandonment)

---

STOREFRONT — LOYALTY DASHBOARD:

Add a "Rewards" tab to /account:
- TIER BADGE: Bronze/Silver/Gold/Platinum with icon + description of current tier benefits
- PROGRESS TO NEXT TIER: progress bar (e.g. "3,200 / 5,000 points to Gold")
- POINTS BALANCE: large number display + "= €X.XX value"
- HOW TO EARN: mini infographic (buy products → earn points, leave reviews → earn points, etc.)
- TRANSACTION HISTORY table: Date | Description | Points | Running Balance | Expiry
  * Points with upcoming expiry are highlighted in amber: "⚠ 200 points expire in 14 days"
- REDEEM section: mirrors the checkout redemption UX, let customer see what they can redeem

---

Show a small "🏆 [N] pts" badge on each product card showing estimated points earned.

---

ADMIN PORTAL:

Add a "Loyalty" tab inside /admin/customers/[id] customer detail page:
- Current tier, balance, total earned, total redeemed
- Transaction history
- "Manual Adjustment" button: add or subtract points with a reason (type = ADMIN_ADJUSTMENT)

Add a "Loyalty Overview" widget to /admin/analytics:
- Total points in circulation | Total redeemed (€ value) | Active accounts | Points expiring this month
```

---

## TASK S10 — Product Bundles

**What's missing:** No way to create product bundles (e.g. "Windows 11 + Office 365 bundle at €X"). Bundles increase average order value significantly.

**Prompt for Replit AI:**

```
Build a Product Bundle system: curated groups of products sold together at a bundle price.

---

PRISMA SCHEMA — Add:

model Bundle {
  id              Int      @id @default(autoincrement())
  name            String   (e.g. "Ultimate Office Bundle")
  slug            String   @unique
  description     String?
  imageUrl        String?
  bundlePrice     Decimal  (the special bundle price — less than sum of individual prices)
  isActive        Boolean  @default(true)
  showOnHomepage  Boolean  @default(false)
  sortOrder       Int      @default(0)
  seoTitle        String?
  seoDescription  String?
  createdAt       DateTime @default(now())

  items           BundleItem[]
}

model BundleItem {
  id        Int    @id @default(autoincrement())
  bundleId  Int    @relation(...)
  productId Int    @relation(...)
  quantity  Int    @default(1)
  sortOrder Int    @default(0)
}

---

STOREFRONT — BUNDLE PAGE at /bundles/[slug]:

HEADER:
- Bundle name (h1) + description
- Bundle image (or auto-generated collage of product images)

BUNDLE CONTENTS:
- Visual list of all included products:
  * Product thumbnail + name + individual retail price (strikethrough)
  * Quantity badge if quantity > 1
- "What's included" feels like a checklist ✓

PRICING:
- Individual total: €X.XX (sum of all product retail prices, strikethrough in grey)
- Bundle price: €Y.YY (large, green)
- You save: €Z.ZZ (X% off) — shown as a badge

"Add Bundle to Cart" button:
- Adds all bundle items to the cart as a single BundleCartItem group
- In the cart: shown as a collapsible bundle group "Ultimate Office Bundle — €Y.YY" with expand toggle to see individual items
- Discount applied is shown as a single "Bundle Discount: −€Z.ZZ" line item

SEO: generateMetadata using seoTitle/seoDescription (Task 19)

---

BUNDLES LISTING PAGE at /bundles:
- All active bundles in a grid
- Card: bundle image, name, included products (up to 4 thumbnails stacked), individual total (strikethrough), bundle price, savings badge
- "Shop Bundle" → /bundles/[slug]
- Link in main navigation under "Deals" or similar

---

CROSS-SELL INTEGRATION:
On product pages (Task 7), if the product is part of any active bundle:
- Show a "📦 Also available as part of [Bundle Name] — Save €X" callout box
- Click → /bundles/[slug]

---

HOMEPAGE SECTION:
In the HomepageSection manager (Task A28), add a new section type: FEATURED_BUNDLES
- Shows 2–3 featured bundles in a row with bundle cards
- Configurable: select which bundles to feature

---

ADMIN PORTAL at /admin/bundles:

LIST: Name | Slug | Bundle Price | Individual Total | Savings | Active | Homepage? | Actions

CREATE / EDIT form:
- Bundle Name, Slug (auto-generated from name, editable)
- Description — TipTap editor
- Bundle Price * — number input
- Show on Homepage — toggle
- Image URL — input

PRODUCTS TABLE:
- Search + add products
- Per row: Product | Individual Price | Quantity (number input) | Sort (drag handle) | Remove
- Auto-calculated: "Individual total: €X.XX | Bundle saves: €Y.YY (Z%)"

SEO tab: SEO Title, SEO Description inputs
```

---

## TASK S11 — Customer Support Ticket System

**What's missing:** Customers can only contact support via email or through Metenzi claims. A proper built-in ticket system centralises support, tracks resolution times, and reduces missed queries.

**Prompt for Replit AI:**

```
Build a customer support ticket system integrated with the storefront and admin portal.

---

PRISMA SCHEMA — Add:

model SupportTicket {
  id            Int          @id @default(autoincrement())
  ticketNumber  String       @unique  (auto-generated: "TKT-00001", zero-padded)
  userId        Int?         @relation(...)
  guestEmail    String?
  guestName     String?
  subject       String
  category      TicketCategory
  status        TicketStatus @default(OPEN)
  priority      TicketPriority @default(NORMAL)
  orderId       Int?         @relation(...)  (optional: linked to a specific order)
  assignedToId  Int?         @relation(...)  (admin user assigned to handle this ticket)
  resolvedAt    DateTime?
  closedAt      DateTime?
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  messages      TicketMessage[]
}

model TicketMessage {
  id          Int      @id @default(autoincrement())
  ticketId    Int      @relation(...)
  senderId    Int?     @relation(...)  (null for guest messages)
  senderName  String
  senderEmail String
  isAdminReply Boolean @default(false)
  body        String   @db.Text
  attachments Json?    (array of {filename, url} — for future file attachment support)
  createdAt   DateTime @default(now())
}

enum TicketCategory { ORDER_ISSUE KEY_NOT_WORKING BILLING REFUND_REQUEST GENERAL_INQUIRY TECHNICAL_SUPPORT OTHER }
enum TicketStatus { OPEN WAITING_CUSTOMER WAITING_ADMIN IN_PROGRESS RESOLVED CLOSED }
enum TicketPriority { LOW NORMAL HIGH URGENT }

---

STOREFRONT — SUBMIT A TICKET at /support/new:

FORM:
- Your Name * (pre-filled if logged in)
- Email * (pre-filled if logged in)
- Category * — dropdown (Order Issue | Key Not Working | Billing | Refund Request | General Inquiry | Technical Support | Other)
- Related Order Number — text input (optional; validates against DB if provided)
- Subject * — text input
- Message * — textarea (min 20 chars)
- "Submit Ticket" button → POST /api/support/tickets

On submit:
- Generate ticketNumber (TKT-00001, incremented)
- Create SupportTicket + first TicketMessage from customer
- Send confirmation email to customer: "Your ticket [TKT-00001] has been received — Subject: [subject]. We'll respond within 24 hours."
- Notify admin (AdminNotificationPrefs.notifyNewTicket)

---

STOREFRONT — TICKET DETAIL at /support/tickets/[ticketNumber]:

- Shows full ticket header: ticket #, category, status badge, created date
- MESSAGE THREAD: chronological list of all messages
  * Each message shows: avatar (initials), sender name + "Admin" badge if isAdminReply, timestamp, body
  * Admin replies have a distinct background color (light blue)
- "REPLY" form at the bottom (for customer to reply):
  * Textarea + "Send Reply" button
  * POST /api/support/tickets/[id]/messages
  * Sends notification to admin: "Customer replied to ticket [TKT-00001]"
- Status indicator: if status = RESOLVED → "This ticket has been marked as resolved. Was this helpful? [Yes / No — Reopen]"
  * "No / Reopen" → sets status back to OPEN

---

CUSTOMER ACCOUNT — MY TICKETS tab at /account/support:

- Table: Ticket # | Subject | Category | Status | Last Updated
- Filter: Open / Resolved / All
- Click → /support/tickets/[ticketNumber]
- "Open New Ticket" button

---

ADMIN PORTAL at /admin/support:

QUEUE VIEW:
- List of all tickets with columns: # | Subject | Customer | Category | Priority | Status | Assigned To | Created | Last Activity
- Filter by: Status | Category | Priority | Assigned To | Date Range
- Colour-coded status badges: OPEN=red, WAITING_CUSTOMER=amber, RESOLVED=green
- Sort by: Newest | Oldest | Priority | Last Activity
- Summary stats at top: Open | Waiting Customer | Resolved Today | Avg Response Time

TICKET DETAIL at /admin/support/[id]:

- Full message thread (same as customer view but with all context)
- ADMIN REPLY FORM:
  * Rich text textarea (supports markdown)
  * "Send & set status to Waiting Customer" button (default)
  * "Send & Resolve Ticket" button
  * "Internal Note" toggle (sends a note visible only to admins, not to customer)
- Ticket metadata panel (right sidebar):
  * Status dropdown (change manually)
  * Priority dropdown
  * Assign to (admin user select)
  * Linked Order (click → opens order detail)
  * Customer info (name, email, order count, member since) — if logged in user
  * "Open Metenzi Claim" button (if order is linked and ticket is key-related → prefills claim form)
- TIMELINE: shows status changes with timestamps

Add "Support Tickets" section to the admin sidebar (under CUSTOMERS group).
Add pending ticket count badge to the admin sidebar item and top bar notification bell.
```

---

## TASK S12 — Post-Purchase Upsell Modal

**What's missing:** The storefront has a pre-checkout upsell box (Task 9 + A25), but nothing happens after the customer places an order. A post-purchase upsell (shown on the order complete page) has zero abandonment risk — the customer has already paid.

**Prompt for Replit AI:**

```
Add a post-purchase upsell modal shown on the order complete page (/order/[id]/success).

---

ADMIN CONFIGURATION (extend Task A25 — Checkout Upsell Manager):

In /admin/upsell, add a second section "Post-Purchase Upsell":

Fields:
- Enable Post-Purchase Upsell — toggle
- Upsell Product — product selector (search + select)
- Headline * — text input (e.g. "Complete your setup — add this before you leave!")
- Custom Price (optional) — if set, overrides the product's regular price in the modal
- Strikethrough Price (optional) — shown as original price (creates urgency)
- Urgency Message (optional) — text input (e.g. "This offer expires in 10 minutes!")
- Show countdown timer — toggle (if ON, shows a 10-minute countdown in the modal)
- Call to Action Text — text input (default: "Add to My Order")
- CTA Style — button color selector (Green / Blue / Red)
- Decline Text — text input (default: "No thanks, I don't need this")

---

ORDER COMPLETE PAGE INTEGRATION:

After the order summary is displayed on /order/[id]/success:
1. Wait 2 seconds (give customer time to see their order confirmation first)
2. Fetch GET /api/checkout/post-purchase-upsell → returns upsell config if enabled + product details
3. If enabled: display the Post-Purchase Upsell Modal:

MODAL DESIGN:
- Cannot be dismissed by clicking outside (must click Accept or Decline)
- Close X button is only shown after 5 seconds (prevents accidental closes)
- Layout:
  * Product image + name + description snippet
  * Original price (strikethrough) + special price (large, prominent)
  * Savings badge: "Save €X.XX!"
  * Headline text (from admin config)
  * Urgency message + optional countdown timer (HH:MM:SS, 10 minutes)
  * "[CTA Text]" button (full width, styled per CTA Style setting)
  * "[Decline Text]" link (small, grey, below button)

"ADD TO MY ORDER" FLOW:
- POST /api/orders/[id]/add-upsell { productId, price }
- Server:
  * Creates a NEW separate order for the upsell product (not modifying the original order)
  * Charges the Checkout.com payment method saved from the original checkout session
    (save Checkout.com paymentSourceId on the Order during initial checkout for this purpose)
  * Creates the new order in Metenzi API
  * Returns { success: true, newOrderId }
- On success: close modal, show toast "✓ [Product name] added! Check your email for the key."
- New order appears in customer's order history

"DECLINE" FLOW:
- Close modal, show nothing (no guilt-trip)
- Log that the upsell was shown but declined (for admin analytics)

---

ADMIN ANALYTICS (add to A25 upsell manager page):

Post-Purchase Upsell Stats:
- Times shown | Times accepted | Times declined | Conversion Rate | Revenue Generated
```

---

## TASK S13 — Multi-Language Support (i18n)

**What's missing:** The store is English-only. For a European-focused software key store (selling in EUR, PLN, CZK, HUF — as in the currency settings), supporting multiple languages is important.

**Prompt for Replit AI:**

```
Add multi-language support using next-intl, supporting English, Polish, Czech, German, and French as the initial five languages.

---

SETUP:

1. Install: npm install next-intl

2. Create /messages/ directory with one JSON file per locale:
   /messages/en.json  (English — source of truth)
   /messages/pl.json  (Polish)
   /messages/cs.json  (Czech)
   /messages/de.json  (German)
   /messages/fr.json  (French)

3. Configure next-intl in next.config.ts and middleware.ts:
   - Default locale: "en"
   - Supported locales: ["en", "pl", "cs", "de", "fr"]
   - URL strategy: /pl/... for non-default locales, / for English (prefix-except-default strategy)
   - Locale detection: from Accept-Language header on first visit, then stored in cookie

4. Wrap root layout with NextIntlClientProvider

---

TRANSLATION FILES:

Organise /messages/en.json with nested keys:
{
  "nav": { "home": "Home", "products": "Products", "cart": "Cart", "account": "Account", ... },
  "product": { "addToCart": "Add to Cart", "outOfStock": "Out of Stock", "reviews": "Reviews", ... },
  "checkout": { "title": "Checkout", "placeOrder": "Place Order", "cpp": "Customer Protection Program", ... },
  "account": { "orders": "My Orders", "wishlist": "Wishlist", "settings": "Settings", ... },
  "errors": { "required": "This field is required", "invalidEmail": "Invalid email address", ... },
  "common": { "save": "Save", "cancel": "Cancel", "loading": "Loading...", ... }
}

Translate all en.json strings into pl.json, cs.json, de.json, fr.json using accurate translations.

---

LANGUAGE SELECTOR:

Add a language selector to the site header (next to the currency selector from Task 5):
- Shows current language flag emoji + language name (e.g. 🇬🇧 EN)
- Dropdown with 5 language options (flag + full name)
- On select: navigate to the same page with the new locale prefix
- Store preference in cookie "NEXT_LOCALE" (handled by next-intl)

---

TRANSLATION THROUGHOUT THE APP:

Replace all hardcoded UI strings with useTranslations() calls:
- All page titles, button labels, form labels, error messages, placeholder text
- Email templates (Task A29): add a "Language" field to the email send logic — send emails in the customer's preferred language (store preferredLocale on the User model)
- Admin portal remains English-only (no need to translate admin UI)

---

SEO PER LOCALE:

In generateMetadata for each page: set locale-specific title and description
Add hreflang tags in the <head> pointing to all locale variants of each page:
  <link rel="alternate" hreflang="en" href="https://site.com/product/windows-11" />
  <link rel="alternate" hreflang="pl" href="https://site.com/pl/product/windows-11" />
  <link rel="alternate" hreflang="x-default" href="https://site.com/product/windows-11" />

---

ADMIN PORTAL:

Add a "Languages" tab to /admin/settings (extend the general settings):
- Enable/Disable each non-English language (e.g. disable Czech if not targeting that market)
- Default Language selector
- "Translation Editor" — a simple table UI where admin can override specific translation keys for custom branding
  (e.g. change "Add to Cart" to "Buy Now" across the entire site without editing JSON files)
  Stored in a LocaleOverride model in DB; merged with JSON translations at runtime.
```

---

## Feature Gap Summary — What Each Task Adds

| Task | Feature | Why It Matters |
|------|---------|---------------|
| S1 | Gift Cards | New revenue stream; viral gifting; zero inventory cost |
| S2 | Affiliate & Referral Program | Leverages customers as salespeople; performance-based growth |
| S3 | Abandoned Cart Recovery | Recovers 5–15% of lost sales automatically |
| S4 | Price Drop & Back-in-Stock Alerts | Brings customers back; increases purchase intent |
| S5 | Product Q&A | Reduces pre-sale uncertainty; lowers support volume |
| S6 | Newsletter & Marketing Emails | Direct customer channel; drives repeat purchases |
| S7 | Flash Sales with Countdown Timers | Creates urgency; boosts conversion during promotions |
| S8 | Google OAuth Login | Removes registration friction; increases signups |
| S9 | Loyalty Points & Rewards | Drives repeat purchases; increases customer lifetime value |
| S10 | Product Bundles | Increases average order value; simplifies buying decisions |
| S11 | Support Ticket System | Centralises support; improves resolution time; reduces email chaos |
| S12 | Post-Purchase Upsell Modal | Zero-risk upsell (order already placed); high conversion rate |
| S13 | Multi-Language (i18n) | Opens European markets; critical for PL/CZ/HU/DE customers |

**Total new storefront tasks: 13 (S1–S13)**
