import { test, expect } from "@playwright/test";

test.describe("storefront smoke", () => {
  test("home loads", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/PixelCodes/i);
    await expect(page.getByPlaceholder(/Search for software/i)).toBeVisible({ timeout: 15_000 });
  });

  test("shop listing loads", async ({ page }) => {
    await page.goto("/shop");
    await expect(page.getByRole("heading", { name: "Shop", exact: true }).first()).toBeVisible({ timeout: 15_000 });
  });

  test("product detail loads", async ({ page }) => {
    await page.goto("/product/windows-11-pro");
    await expect(page.getByRole("heading", { name: "Windows 11 Pro", exact: true })).toBeVisible({ timeout: 15_000 });
  });

  test("FAQ loads", async ({ page }) => {
    await page.goto("/faq");
    await expect(page.getByRole("heading", { name: "Frequently Asked Questions" })).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("admin gate", () => {
  test("unauthenticated /admin redirects to login", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });
});

test.describe("admin login", () => {
  test.skip(
    !process.env.PLAYWRIGHT_ADMIN_PASSWORD,
    "Set PLAYWRIGHT_ADMIN_PASSWORD (and run API + seeded admin) to run admin login smoke.",
  );

  test("super admin reaches dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("textbox", { name: "Email Address" }).fill("admin@store.com");
    await page.getByRole("textbox", { name: "Password" }).fill(process.env.PLAYWRIGHT_ADMIN_PASSWORD!);
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).toHaveURL(/\/admin\/?$/, { timeout: 20_000 });
    await expect(page.getByText(/Dashboard|Analytics|Products/i).first()).toBeVisible({ timeout: 15_000 });
  });
});
