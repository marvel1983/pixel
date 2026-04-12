import { test, expect, type APIRequestContext } from "@playwright/test";

/**
 * Loyalty — earn then spend integration test
 *
 * Scenarij:
 *   1. Login kao admin
 *   2. Omogući loyalty (ako nije) i dohvati config
 *   3. Seed admin account s dovoljno poena via bulk-adjust
 *   4. Zabilježi balance BEFORE
 *   5. Kupi proizvod → POST /orders (logged-in user)
 *   6. Provjeri balance AFTER > BEFORE  (poeni dodijeljeni)
 *   7. Zabilježi balance BEFORE_2
 *   8. Ponovi kupovinu s loyaltyPointsUsed > 0
 *   9. Provjeri balance AFTER_2 < BEFORE_2  (poeni potrošeni)
 *  10. Provjeri discount se odrazio na order total
 *
 * Zahtijeva: API na :8080, PLAYWRIGHT_ADMIN_PASSWORD
 */

const API = "http://127.0.0.1:8080/api";
const ADMIN_EMAIL = "admin@store.com";
const SEED_POINTS = 2000; // koliko poena seedamo prije testa

// Dijeljeno stanje između testova (serial mode)
let token = "";
let adminId = 0;
let loyaltyConfig: {
  pointsPerDollar: number;
  redemptionRate: string;
  minRedeemPoints: number;
  maxRedeemPercent: number;
};
let productVariant: {
  variantId: number;
  productId: number;
  productName: string;
  variantName: string;
  priceUsd: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

let csrfToken = "";

async function fetchCsrf(request: APIRequestContext): Promise<string> {
  const res = await request.get(`${API}/csrf-token`);
  const data = await res.json() as { csrfToken: string };
  csrfToken = data.csrfToken;
  return csrfToken;
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { Authorization: `Bearer ${token}`, "x-csrf-token": csrfToken, ...extra };
}

async function getBalance(request: APIRequestContext): Promise<number> {
  const res = await request.get(`${API}/loyalty/account`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok()) return 0;
  const data = await res.json() as { enabled?: boolean; pointsBalance?: number };
  return data.pointsBalance ?? 0;
}

/** Poll until balance changes or timeout (ms). awardOrderPoints runs async. */
async function waitForBalanceChange(
  request: APIRequestContext,
  fromBalance: number,
  timeoutMs = 8000,
): Promise<number> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 400));
    const bal = await getBalance(request);
    if (bal !== fromBalance) return bal;
  }
  return await getBalance(request);
}

/** Wait for balance to stabilize (stop changing) — for orders where both
 *  deduction and earn happen: deduction is sync, earn is async. */
async function waitForBalanceStable(
  request: APIRequestContext,
  timeoutMs = 8000,
): Promise<number> {
  const deadline = Date.now() + timeoutMs;
  let prev = await getBalance(request);
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 500));
    const cur = await getBalance(request);
    if (cur === prev) return cur; // stable
    prev = cur;
  }
  return prev;
}

