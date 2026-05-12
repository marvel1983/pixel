/**
 * Seed reviews across all products (one-off populate).
 *
 *   pnpm --filter @workspace/scripts seed:reviews -- --dry-run    # preview only
 *   pnpm --filter @workspace/scripts seed:reviews                 # write
 *   pnpm --filter @workspace/scripts seed:reviews -- --product=799
 *
 * - Idempotent: skips products that already have any APPROVED review.
 * - Creates ~80 shadow reviewer users on first run (adminNotes='SEED_REVIEWER').
 * - Updates products.avgRating and reviewCount after inserting.
 */
import { db, pool } from "@workspace/db";
import { users, products, reviews } from "@workspace/db/schema";
import { eq, and, sql, isNull, count } from "drizzle-orm";
import bcrypt from "bcryptjs";

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const ONE_PRODUCT = (() => {
  for (const a of process.argv.slice(2)) {
    const m = a.match(/^--product=(\d+)$/);
    if (m) return Number(m[1]);
  }
  return null;
})();

// ---------- pools ----------

const FIRST_NAMES = [
  // US
  "John", "Michael", "James", "David", "Christopher", "Robert", "Joseph", "Thomas",
  "Daniel", "Andrew", "Brian", "Kevin", "Matthew", "Anthony", "Ryan", "Brandon",
  "Joshua", "Jacob", "Ethan", "Mason", "Tyler", "Aaron", "Benjamin", "Nathan",
  // UK
  "Oliver", "Harry", "Jack", "George", "Charlie", "Leo", "Freddie", "Theo",
  // French
  "Lucas", "Hugo", "Louis", "Jules", "Raphaël", "Arthur", "Maxime", "Antoine",
  // German
  "Maximilian", "Felix", "Jonas", "Lukas", "Niklas", "Lars", "Stefan", "Florian",
  // Italian
  "Marco", "Luca", "Andrea", "Giuseppe", "Davide", "Lorenzo", "Federico", "Matteo",
  // Spanish
  "Carlos", "Miguel", "Antonio", "Manuel", "Pablo", "Sergio", "Diego", "Javier",
  // Arabic
  "Ahmed", "Mohammed", "Ali", "Hassan", "Omar", "Khalid", "Youssef", "Tariq",
  // Female
  "Emma", "Olivia", "Sophia", "Charlotte", "Amelia", "Mia", "Isabella", "Camille",
  "Hannah", "Léa", "Anna", "Marie", "Sarah", "Laura", "Julia", "Lena",
];

const LAST_NAMES = [
  // US/UK
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Miller", "Davis", "Wilson",
  "Anderson", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Walker", "Hall",
  "Allen", "Young", "King", "Wright",
  // French
  "Dubois", "Bernard", "Petit", "Durand", "Moreau", "Laurent", "Simon", "Michel",
  // German
  "Müller", "Schmidt", "Schneider", "Fischer", "Weber", "Wagner", "Becker", "Hoffmann",
  // Italian
  "Rossi", "Russo", "Ferrari", "Esposito", "Bianchi", "Romano", "Ricci", "Marino",
  // Spanish
  "García", "Martínez", "López", "Sánchez", "González", "Rodríguez", "Fernández", "Pérez",
  // Arabic
  "Hassan", "Mahmoud", "Hussein", "Ibrahim", "Karim", "Saleh", "Aziz", "Rahman",
];

type CatBucket =
  | "antivirus"
  | "os"
  | "office"
  | "utilities"
  | "vpn"
  | "giftcard"
  | "design"
  | "gaming"
  | "generic";

function bucketFor(categorySlug: string | null): CatBucket {
  switch (categorySlug) {
    case "antivirus-security": return "antivirus";
    case "operating-systems": return "os";
    case "office-productivity": return "office";
    case "utilities-tools": return "utilities";
    case "vpn-privacy": return "vpn";
    case "gift-cards": return "giftcard";
    case "design-creative": return "design";
    case "pc-games":
    case "games":
    case "game-currencies": return "gaming";
    default: return "generic";
  }
}

interface Template {
  title?: string;
  body: string;
}

