/**
 * One-off bespoke SEO content for the flagship money page:
 * Microsoft Windows 11 Pro Retail (product id 799,
 * slug microsoft-windows-11-pro-retail-6a26fc).
 *
 *   pnpm --filter @workspace/scripts seed:win11pro
 *
 * The generic seed-buy-pages.ts produces archetype-templated copy. For the
 * single highest-traffic product we hand-write deeper, query-targeted content
 * (Pro-vs-Home, Retail-vs-OEM, upgrade path, troubleshooting, refund) so the
 * /buy page is materially superior and the FAQPage JSON-LD covers the real
 * "People Also Ask" set. Idempotent upsert — safe to re-run.
 */
import { db, pool } from "@workspace/db";
import { productSeoContent, products } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const PRODUCT_ID = 799;

const intro =
  "Buy a genuine Microsoft Windows 11 Pro retail licence and unlock the full professional feature set — BitLocker device encryption, Remote Desktop host, Hyper-V virtualisation, Windows Sandbox and Group Policy / domain join — none of which are available in Windows 11 Home. Because this is a retail (not OEM) licence it is not tied to the original motherboard, so you can move it to a new PC after a hardware upgrade. The 25-character key is delivered to your inbox within minutes of payment, activates directly against Microsoft's servers, and stays valid for the supported lifetime of the device with no subscription or renewal.";

const whyBuy: string[] = [
  "Full Pro feature set — BitLocker, Remote Desktop host, Hyper-V, Windows Sandbox and Group Policy that Windows 11 Home does not include.",
  "Genuine retail licence through authorised channels — activates and reports as genuine under Settings → System → Activation.",
  "Retail, not OEM — transferable to a new computer after a motherboard or full-hardware change, unlike an OEM key locked to the first board.",
  "Instant email delivery — the key is sent automatically, usually within a couple of minutes, any time of day.",
  "One-time payment, lifetime activation — no Microsoft 365-style subscription and no renewal fee.",
  "Upgrade in place — already on Windows 11 Home? This key switches it to Pro keeping your files and apps, no clean reinstall.",
  "Encrypted checkout and 24/7 human support — if activation ever needs a hand we walk you through it.",
];

const activationSteps: string[] = [
  "Open the email you used at checkout — your 25-character Windows 11 Pro key arrives within minutes (check the spam/promotions folder if it is not in the inbox).",
  "On the PC, open Settings → System → Activation.",
  "Expand 'Upgrade your edition of Windows' or 'Change product key' and click Change.",
  "Enter the 25-character key exactly as shown in the email (no spaces) and click Next.",
  "Wait a few seconds for online activation — Activation then shows 'Windows is activated with a digital licence'.",
];

const faq: { q: string; a: string }[] = [
  {
    q: "Is this Windows 11 Pro key genuine and legal?",
    a: "Yes. It is a genuine retail product key that activates directly with Microsoft and reports as genuine in Settings → System → Activation. It is sourced through authorised channels, not grey-market resale.",
  },
  {
    q: "What is the difference between Windows 11 Pro and Windows 11 Home?",
    a: "Pro adds BitLocker drive encryption, Remote Desktop host (remote into the PC), Hyper-V and Windows Sandbox, Group Policy, and the ability to join a domain or Azure AD. Home has none of these. For business use, full-disk encryption or remote access you need Pro.",
  },
  {
    q: "Is this a retail or an OEM licence, and why does it matter?",
    a: "This is a retail licence. A retail key can be moved to a new computer after a hardware change; an OEM key is locked to the first motherboard it activates on and cannot legally be transferred. Retail is the more flexible, future-proof choice.",
  },
  {
    q: "Can I transfer this key to a new computer later?",
    a: "Yes. Stop using it on the old PC, then enter the same key on the new machine and activate online. If automatic activation is blocked after a major hardware change, the built-in phone-activation wizard (run slui 4) completes it.",
  },
  {
    q: "Do I have to reinstall Windows to use this key?",
    a: "No. If Windows 11 (Home or an unactivated Pro) is already installed you only enter the key in Settings → Activation to unlock or upgrade to Pro. A clean install is optional, not required.",
  },
  {
    q: "I am on Windows 11 Home — can I upgrade to Pro with this key?",
    a: "Yes. Go to Settings → System → Activation → Change product key and enter the key. Windows switches Home to Pro in place, keeping your files and installed apps; no reinstall needed.",
  },
  {
    q: "When and how do I receive the key?",
    a: "Immediately after checkout. The 25-character key is emailed automatically, typically within a couple of minutes. If it is not in your inbox, check the spam or promotions folder.",
  },
  {
    q: "Does this work on 32-bit and 64-bit Windows 11?",
    a: "Windows 11 is 64-bit only — there is no 32-bit Windows 11. The key activates any 64-bit Windows 11 Pro installation, in any language.",
  },
  {
    q: "Are Windows updates and security patches included?",
    a: "Yes. A Windows 11 Pro licence receives all feature and security updates from Microsoft for the supported lifetime of the device at no extra cost. It is a perpetual licence, not a subscription.",
  },
  {
    q: "Activation failed with an error — what should I do?",
    a: "Confirm the 25-character key was typed exactly with no spaces and that the PC is online. If you recently changed major hardware, run phone activation: press Win+R, type slui 4 and follow the wizard. Our 24/7 support will complete activation with you if it still fails.",
  },
  {
    q: "Can I get a refund if the key does not work?",
    a: "Yes. If a key cannot be activated and support cannot resolve it, you are entitled to a replacement or refund. Keys that have already activated successfully are non-refundable, in line with EU rules for delivered digital goods.",
  },
  {
    q: "Which languages and regions does the key support?",
    a: "The licence is not region- or language-locked. Install Windows 11 Pro in any language from Microsoft and this key activates it worldwide.",
  },
];

async function main() {
  await db
    .insert(productSeoContent)
    .values({ productId: PRODUCT_ID, intro, whyBuy, faq, activationSteps })
    .onConflictDoUpdate({
      target: productSeoContent.productId,
      set: { intro, whyBuy, faq, activationSteps, updatedAt: new Date() },
    });
  // Mark the flagship as featured so the homepage crawl hub (siteHubDoc,
  // featured-first ordering) links it and passes link equity to this money
  // page even though its review count is low.
  await db.update(products).set({ isFeatured: true }).where(eq(products.id, PRODUCT_ID));

  console.log(`✓ bespoke SEO content upserted + isFeatured set for product ${PRODUCT_ID} (${faq.length} FAQ, ${whyBuy.length} why-buy, ${activationSteps.length} steps)`);
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