async function placeOrder(
  request: APIRequestContext,
  opts: { loyaltyPointsUsed?: number } = {},
) {
  // Refresh CSRF token in this request context (cookie + header must match)
  await fetchCsrf(request);
  const price = parseFloat(productVariant.priceUsd);
  const redeemRate = parseFloat(loyaltyConfig.redemptionRate);
  const loyaltyDiscount = opts.loyaltyPointsUsed
    ? Math.round(opts.loyaltyPointsUsed * redeemRate * 100) / 100
    : 0;
  const total = Math.max(0, price - loyaltyDiscount).toFixed(2);

  const idempotencyKey = crypto.randomUUID();
  const res = await request.post(`${API}/orders`, {
    headers: authHeaders({ "X-Idempotency-Key": idempotencyKey }),
    data: {
      billing: {
        email: ADMIN_EMAIL,
        firstName: "Playwright",
        lastName: "Test",
        country: "US",
        city: "Austin",
        zip: "78701",
        address: "123 E2E Street",
      },
      items: [
        {
          variantId: productVariant.variantId,
          productId: productVariant.productId,
          productName: productVariant.productName,
          variantName: productVariant.variantName,
          quantity: 1,
          priceUsd: productVariant.priceUsd,
          imageUrl: null,
        },
      ],
      total,
      loyaltyPointsUsed: opts.loyaltyPointsUsed ?? undefined,
      payment: { cardToken: `tok_e2e_${Date.now()}` },
      paymentMethod: "card",
    },
  });

  return { res, total: parseFloat(total), loyaltyDiscount };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe("loyalty: earn then spend", () => {
  test.describe.configure({ mode: "serial" });

  test.skip(
    !process.env.PLAYWRIGHT_ADMIN_PASSWORD,
    "Postavi PLAYWRIGHT_ADMIN_PASSWORD i pokreni API na :8080",
  );

  // ── Setup ──────────────────────────────────────────────────────────────────
  test.beforeAll(async ({ request }) => {
    const password = process.env.PLAYWRIGHT_ADMIN_PASSWORD!;

    // 0. Dohvati CSRF token (cookie se sprema automatski u request kontekstu)
    await fetchCsrf(request);

    // 1. Login
    const loginRes = await request.post(`${API}/auth/login`, {
      headers: { "x-csrf-token": csrfToken },
      data: { email: ADMIN_EMAIL, password },
    });
    expect(loginRes.ok(), `Login failed: ${await loginRes.text()}`).toBeTruthy();
    token = ((await loginRes.json()) as { token: string }).token;
    expect(token, "Nema JWT tokena").toBeTruthy();

    // 2. Get userId
    const meRes = await request.get(`${API}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(meRes.ok()).toBeTruthy();
    adminId = ((await meRes.json()) as { user: { id: number } }).user.id;
    expect(adminId).toBeGreaterThan(0);

    // 3. Osiguraj da je loyalty ENABLED
    const cfgRes = await request.get(`${API}/loyalty/config`);
    const cfg = await cfgRes.json() as { enabled: boolean };
    if (!cfg.enabled) {
      // Omogući loyalty sa default postavkama
      const enableRes = await request.put(`${API}/admin/loyalty/settings`, {
        headers: authHeaders(),
        data: {
          enabled: true,
          pointsPerDollar: 10,
          redemptionRate: "0.01",
          minRedeemPoints: 100,
          maxRedeemPercent: 50,
          pointsExpiryDays: 0,
        },
      });
      expect(
        enableRes.ok(),
        `Ne mogu omogućiti loyalty: ${await enableRes.text()}`,
      ).toBeTruthy();
    }

    // 4. Dohvati loyalty config
    const cfgRes2 = await request.get(`${API}/loyalty/config`);
    const fullCfg = await cfgRes2.json() as {
      enabled: boolean;
      pointsPerDollar: number;
      redemptionRate: string;
      minRedeemPoints: number;
      maxRedeemPercent: number;
    };
    expect(fullCfg.enabled, "Loyalty nije omogućen").toBeTruthy();
    loyaltyConfig = {
      pointsPerDollar: fullCfg.pointsPerDollar ?? 10,
      redemptionRate: fullCfg.redemptionRate ?? "0.01",
      minRedeemPoints: fullCfg.minRedeemPoints ?? 100,
      maxRedeemPercent: fullCfg.maxRedeemPercent ?? 50,
    };

    // 5. Seed poeni da imamo što potrošiti u 2. kupovini
    const seedRes = await request.post(`${API}/admin/loyalty/bulk-adjust`, {
      headers: authHeaders(),
      data: {
        userIds: [adminId],
        points: SEED_POINTS,
        description: "Playwright E2E seed",
        type: "ADMIN",
      },
    });
    expect(seedRes.ok(), `Seed poeni neuspješni: ${await seedRes.text()}`).toBeTruthy();

    // 6. Dohvati proizvod za kupovinu
    const prodRes = await request.get(`${API}/products?limit=5`);
    expect(prodRes.ok()).toBeTruthy();
    const { items } = await prodRes.json() as {
      items: Array<{
        id: number;
        name: string;
        variants: Array<{ id: number; name: string; priceUsd: string; stockCount: number }>;
      }>;
    };
    expect(items.length, "Nema proizvoda u bazi").toBeGreaterThan(0);

    // Nađi variant s ≥1 na stanju
    let found = false;
    for (const product of items) {
      for (const variant of product.variants) {
        if (variant.stockCount > 0) {
          productVariant = {
            variantId: variant.id,
            productId: product.id,
            productName: product.name,
            variantName: variant.name,
            priceUsd: variant.priceUsd,
          };
          found = true;
          break;
        }
      }
      if (found) break;
    }
    expect(found, "Nema dostupnih varijanti na stanju").toBeTruthy();
  });

  // ── Test 1: poeni se dodjeljuju ────────────────────────────────────────────
  test("1 — narudžba dodjeljuje poene", async ({ request }) => {
    const balanceBefore = await getBalance(request);

    const { res } = await placeOrder(request);
    expect(
      res.ok(),
      `Narudžba neuspješna (${res.status()}): ${(await res.text()).slice(0, 400)}`,
    ).toBeTruthy();

    const orderData = await res.json() as { orderNumber: string };
    expect(orderData.orderNumber, "Nema orderNumber").toBeTruthy();

    // awardOrderPoints je fire-and-forget — čekamo da se izvrši
    const balanceAfter = await waitForBalanceChange(request, balanceBefore);

    const expectedEarned = Math.floor(
      parseFloat(productVariant.priceUsd) * loyaltyConfig.pointsPerDollar,
    );

    expect(
      balanceAfter,
      `Balance nije porastao: before=${balanceBefore}, after=${balanceAfter}, expected earned=${expectedEarned}`,
    ).toBeGreaterThan(balanceBefore);

    expect(
      balanceAfter - balanceBefore,
      `Pogrešan broj dodijeljenih poena: expected ≈${expectedEarned}`,
    ).toBeGreaterThanOrEqual(expectedEarned - 1); // ±1 zbog zaokruživanja

    console.log(
      `✓ Poeni dodijeljeni: ${balanceBefore} → ${balanceAfter} (+${balanceAfter - balanceBefore}, expected +${expectedEarned})`,
    );
  });

  // ── Test 2: poeni se troše ─────────────────────────────────────────────────
  test("2 — poeni se troše u sljedećoj kupovini", async ({ request }) => {
    const balanceBefore = await getBalance(request);
    expect(balanceBefore, "Nema poena za potrošiti").toBeGreaterThanOrEqual(
      loyaltyConfig.minRedeemPoints,
    );

    // Koristi sve dostupne poene (do maxRedeemPercent od vrijednosti narudžbe)
    const price = parseFloat(productVariant.priceUsd);
    const redeemRate = parseFloat(loyaltyConfig.redemptionRate);
    const maxDiscountUsd = price * (loyaltyConfig.maxRedeemPercent / 100);
    const maxPointsByDiscount = Math.floor(maxDiscountUsd / redeemRate);
    const pointsToUse = Math.min(balanceBefore, maxPointsByDiscount);

    expect(
      pointsToUse,
      `Premalo poena (${pointsToUse}) za minimalnu uplatu (${loyaltyConfig.minRedeemPoints})`,
    ).toBeGreaterThanOrEqual(loyaltyConfig.minRedeemPoints);

    const { res, total, loyaltyDiscount } = await placeOrder(request, {
      loyaltyPointsUsed: pointsToUse,
    });
    expect(
      res.ok(),
      `Narudžba s poenima neuspješna (${res.status()}): ${(await res.text()).slice(0, 400)}`,
    ).toBeTruthy();

    const orderData = await res.json() as { orderNumber: string };
    expect(orderData.orderNumber, "Nema orderNumber").toBeTruthy();

    // Čekamo da se balance stabilizira (redemption sync, earn async)
    const balanceAfter = await waitForBalanceStable(request);

    // Minimalni zarađeni (bez tier multipliera) i maksimalni (sa 2x multiplier)
    const baseEarned = Math.floor(total * loyaltyConfig.pointsPerDollar);
    const maxEarned = baseEarned * 2; // max tier je 2x

    // Ključne provjere:
    // 1. Poeni su smanjeni (potrošeni)
    expect(
      balanceAfter,
      `Poeni nisu potrošeni: before=${balanceBefore}, after=${balanceAfter}, used=${pointsToUse}`,
    ).toBeLessThan(balanceBefore);

    // 2. Koliko je potrošeno (netted sa zarađenim) je unutar očekivanog raspona
    const netChange = balanceBefore - balanceAfter; // pozitivan = neto potrošnja
    const expectedNetMin = pointsToUse - maxEarned;
    const expectedNetMax = pointsToUse - baseEarned + 5; // +5 za zaokruživanje
    expect(
      netChange,
      `Neto promjena (${netChange}) izvan raspona [${expectedNetMin}–${expectedNetMax}]. ` +
      `before=${balanceBefore}, after=${balanceAfter}, used=${pointsToUse}, base_earned=${baseEarned}`,
    ).toBeGreaterThanOrEqual(expectedNetMin);
    expect(netChange).toBeLessThanOrEqual(expectedNetMax);

    console.log(
      `✓ Poeni potrošeni: ${balanceBefore} → ${balanceAfter}`,
      `(potrošeno: ${pointsToUse}, zarađeno: ~${baseEarned}–${maxEarned}, discount: $${loyaltyDiscount.toFixed(2)})`,
    );
  });
});