const TEMPLATES: Record<CatBucket, Template[]> = {
  antivirus: [
    { title: "Solid protection", body: "Installed without any issues and runs quietly in the background. Real-time scanning catches everything I've thrown at it." },
    { title: "Worth every cent", body: "Way cheaper than buying from the official site and the key activated instantly. No drama." },
    { title: "Great value", body: "Been using it for a couple of weeks now, system feels snappy, no slowdowns. Updates come in regularly." },
    { body: "Activation took less than a minute. The license worked on both my laptop and desktop without complaint." },
    { body: "Catches threats fast and doesn't nag me with popups every five seconds. Exactly what I wanted." },
    { title: "Smooth experience", body: "Key arrived in my inbox within minutes. Activation was painless." },
    { body: "No bloatware, no false positives so far, and the scanner is surprisingly quick. Recommended." },
    { title: "Does the job", body: "Replaced my expired subscription and so far it's been rock solid." },
    { body: "Quick delivery, quick activation, no problems. I'll be back when this license expires." },
    { title: "Excellent purchase", body: "Compared with what I used to pay for renewal, this is a steal. Same product, fraction of the price." },
    { body: "Caught a couple of suspicious downloads my browser missed. Glad I made the switch." },
    { title: "Reliable", body: "Three months in, zero infections, zero performance hit. Can't ask for more." },
  ],
  os: [
    { title: "Activated first try", body: "Plugged the key in, hit activate, done. Genuine status confirmed in settings." },
    { title: "Clean install, no problems", body: "Did a fresh install on a new SSD and the license took without any phone calls or hassle." },
    { body: "System runs noticeably better than the older version I was coming from. Activation was instant." },
    { title: "Fast delivery", body: "Email arrived in under five minutes with the key and a clear set of instructions." },
    { body: "Used the key on a custom build, activated cleanly, Windows reports genuine. Saved a small fortune." },
    { title: "Exactly as advertised", body: "Legit retail key, activated permanently, tied to my Microsoft account. Couldn't be happier." },
    { body: "Did an in-place upgrade and the new key took without losing my files or apps. Smooth process." },
    { title: "Easy upgrade", body: "Walkthrough in the order email made activation a five-minute job. Highly recommend." },
    { body: "Two reboots and I had a fully activated install. No tricks, no shady workarounds." },
    { title: "Great find", body: "Half the price of the official store and works identically. Will buy here again." },
    { body: "Genuine status verified by Microsoft's own activation check. No worries about it dropping later." },
    { title: "Just works", body: "Bought it, activated it, moved on with my day. That's what I needed." },
  ],
  office: [
    { title: "Lifetime license, no subscription", body: "Got tired of paying yearly so I switched. Activates Word, Excel, PowerPoint and Outlook just like the official one." },
    { body: "Smooth installation, signed in with my Microsoft account, everything synced. Used for work daily, no issues." },
    { title: "Massive saving", body: "Pays for itself compared to one year of the subscription. Activation took two minutes." },
    { body: "All the apps I actually use — Word, Excel, PowerPoint — installed and activated without a hitch." },
    { title: "Worth it", body: "Came with clear instructions and a working key. Macros, pivot tables, the lot — all working." },
    { body: "Used the license on my main work laptop. Already saved hours of formatting time over the old free alternative." },
    { title: "Perfect for home office", body: "Quick delivery, simple setup, fully functional Office suite. Exactly what I needed for remote work." },
    { body: "OneDrive integration works fine, files open the same as on my office machine. No compatibility issues." },
    { title: "Genuine and permanent", body: "Microsoft account shows the product as activated. Confidence that it won't deactivate down the line." },
    { body: "Installed the latest version, activated within seconds. The whole process was easier than I expected." },
    { title: "No more rental fees", body: "Owning the license outright feels much better than the subscription treadmill." },
    { body: "Email delivery was fast and the activation guide had zero friction. Recommended." },
  ],
  utilities: [
    { title: "Does what it says", body: "Cleared a ton of junk off my system in one pass. Noticeable boot speed improvement." },
    { body: "Activation took seconds, the tool is straightforward and the license is permanent. No subscription games." },
    { title: "Useful and lightweight", body: "Doesn't slow my machine down and the scan results are easy to read." },
    { body: "Helpful for tidying up my drive after years of installing and uninstalling random apps." },
    { title: "Good value", body: "Cheap, fast delivery, working key. What's not to like." },
    { body: "Fixed a couple of registry issues that were causing slowdowns. The license came through in minutes." },
    { title: "Works as expected", body: "Used it to repair a sluggish laptop for a family member. Big difference in responsiveness afterwards." },
    { body: "Simple interface, no upsells, no nagging. Just the features I paid for." },
    { title: "Recommended", body: "Faster than the free tools I was using and the license is a one-time payment. Excellent." },
    { body: "Driver updates went smoothly and my system feels more stable. Genuine key, instant activation." },
  ],
  vpn: [
    { title: "Fast and reliable", body: "Connected to half a dozen servers, all of them snappy. No noticeable speed hit on my home connection." },
    { body: "Picked it up to unlock a streaming library and it worked on the first try. Activation was instant." },
    { title: "No-logs and stable", body: "Haven't had a single drop in a month of daily use. The Mac app is clean and easy." },
    { body: "Server list is huge and switching is quick. Definitely worth it at this price." },
    { title: "Great for travel", body: "Used it abroad to access my usual sites. Speed was consistent, no buffering." },
    { body: "Subscription activated immediately after purchase. Multiple devices work fine on a single account." },
    { title: "Easy setup", body: "Apps for every platform I use. Installed in minutes, connected, done." },
    { body: "Cheaper than going direct and the experience is identical. Will renew here next year." },
    { title: "Solid privacy tool", body: "Kill switch works as advertised, DNS leaks tested clean. Good purchase." },
    { body: "Customer support replied to my one question within an hour. Pleasant surprise." },
  ],
  giftcard: [
    { title: "Instant delivery", body: "Code arrived in my inbox within a couple of minutes. Redeemed without any problem." },
    { body: "Bought as a last-minute gift, the email format was clean enough to forward straight to the recipient." },
    { title: "Worked first try", body: "Region matched, code valid, balance credited immediately. Easy." },
    { body: "Got the right region card after asking support a quick question. Smooth experience overall." },
    { title: "Perfect gift", body: "Cheaper than buying the card in store and the recipient had it in seconds." },
    { body: "Bought one for myself to top up an account. The whole process took under five minutes." },
    { title: "Reliable seller", body: "Second time ordering from here, both codes worked first try. Will be back." },
    { body: "Discount over face value was a nice surprise. Code redeemed without issue." },
    { title: "Great option", body: "Way more convenient than physical cards and delivery is basically instant." },
    { body: "Saved a few bucks compared to retail and the code was emailed within minutes." },
  ],
  design: [
    { title: "Activated and ready", body: "Plugged the license in and was working in the app within minutes. No activation drama." },
    { body: "Massive feature set for a fraction of what I was paying on subscription. Couldn't be more pleased." },
    { title: "Smooth experience", body: "Installer downloaded fast, activation popped up on first launch and accepted the key right away." },
    { body: "Files open without compatibility warnings and the toolset is everything I need for client work." },
    { title: "Worth it", body: "Replaced a subscription I was paying every month. The lifetime option here is a no-brainer." },
    { body: "Renders look great, the brush engine is responsive, no random crashes so far." },
    { title: "Solid purchase", body: "Came with clear instructions and a working license. Already used it on two projects." },
    { body: "Performance is what I expected — smooth scrubbing, fast exports, no glitches on my hardware." },
    { title: "Good for freelancers", body: "Cheaper than the official store and the license is mine to keep. Perfect for indie work." },
    { body: "Tested it across a few file formats my clients use, no issues. Recommended." },
  ],
  gaming: [
    { title: "Activated on Steam, no issues", body: "Key worked first try, game preloaded right after activation. Smooth as ever." },
    { body: "Cheaper than the storefront price and the code was in my inbox in minutes. Already playing." },
    { title: "Legit key", body: "Activated through the official launcher and the game is sitting in my library permanently." },
    { body: "Fast delivery, valid key, no region issues. Couldn't ask for more." },
    { title: "Quick and easy", body: "Bought, paid, activated, all under five minutes. Great way to grab a game on sale." },
    { body: "Used the code on my console account, redeemed cleanly. No hidden surprises." },
    { title: "Recommended", body: "Saved a decent amount versus buying directly. Will be using this store again." },
    { body: "Multiplayer works fine, my account shows the game as fully owned. No issues with the seller." },
    { title: "Smooth", body: "The whole process from checkout to playing took less than ten minutes. Highly recommend." },
    { body: "Region matched my account and the activation went through on the first attempt. Cheers!" },
  ],
  generic: [
    { title: "Solid purchase", body: "Delivery was fast, the key worked first time, and everything has been smooth so far." },
    { body: "Easy checkout and instant email delivery. The license activated without any trouble." },
    { title: "Recommended", body: "Cheaper than the official store, same product, no compromises. Will buy here again." },
    { body: "Bought, paid, used. Whole process took a few minutes and there were no surprises." },
    { title: "Works as expected", body: "License is genuine and the activation was straightforward. Happy with the purchase." },
    { body: "Good price, fast delivery, working key. Everything you want from a digital store." },
    { title: "Smooth experience", body: "From checkout to activation it took under ten minutes. Will return for my next license." },
    { body: "No hidden fees, no spam, just a working key in my inbox. Exactly what I needed." },
  ],
};

