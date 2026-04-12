/**
 * Seeds approved product Q&A for demo / local dev.
 * Idempotent: removes previous rows where askerEmail = SEED_EMAIL, then re-inserts.
 *
 * Run: pnpm --filter @workspace/scripts seed:qa
 */
import { db, pool } from "@workspace/db";
import { products, productQuestions, productAnswers } from "@workspace/db/schema";
import { eq, inArray } from "drizzle-orm";

const SEED_EMAIL = "qa-seed@pixelcodes.internal";

type QaPair = {
  askerName: string;
  question: string;
  answer: string;
};

async function main() {
  const [win] = await db.select({ id: products.id }).from(products).where(eq(products.slug, "windows-11-pro")).limit(1);
  const [office] = await db.select({ id: products.id }).from(products).where(eq(products.slug, "office-2021-pro-plus")).limit(1);

  if (!win) {
    console.error("Product slug windows-11-pro not found. Run pnpm --filter @workspace/scripts seed first.");
    process.exit(1);
  }

  const winQa: QaPair[] = [
    {
      askerName: "Marcus T.",
      question: "Is this a retail or OEM license? Will it activate on a clean install?",
      answer:
        "This is a genuine digital license key sourced through authorized channels — not a grey-market OEM sticker. You can activate on a clean install using Microsoft’s Media Creation Tool; use the key when prompted or add it in Settings → Activation after setup.",
    },
    {
      askerName: "Elena R.",
      question: "How quickly do I receive the key after payment?",
      answer:
        "Most orders are delivered within minutes to your email and order page. If you don’t see it within 15 minutes, check spam and contact support with your order number.",
    },
    {
      askerName: "James K.",
      question: "Can I move Windows 11 Pro to a new PC later?",
      answer:
        "Microsoft’s rules depend on license type; digital retail-style keys are often transferable when properly unlinked from the old device. For business or volume scenarios, check your agreement. We’re happy to clarify for your specific order if you email support.",
    },
    {
      askerName: "Sofia L.",
      question: "What is the main difference between Pro and Home?",
      answer:
        "Pro adds BitLocker device encryption, Hyper-V, Remote Desktop host, Group Policy, and Azure AD join among other business features. Home is enough for typical consumer use; choose Pro if you need those tools.",
    },
    {
      askerName: "Daniel W.",
      question: "Does this work for Windows 11 24H2 updates?",
      answer:
        "Yes. The key activates Windows 11 Pro; feature updates like 24H2 come through Windows Update as usual. If activation ever fails after a major upgrade, run the Activation troubleshooter or contact us.",
    },
  ];

  const officeQa: QaPair[] = office
    ? [
        {
          askerName: "Anna P.",
          question: "Is this license for one PC only?",
          answer:
            "This Professional Plus SKU is a single-device license for one Windows PC. You’ll receive one key; install on that machine and keep the key safe for reinstalls on the same hardware.",
        },
        {
          askerName: "Chris M.",
          question: "Does Professional Plus include Outlook and Access?",
          answer:
            "Yes. Office 2021 Professional Plus includes Word, Excel, PowerPoint, Outlook, Access, Publisher, and Teams (work or school) — the full desktop suite for Windows.",
        },
      ]
    : [];

  const toInsert: { productId: number; pairs: QaPair[] }[] = [
    { productId: win.id, pairs: winQa },
    ...(office ? [{ productId: office.id, pairs: officeQa }] : []),
  ];

  const existing = await db
    .select({ id: productQuestions.id })
    .from(productQuestions)
    .where(eq(productQuestions.askerEmail, SEED_EMAIL));
  const existingIds = existing.map((r) => r.id);
  if (existingIds.length > 0) {
    await db.delete(productAnswers).where(inArray(productAnswers.questionId, existingIds));
    await db.delete(productQuestions).where(inArray(productQuestions.id, existingIds));
    console.log(`Removed ${existingIds.length} previous seed Q&A rows.`);
  }

  let qCount = 0;
  let aCount = 0;
  for (const { productId, pairs } of toInsert) {
    for (const { askerName, question, answer } of pairs) {
      const [q] = await db
        .insert(productQuestions)
        .values({
          productId,
          userId: null,
          askerName,
          askerEmail: SEED_EMAIL,
          questionText: question,
          status: "APPROVED",
        })
        .returning({ id: productQuestions.id });
      qCount++;
      await db.insert(productAnswers).values({
        questionId: q.id,
        answerText: answer,
        isAdmin: true,
        authorName: "PixelCodes Support",
      });
      aCount++;
    }
  }

  console.log(`Seeded ${qCount} questions and ${aCount} answers (APPROVED).`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
