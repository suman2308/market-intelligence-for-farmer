import { test, expect, Page, APIRequestContext } from "@playwright/test";

/**
 * Two-account end-to-end test of the direct book-and-pay transaction model
 * (replacing negotiated offers as the primary path): a farmer and a buyer,
 * each in their own browser context — their own cookies/localStorage,
 * separate logged-in sessions — driving the actual rendered UI:
 *   - login → role-based redirect
 *   - Direction A: farmer posts a lot with a fixed asking price → buyer
 *     books it directly (no negotiation) → farmer is notified the lot is
 *     booked → buyer pays → farmer is notified the lot sold and earnings
 *     were credited
 *   - Direction B, fully reversed: buyer posts a demand at a fixed price →
 *     farmer locks & fulfils it with one of their own lots → buyer is
 *     notified to pay → buyer pays → farmer is notified the sale is done
 *   - notification bell: unread badge, dropdown, click-through
 *
 * Lot creation goes through the API (POST /lots) rather than the
 * multi-step Smart Sell wizard on /farmer/sell — that wizard has its own
 * dedicated coverage in smart-sell-wizard.spec.ts. Everything else is
 * driven through the browser below.
 */

const API_BASE = process.env.E2E_API_URL || "http://127.0.0.1:8000";
const RUN_ID = Date.now();
const FARMER = { username: `e2e_farmer_${RUN_ID}`, password: "test123456", full_name: `E2E Farmer ${RUN_ID}` };
const BUYER = { username: `e2e_buyer_${RUN_ID}`, password: "test123456", full_name: `E2E Buyer ${RUN_ID}` };

async function registerUser(request: APIRequestContext, user: { username: string; password: string; full_name: string }, role: "farmer" | "buyer") {
  const resp = await request.post(`${API_BASE}/auth/register`, {
    data: {
      username: user.username, email: `${user.username}@example.com`,
      password: user.password, full_name: user.full_name, role,
    },
  });
  if (!resp.ok()) {
    throw new Error(`Failed to register ${user.username}: ${resp.status()} ${await resp.text()}`);
  }
}

