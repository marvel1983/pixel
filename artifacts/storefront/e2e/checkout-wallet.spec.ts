import { test, expect } from "@playwright/test";

/**
 * Checkout plaćen isključivo store creditom (wallet pokriva cijeli iznos).
 *
 * Zahtijeva: API na :8080 (Vite proxy /api), seedani admin, PLAYWRIGHT_ADMIN_PASSWORD.
 * Kao i qa-flow: development API ili DISABLE_RATE_LIMIT=1 da izbjegneš 429.
 *
 * beforeAll automatski top-upa wallet admina ako je saldo ispod MIN_BALANCE_USD.
 */

const API_BASE = "http://127.0.0.1:8080/api";
const ADMIN_EMAIL = "admin@store.com";
const MIN_BALANCE_USD = 50; // top-up ako je ispod ovog iznosa

test.describe("checkout wallet-only", () => {
  test.skip(
    !process.env.PLAYWRIGHT_ADMIN_PASSWORD,
    "Postavi PLAYWRIGHT_ADMIN_PASSWORD (npr. Admin123!) i pokreni API.",
  );

  // ── Setup: osiguraj da admin ima dovoljno balansa ──────────────────────────
  test.beforeAll(async ({ request }) => {
    const password = process.env.PLAYWRIGHT_ADMIN_PASSWORD!;

    // 1. Prijava → JWT token
    const loginRes = await request.post(`${API_BASE}/auth/login`, {
      data: { email: ADMIN_EMAIL, password },
    });
    if (!loginRes.ok()) {
      throw new Error(
        `Setup: login failed ${loginRes.status()}: ${(await loginRes.text()).slice(0, 300)}`,
      );
    }
    const loginBody = await loginRes.json() as { token?: string };
    const token = loginBody.token;
    if (!token) throw new Error("Setup: login response missing token");

    // 2. Dohvati admin userId
    const meRes = await request.get(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!meRes.ok()) throw new Error(`Setup: GET /auth/me failed ${meRes.status()}`);
    const meBody = await meRes.json() as { user?: { id?: number } };
    const adminId = meBody.user?.id;
    if (!adminId) throw new Error("Setup: cannot determine admin userId from /auth/me");

    // 3. Provjeri trenutni saldo
    const walletRes = await request.get(`${API_BASE}/admin/wallet/${adminId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const currentBalance: number = walletRes.ok()
      ? ((await walletRes.json()) as { wallet?: { balanceUsd?: number } }).wallet?.balanceUsd ?? 0
      : 0;

    // 4. Top-up samo ako je ispod minimuma
    if (currentBalance < MIN_BALANCE_USD) {
      const topupRes = await request.post(`${API_BASE}/admin/wallet/${adminId}/adjust`, {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          type: "TOPUP",
          amountUsd: MIN_BALANCE_USD,
          reason: "Playwright E2E test setup",
        },
      });
      if (!topupRes.ok()) {
        throw new Error(
          `Setup: wallet top-up failed ${topupRes.status()}: ${(await topupRes.text()).slice(0, 300)}`,
        );
      }
    }
  });

  test("admin kupuje Windows 11 Pro samo iz walleta", async ({ page }) => {
    test.setTimeout(60_000);

    const password = process.env.PLAYWRIGHT_ADMIN_PASSWORD!;

    // Postavi locale prije ikakve navigacije (addInitScript se izvršava na svakom page.goto)
    await page.addInitScript(() => {
      localStorage.setItem("pixelcodes_locale", "en");
    });

    // ── Prijava ──────────────────────────────────────────────────────────────
    await page.goto("/login");

    const acceptCookies = page.getByRole("button", { name: /accept all|prihvati|sve kolačiće/i });
    if (await acceptCookies.isVisible().catch(() => false)) {
      await acceptCookies.click().catch(() => {});
    }

    await page.getByRole("textbox", { name: "Email Address" }).fill(ADMIN_EMAIL);
    await page.getByRole("textbox", { name: "Password" }).fill(password);
    await page.getByRole("button", { name: "Sign In" }).click();

    // Admin se redirecta na /admin — konzistentno sa smoke.spec.ts
    await expect(page).toHaveURL(/\/admin\/?$/, { timeout: 25_000 });

    // ── Produkt → Add to Cart ─────────────────────────────────────────────────
    await page.goto("/product/windows-11-pro");
    await expect(page.getByRole("heading", { name: "Windows 11 Pro", exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole("button", { name: "Add to Cart" }).first().click();

    // ── Cart → Checkout ───────────────────────────────────────────────────────
    await page.goto("/cart");
    await expect(page.getByRole("heading", { name: "Shopping Cart" })).toBeVisible({
      timeout: 15_000,
    });
    // "Proceed to Checkout" je <Link href="/checkout"> → renderira kao <a> tag
    await page.getByRole("link", { name: /Proceed to Checkout/i }).click();

    // ── Billing forma ─────────────────────────────────────────────────────────
    await expect(page.getByRole("heading", { name: "Billing Details" })).toBeVisible({
      timeout: 20_000,
    });

    // Ograniči selektore na Billing Details blok da izbjegnemo header search combobox
    const billingBlock = page.getByRole("heading", { name: "Billing Details" }).locator("..");

    await billingBlock.locator("#email").fill(ADMIN_EMAIL);
    await billingBlock.locator("#firstName").fill("Admin");
    await billingBlock.locator("#lastName").fill("Test");
    await billingBlock.getByRole("combobox").click();
    await page.getByRole("option", { name: "United States" }).click();
    await billingBlock.locator("#city").fill("Austin");
    await billingBlock.locator("#zip").fill("78701");
    await billingBlock.locator("#address").fill("123 Test Street");

    const regionAck = page.getByRole("checkbox", { name: /understand.*region/i });
    if (await regionAck.isVisible().catch(() => false)) {
      await regionAck.check();
    }

    // ── Wallet switch ─────────────────────────────────────────────────────────
    // WalletPayment renderira karticu s jedinstvenom kombinacijom tekstova:
    //   "Pay with store credit" (walletPayTitle) i "Store credit: $X.XX" (walletBalanceLabel).
    // Koristimo oba da precizno identificiramo pravi switch, ne neki drugi na stranici.
    const walletCard = page
      .locator("div")
      .filter({ hasText: "Pay with store credit" })
      .filter({ hasText: /Store credit:/ });

    const walletSwitch = walletCard.getByRole("switch");
    await expect(walletSwitch).toBeVisible({ timeout: 25_000 });
    await walletSwitch.click();

    // Nakon klika prikazuje se "-$X.XX from store credit" i/ili "(covers full order)"
    // Provjera bazirana na stvarnim i18n ključevima:
    //   walletApplied: "-${{amount}} from store credit"
    //   walletCoversFull: "(covers full order)"
    await expect(
      page.getByText(/from store credit|covers full order/i).first(),
    ).toBeVisible({ timeout: 15_000 });

    // ── Place Order ───────────────────────────────────────────────────────────
    const orderResp = page.waitForResponse(
      (r) => r.url().includes("/api/orders") && r.request().method() === "POST",
      { timeout: 45_000 },
    );

    await page.getByRole("button", { name: "Place Order" }).click();

    const resp = await orderResp;
    expect(
      resp.ok(),
      `POST /orders failed: ${resp.status()} ${(await resp.text()).slice(0, 400)}`,
    ).toBeTruthy();

    await expect(page).toHaveURL(/\/order-complete\//, { timeout: 30_000 });
  });
});
