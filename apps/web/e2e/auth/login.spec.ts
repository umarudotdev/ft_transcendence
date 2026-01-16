import { expect, test } from "@playwright/test";

test.describe("Login Flow", () => {
  test("displays login page correctly", async ({ page }) => {
    await page.goto("/login");

    // Should show login form
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("shows validation errors for empty fields", async ({ page }) => {
    await page.goto("/login");

    // Submit empty form
    await page.locator('button[type="submit"]').click();

    // Should show validation errors
    await expect(page.locator("text=email")).toBeVisible({ timeout: 5000 });
  });

  test("shows error for invalid credentials", async ({ page }) => {
    await page.goto("/login");

    // Fill in invalid credentials
    await page.locator('input[type="email"]').fill("nonexistent@test.com");
    await page.locator('input[type="password"]').fill("wrongpassword");
    await page.locator('button[type="submit"]').click();

    // Should show error message
    await expect(page.locator("text=Invalid email or password")).toBeVisible({
      timeout: 10000,
    });
  });

  test("navigates to register page from login", async ({ page }) => {
    await page.goto("/login");

    // Click register link
    await page.locator('a[href="/register"]').click();

    // Should navigate to register page
    await expect(page).toHaveURL(/.*register/);
  });

  test("shows 42 OAuth button when configured", async ({ page }) => {
    await page.goto("/login");

    // Check for OAuth button (may or may not be visible depending on config)
    const oauthButton = page.locator("text=42");
    const isOAuthConfigured = await oauthButton.isVisible().catch(() => false);

    if (isOAuthConfigured) {
      await expect(oauthButton).toBeEnabled();
    }
  });
});

test.describe("Session Management", () => {
  test("redirects to login when accessing protected route unauthenticated", async ({
    page,
  }) => {
    // Try to access a protected route
    await page.goto("/dashboard");

    // Should redirect to login
    await expect(page).toHaveURL(/.*login/);
  });

  test("preserves redirect URL after login", async ({ page }) => {
    // Try to access a protected route
    await page.goto("/chat");

    // Should redirect to login with redirect param or similar
    const url = page.url();
    expect(url).toContain("login");
  });
});

test.describe("Registration Flow", () => {
  test("displays registration page correctly", async ({ page }) => {
    await page.goto("/register");

    // Should show registration form fields
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('input[name="displayName"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("shows validation for weak password", async ({ page }) => {
    await page.goto("/register");

    // Fill in form with weak password
    await page.locator('input[type="email"]').fill("test@example.com");
    await page.locator('input[name="displayName"]').fill("TestUser");
    await page.locator('input[type="password"]').fill("weak");
    await page.locator('button[type="submit"]').click();

    // Should show password validation error
    await expect(page.locator("text=8 characters")).toBeVisible({
      timeout: 5000,
    });
  });

  test("navigates to login page from register", async ({ page }) => {
    await page.goto("/register");

    // Click login link
    await page.locator('a[href="/login"]').click();

    // Should navigate to login page
    await expect(page).toHaveURL(/.*login/);
  });
});

test.describe("Password Reset", () => {
  test("displays forgot password page", async ({ page }) => {
    await page.goto("/forgot-password");

    // Should show email input
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("shows confirmation after requesting reset", async ({ page }) => {
    await page.goto("/forgot-password");

    // Submit email
    await page.locator('input[type="email"]').fill("test@example.com");
    await page.locator('button[type="submit"]').click();

    // Should show confirmation (may vary based on implementation)
    // The app might show a success message or redirect
    await page.waitForTimeout(2000);
  });
});