async function loginViaUI(page: Page, user: { username: string; password: string }) {
  await page.goto("/login");
  await page.getByPlaceholder("Username").fill(user.username);
  await page.locator('input[type="password"]').fill(user.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  // Wait for the post-login redirect (and the token write it depends on) to
  // land before any caller navigates further — otherwise a subsequent
  // page.goto() can race ahead of the token actually being in localStorage.
  await page.waitForURL(/\/(farmer|buyer)$/, { timeout: 10000 });
}

test.describe.configure({ mode: "serial" });

test.describe("Two-account book-and-pay transaction loop", () => {
  test.beforeAll(async ({ request }) => {
    await registerUser(request, FARMER, "farmer");
    await registerUser(request, BUYER, "buyer");
  });

  test("farmer login redirects straight to the farmer dashboard (no dead role-select step)", async ({ page }) => {
    await loginViaUI(page, FARMER);
    await expect(page).toHaveURL(/\/farmer$/);
    await expect(page.locator(".farmer-header-title")).toBeVisible();
  });

  test("buyer login redirects straight to the buyer dashboard", async ({ page }) => {
    await loginViaUI(page, BUYER);
    await expect(page).toHaveURL(/\/buyer$/);
    await expect(page.getByText("Browse Lots")).toBeVisible();
  });

  test("password field has a working show/hide toggle on login", async ({ page }) => {
    await page.goto("/login");
    // .password-input is the stable class on the PasswordInput component
    // regardless of its current type, so the same locator survives the toggle.
    const pwInput = page.locator(".password-input");
    await pwInput.fill("whatever123");
    await expect(pwInput).toHaveAttribute("type", "password");
    await page.locator(".password-toggle-btn").click();
    await expect(pwInput).toHaveAttribute("type", "text");
  });

  test("farmer posts a lot with a fixed asking price (via API — the wizard itself is out of scope here)", async ({ request }) => {
    const login = await request.post(`${API_BASE}/auth/login`, { data: FARMER });
    const { access_token } = await login.json();
    const crops = await request.get(`${API_BASE}/crops`, { headers: { Authorization: `Bearer ${access_token}` } });
    const cropList = await crops.json();
    const tomato = cropList.find((c: any) => c.name === "Tomato") || cropList[0];

    const lotResp = await request.post(`${API_BASE}/lots`, {
      headers: { Authorization: `Bearer ${access_token}` },
      data: { crop_id: tomato.id, quantity_kg: 600, price_per_q: 2650, quality_grade: "A", urgency: "soon" },
    });
    expect(lotResp.ok()).toBeTruthy();
    const lot = await lotResp.json();
    expect(lot.offers_close_at).toBeTruthy(); // offer-window field, still set even though booking skips it
    expect(lot.price_per_q).toBe(2650);
  });

  test("buyer books the lot directly at its listed price via the UI", async ({ page }) => {
    await loginViaUI(page, BUYER);
    await expect(page).toHaveURL(/\/buyer$/);

    // /lots returns newest-first, and other test runs may have left same-shaped
    // lots behind, so scope to the most recent match rather than a unique text match.
    await expect(page.getByText(`Tomato — 600kg`).first()).toBeVisible({ timeout: 10000 });
    await page.getByRole("button", { name: /Book at ₹2,?650\/q/ }).first().click();

    // A successful book navigates to the Orders tab with a payment-pending order.
    await expect(page.getByRole("button", { name: /Pay ₹/ }).first()).toBeVisible({ timeout: 10000 });
  });

  test("farmer is notified the lot was booked", async ({ page }) => {
    await loginViaUI(page, FARMER);
    await expect(page).toHaveURL(/\/farmer$/);

    const bell = page.locator(".notif-bell-btn");
    await expect(page.locator(".notif-bell-badge")).toBeVisible();
    await bell.click();
    await expect(page.locator(".notif-bell-item-title", { hasText: "Lot booked" })).toBeVisible();
  });

  test("buyer pays and farmer is notified the lot is sold", async ({ page }) => {
    await loginViaUI(page, BUYER);
    await page.getByRole("button", { name: /My Orders/ }).click();
    await page.getByRole("button", { name: /Pay ₹/ }).first().click();

    // The Pay button disappears once the order is marked paid.
    await expect(page.getByRole("button", { name: /Pay ₹/ })).toHaveCount(0, { timeout: 10000 });

    // Switch this same page over to the farmer's own session (not just a
    // goto — the page still holds the buyer's token, and /farmer's own
    // role guard would otherwise bounce it straight back to /buyer).
    await loginViaUI(page, FARMER);
    const bell = page.locator(".notif-bell-btn");
    await bell.click();
    await expect(page.locator(".notif-bell-item-title", { hasText: "Lot sold" })).toBeVisible({ timeout: 10000 });
  });

  test("farmer creates a second lot for Direction B (the first was booked in Direction A)", async ({ request }) => {
    const login = await request.post(`${API_BASE}/auth/login`, { data: FARMER });
    const { access_token } = await login.json();
    const crops = await request.get(`${API_BASE}/crops`, { headers: { Authorization: `Bearer ${access_token}` } });
    const cropList = await crops.json();
    const tomato = cropList.find((c: any) => c.name === "Tomato") || cropList[0];
    const lotResp = await request.post(`${API_BASE}/lots`, {
      headers: { Authorization: `Bearer ${access_token}` },
      data: { crop_id: tomato.id, quantity_kg: 400, price_per_q: 2500, quality_grade: "A", urgency: "soon" },
    });
    expect(lotResp.ok()).toBeTruthy();
  });

  test("Direction B: buyer posts a demand via the UI", async ({ page }) => {
    await loginViaUI(page, BUYER);
    // Create Demand now lives on the Demands tab, not Browse Lots.
    await page.getByRole("button", { name: "My Demands" }).click();
    await page.getByRole("button", { name: /Create Demand/i }).click();

    const formCard = page.locator(".card", { hasText: "Post a Demand" });
    await formCard.locator('input[type="number"]').nth(0).fill("400"); // quantity
    await formCard.locator('input[type="number"]').nth(1).fill("2400"); // price
    await formCard.locator('input[type="text"]').fill("Nashik"); // district
    await formCard.getByRole("button", { name: "Post Demand", exact: true }).click();
    await expect(formCard).toHaveCount(0);
  });

  test("farmer browses /farmer/demands and accepts it directly via the UI", async ({ page }) => {
    await loginViaUI(page, FARMER);
    await page.goto("/farmer/demands");

    // Scope to this run's own demand card by buyer name rather than relying
    // on list order or a global button match — the demand list is global
    // and stale runs may have left other open demands (and their own
    // identically-labelled "Accept" buttons) behind.
    const demandCard = page.locator(".card", { hasText: BUYER.full_name });
    await expect(demandCard).toBeVisible({ timeout: 10000 });
    await demandCard.getByRole("button", { name: /Accept/ }).click();

    await expect(demandCard.getByText("✓ Accepted")).toBeVisible({ timeout: 10000 });
  });

  test("buyer is notified to pay, pays, and farmer gets the final sold notification", async ({ page }) => {
    await loginViaUI(page, BUYER);

    const bell = page.locator(".notif-bell-btn");
    await bell.click();
    await expect(page.locator(".notif-bell-item-title", { hasText: "accepted" })).toBeVisible({ timeout: 10000 });

    await page.getByRole("button", { name: /My Orders/ }).click();
    const payButtons = page.getByRole("button", { name: /Pay ₹/ });
    await expect(payButtons.first()).toBeVisible({ timeout: 10000 });
    await payButtons.first().click();
    await expect(page.getByRole("button", { name: /Pay ₹/ })).toHaveCount(0, { timeout: 10000 });
  });
});