const NON_ENGLISH: Template[] = [
  { title: "Funktioniert einwandfrei", body: "Schnelle Lieferung des Schlüssels per E-Mail, Aktivierung lief problemlos durch. Sehr zufrieden." },
  { body: "Sehr empfehlenswert. Lizenz hat sofort funktioniert und der Preis war deutlich günstiger als im offiziellen Shop." },
  { title: "Parfait", body: "Clé reçue en quelques minutes, activation immédiate, aucun problème. Je recommande." },
  { body: "Très bon rapport qualité-prix. Le produit fonctionne comme prévu et l'envoi a été rapide." },
  { title: "Perfecto", body: "Recibí la clave en pocos minutos y se activó sin problema. Lo recomiendo sin dudas." },
  { body: "Excelente servicio, todo funcionó a la primera. Muy contento con la compra." },
  { title: "Ottimo prodotto", body: "Chiave arrivata in pochi minuti, attivazione senza problemi. Esattamente come descritto." },
  { body: "Acquisto consigliato. Prezzo onesto e funzionalità identica all'originale." },
];

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function pick<T>(arr: T[], r: () => number): T {
  return arr[Math.floor(r() * arr.length)];
}

function pickRating(r: () => number): number {
  const v = r();
  if (v < 0.70) return 5;
  if (v < 0.95) return 4;
  return 3;
}

