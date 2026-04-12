import { test, expect } from "@playwright/test";

/**
 * Full Q&A path: guest asks on product page → admin approves → visible on product.
 * Requires: API on :8080 (Vite proxies /api), seeded DB, PLAYWRIGHT_ADMIN_PASSWORD.
 * API mora biti u NODE_ENV=development s loopbacka (ili DISABLE_RATE_LIMIT=1) da E2E ne udari u 429.
 */
test.describe("Q&A redovan tok", () => {
  test.skip(
    !process.env.PLAYWRIGHT_ADMIN_PASSWORD,
    "Postavi PLAYWRIGHT_ADMIN_PASSWORD (npr. Admin123!) i pokreni API.",
  );

  test("pitanje s product stranice + odobrenje u adminu", async ({ page }) => {
    test.setTimeout(90_000);
    const marker = `Playwright QA ${Date.now()} — Can I reinstall on the same PC after a hardware upgrade?`;
    const askerName = "Playwright Manual";
    const askerEmail = `playwright-qa-${Date.now()}@example.com`;

    // Zatvori cookie banner ako smeta
    await page.goto("/product/windows-11-pro");
    const acceptCookies = page.getByRole("button", { name: /accept all|prihvati|sve kolačiće/i });
    if (await acceptCookies.isVisible().catch(() => false)) {
      await acceptCookies.click().catch(() => {});
    }

    await expect(page.getByRole("heading", { name: "Questions & Answers" })).toBeVisible({ timeout: 30_000 });

    await page.getByRole("button", { name: "Ask a Question" }).click();
    await page.getByPlaceholder("Your name").fill(askerName);
    await page.getByPlaceholder("Your email").fill(askerEmail);
    await page.getByPlaceholder("Your question about this product...").fill(marker);

    const askRespPromise = page.waitForResponse(
      (r) => r.url().includes("/qa/ask") && r.request().method() === "POST",
      { timeout: 25_000 },
    );
    await page.getByRole("button", { name: "Submit Question" }).click();
    const askResp = await askRespPromise;
    const askBody = await askResp.text();
    expect(
      askResp.ok(),
      `POST /qa/ask očekuje 2xx, dobio ${askResp.status()}: ${askBody.slice(0, 500)}`,
    ).toBeTruthy();

    // Uspjeh zatvara formu; toast je sekundarni (Radix / timing).
    await expect(page.getByPlaceholder("Your question about this product...")).toBeHidden({
      timeout: 15_000,
    });

    // Admin: prijava
    await page.goto("/login");
    await page.getByRole("textbox", { name: "Email Address" }).fill("admin@store.com");
    await page.getByRole("textbox", { name: "Password" }).fill(process.env.PLAYWRIGHT_ADMIN_PASSWORD!);
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).toHaveURL(/\/admin/, { timeout: 20_000 });

    await page.goto("/admin/qa");
    await expect(page.getByRole("heading", { name: "Q&A Moderation" })).toBeVisible({ timeout: 20_000 });

    await page.locator(".flex.flex-wrap.gap-2.items-center select").first().selectOption("PENDING");

    const row = page.locator("tbody tr").filter({ hasText: marker });
    await expect(row).toBeVisible({ timeout: 30_000 });

    // Eye, Check (approve), X, Trash — drugi gumb u stupcu akcija je odobri
    const [patchResp] = await Promise.all([
      page.waitForResponse(
        (r) => /\/admin\/qa\/\d+\/status/.test(r.url()) && r.request().method() === "PATCH",
        { timeout: 20_000 },
      ),
      row.locator("td:last-child button").nth(1).click(),
    ]);
    const patchBody = await patchResp.text();
    expect(
      patchResp.ok(),
      `PATCH status očekuje 2xx, dobio ${patchResp.status()}: ${patchBody.slice(0, 300)}`,
    ).toBeTruthy();

    await page.goto("/product/windows-11-pro", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Questions & Answers" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(marker, { exact: false })).toBeVisible({ timeout: 30_000 });
  });
});