function pickReviewCount(r: () => number): number {
  return 4 + Math.floor(r() * 9); // 4..12
}

function randomDateInRange(r: () => number): Date {
  // last 6 months (≈180 days)
  const now = Date.now();
  const past = now - 180 * 24 * 60 * 60 * 1000;
  return new Date(past + r() * (now - past));
}

// ---------- reviewer pool ----------

async function ensureReviewerPool(): Promise<number[]> {
  // Returns ordered list of user ids for the SEED_REVIEWER pool.
  const existing = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.adminNotes, "SEED_REVIEWER"));

  if (existing.length >= 80) {
    console.log(`Reviewer pool: reusing ${existing.length} existing users.`);
    return existing.map((u) => u.id);
  }

  console.log(`Reviewer pool: creating ${80 - existing.length} new shadow users…`);
  const passwordHash = await bcrypt.hash("disabled-account-no-login", 10);
  const created: number[] = existing.map((u) => u.id);

  for (let i = existing.length; i < 80; i++) {
    const first = FIRST_NAMES[i % FIRST_NAMES.length];
    const last = LAST_NAMES[(i * 7) % LAST_NAMES.length];
    const email = `reviewer-${i + 1}@seed.internal`;
    const [row] = await db
      .insert(users)
      .values({
        email,
        firstName: first,
        lastName: last,
        passwordHash,
        isActive: false,
        emailVerified: false,
        adminNotes: "SEED_REVIEWER",
      })
      .onConflictDoNothing({ target: users.email })
      .returning({ id: users.id });
    if (row) created.push(row.id);
  }

  // Re-fetch in case onConflictDoNothing skipped some
  const final = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.adminNotes, "SEED_REVIEWER"));
  return final.map((u) => u.id);
}

// ---------- main ----------

interface ProductRow {
  id: number;
  name: string;
  categorySlug: string | null;
  existingReviewCount: number;
}

async function loadProducts(productId: number | null): Promise<ProductRow[]> {
  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      categorySlug: sql<string | null>`(SELECT slug FROM categories WHERE id = ${products.categoryId})`,
      existingReviewCount: sql<number>`(SELECT COUNT(*)::int FROM reviews WHERE product_id = ${products.id} AND status = 'APPROVED')`,
    })
    .from(products)
    .where(productId ? eq(products.id, productId) : eq(products.isActive, true));
  return rows;
}

async function seedForProduct(p: ProductRow, reviewerIds: number[], seed: number): Promise<number> {
  const r = rng(seed + p.id);
  const n = pickReviewCount(r);
  const bucket = bucketFor(p.categorySlug);
  const pool = TEMPLATES[bucket];

  // Track which reviewers and templates we've used for THIS product
  const usedReviewers = new Set<number>();
  const usedTemplates = new Set<Template>();

  const rows: typeof reviews.$inferInsert[] = [];
  for (let i = 0; i < n; i++) {
    // Pick a reviewer not yet used on this product
    let userId: number;
    let tries = 0;
    do {
      userId = pick(reviewerIds, r);
      tries++;
    } while (usedReviewers.has(userId) && tries < 20);
    usedReviewers.add(userId);

    const isNonEnglish = r() < 0.05;
    const sourcePool = isNonEnglish ? NON_ENGLISH : pool;
    // Avoid repeating the same template within a single product.
    const availableTemplates = sourcePool.filter((t) => !usedTemplates.has(t));
    const template = availableTemplates.length > 0
      ? pick(availableTemplates, r)
      : pick(sourcePool, r); // fallback when pool exhausted
    usedTemplates.add(template);
    const rating = pickRating(r);
    const createdAt = randomDateInRange(r);

    rows.push({
      productId: p.id,
      userId,
      rating,
      title: template.title ?? null,
      body: template.body,
      isVerifiedPurchase: r() < 0.7,
      isApproved: true,
      status: "APPROVED",
      helpfulCount: Math.floor(r() * 12),
      createdAt,
      updatedAt: createdAt,
    });
  }

  if (DRY_RUN) {
    console.log(`\n[DRY] product ${p.id} (${bucket}) "${p.name}" → ${rows.length} reviews:`);
    for (const row of rows.slice(0, 3)) {
      console.log(`   ★${row.rating}  ${row.title ?? "(no title)"}  — ${row.body?.slice(0, 60)}…`);
    }
    return rows.length;
  }

  await db.insert(reviews).values(rows);

  // Refresh aggregate
  const [agg] = await db
    .select({
      avg: sql<string>`COALESCE(ROUND(AVG(${reviews.rating})::numeric, 2), 0)`,
      cnt: count(),
    })
    .from(reviews)
    .where(and(eq(reviews.productId, p.id), eq(reviews.status, "APPROVED")));

  await db
    .update(products)
    .set({ avgRating: agg?.avg ?? "0", reviewCount: Number(agg?.cnt ?? 0) })
    .where(eq(products.id, p.id));

  return rows.length;
}

async function main() {
  console.log(DRY_RUN ? "Dry run — no DB writes.\n" : "Seeding reviews…\n");

  const reviewerIds = await ensureReviewerPool();
  if (reviewerIds.length < 20) {
    console.error("Reviewer pool is too small; aborting.");
    await pool.end();
    process.exit(1);
  }

  const list = await loadProducts(ONE_PRODUCT);
  const target = list.filter((p) => p.existingReviewCount === 0);
  console.log(`Found ${list.length} active products; ${target.length} need seeding.\n`);

  let totalReviews = 0;
  let totalProducts = 0;
  const buckets: Record<string, number> = {};

  for (const p of target) {
    const n = await seedForProduct(p, reviewerIds, 1337);
    totalReviews += n;
    totalProducts++;
    const b = bucketFor(p.categorySlug);
    buckets[b] = (buckets[b] ?? 0) + 1;
    if (!DRY_RUN && totalProducts % 50 === 0) {
      console.log(`  …${totalProducts}/${target.length} products done`);
    }
  }

  console.log(`\nDone. ${totalProducts} products, ${totalReviews} reviews.`);
  console.log("By bucket:", buckets);

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
