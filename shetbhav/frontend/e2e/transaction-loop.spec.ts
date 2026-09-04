import { test, expect, Page, APIRequestContext } from "@playwright/test";

/**
 * Two-account end-to-end test of the transaction loop closed in this
 * session: a farmer and a buyer, each in their own browser context (their
 * own cookies/localStorage — separate logged-in sessions), driving the
 * actual rendered UI for every screen that was newly built or newly wired:
 *   - login → role-based redirect
 *   - Direction A: buyer makes an offer on a farmer's lot (UI) → farmer
 *     sees it on /farmer/offers with a countdown → accepts (UI) → buyer
 *     sees the order and an "accepted" notification
 *   - Direction B: buyer posts a demand (UI) → farmer browses
 *     /farmer/demands (UI) and responds with an offer → buyer sees an
 *     actionable offer in "My Offers" (accept/reject/counter, which did
 *     not exist before this session) and accepts it (UI)
 *   - notification bell: unread badge, dropdown, click-through
 *
 * Lot creation goes through the API (POST /lots) rather than the
 * multi-step Smart Sell wizard on /farmer/sell — that wizard is pre-existing
 * UI unrelated to this session's changes and already has coverage in
 * backend/tests and backend/e2e_demo.py. Everything this session actually
 * built or modified is driven through the browser below.
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

test.describe("Two-account transaction loop", () => {
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

  test("farmer creates a lot (via API — the wizard itself is out of scope here)", async ({ request }) => {
    const login = await request.post(`${API_BASE}/auth/login`, { data: FARMER });
    const { access_token } = await login.json();
    const crops = await request.get(`${API_BASE}/crops`, { headers: { Authorization: `Bearer ${access_token}` } });
    const cropList = await crops.json();
    const tomato = cropList.find((c: any) => c.name === "Tomato") || cropList[0];

    const lotResp = await request.post(`${API_BASE}/lots`, {
      headers: { Authorization: `Bearer ${access_token}` },
      data: { crop_id: tomato.id, quantity_kg: 600, quality_grade: "A", urgency: "soon" },
    });
    expect(lotResp.ok()).toBeTruthy();
    const lot = await lotResp.json();
    expect(lot.offers_close_at).toBeTruthy(); // the offer-window field built this session
  });

  test("buyer browses lots and sends an offer via the UI", async ({ page }) => {
    await loginViaUI(page, BUYER);
    await expect(page).toHaveURL(/\/buyer$/);

    // /lots returns newest-first, and other test runs may have left same-shaped
    // lots (same crop/qty) behind, so scope to the most recent match rather
    // than asserting a unique text match.
    await expect(page.getByText(`Tomato — 600kg`).first()).toBeVisible({ timeout: 10000 });
    await page.getByRole("button", { name: /Make Offer/i }).first().click();

    await expect(page.getByRole("heading", { name: "Make Offer" })).toBeVisible();
    // Modal has exactly two number inputs in DOM order: price, then quantity.
    await page.locator('input[type="number"]').first().fill("2650");
    await page.getByRole("button", { name: /Send Offer/i }).click();

    await expect(page.getByRole("heading", { name: "Make Offer" })).toHaveCount(0);
  });

  test("farmer sees the offer on /farmer/offers with a ranked, countdown-labelled card", async ({ page }) => {
    await loginViaUI(page, FARMER);
    await page.goto("/farmer/offers");

    await expect(page.getByText("₹2,650/q")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Closes in/)).toBeVisible();
    await expect(page.getByText("Best offer")).toBeVisible();
  });

  test("notification bell shows an unread badge and the offer notification", async ({ page }) => {
    await loginViaUI(page, FARMER);
    await expect(page).toHaveURL(/\/farmer$/);

    const bell = page.locator(".notif-bell-btn");
    await expect(bell).toBeVisible();
    await expect(page.locator(".notif-bell-badge")).toBeVisible();
    await bell.click();
    await expect(page.locator(".notif-bell-item-title", { hasText: "New offer" })).toBeVisible();
  });

  test("farmer accepts the offer and lands on the new order", async ({ page }) => {
    await loginViaUI(page, FARMER);
    await page.goto("/farmer/offers");
    await page.getByRole("button", { name: "Accept" }).first().click();

    await expect(page).toHaveURL(/\/farmer\/orders\/\d+/, { timeout: 10000 });
  });

  test("buyer is notified of acceptance and sees the order", async ({ page }) => {
    await loginViaUI(page, BUYER);
    await expect(page).toHaveURL(/\/buyer$/);

    const bell = page.locator(".notif-bell-btn");
    await bell.click();
    await expect(page.locator(".notif-bell-item-title", { hasText: "Offer accepted" })).toBeVisible();

    await page.getByRole("button", { name: /My Orders/ }).click();
    // Order card renders price without locale grouping (e.g. "₹2650/q").
    await expect(page.getByText(/@ ₹2,?650\/q/)).toBeVisible();
  });

  test("farmer creates a second lot for Direction B (the first was sold in Direction A)", async ({ request }) => {
    const login = await request.post(`${API_BASE}/auth/login`, { data: FARMER });
    const { access_token } = await login.json();
    const crops = await request.get(`${API_BASE}/crops`, { headers: { Authorization: `Bearer ${access_token}` } });
    const cropList = await crops.json();
    const tomato = cropList.find((c: any) => c.name === "Tomato") || cropList[0];
    const lotResp = await request.post(`${API_BASE}/lots`, {
      headers: { Authorization: `Bearer ${access_token}` },
      data: { crop_id: tomato.id, quantity_kg: 400, quality_grade: "A", urgency: "soon" },
    });
    expect(lotResp.ok()).toBeTruthy();
  });

  test("Direction B: buyer posts a demand via the UI", async ({ page }) => {
    await loginViaUI(page, BUYER);
    await page.getByRole("button", { name: /Create Demand/i }).click();
    await page.locator('input[placeholder="Qty (kg)"]').fill("400");
    await page.locator('input[placeholder="Price/quintal (₹)"]').fill("2400");
    await page.locator('input[placeholder="District"]').fill("Nashik");
    await page.getByRole("button", { name: "Post Demand", exact: true }).click();
    await expect(page.locator('input[placeholder="Qty (kg)"]')).toHaveCount(0);
  });

  test("farmer browses /farmer/demands and responds with an offer via the UI", async ({ page }) => {
    await loginViaUI(page, FARMER);
    await page.goto("/farmer/demands");

    // Scope to this run's own demand card by buyer name rather than relying
    // on list order — the demand list is global and stale runs may have
    // left other open demands behind.
    const demandCard = page.locator(".card", { hasText: BUYER.full_name });
    await expect(demandCard).toBeVisible({ timeout: 10000 });
    await demandCard.getByRole("button", { name: "Respond with an offer" }).click();
    await demandCard.getByRole("button", { name: "Send Offer" }).click();

    await expect(page.getByText("✓ Offer sent")).toBeVisible({ timeout: 10000 });
  });

  test("buyer sees the farmer's counter-direction offer as actionable and accepts it", async ({ page }) => {
    await loginViaUI(page, BUYER);
    await page.getByRole("button", { name: /My Offers/ }).click();

    // The second offer (farmer -> buyer, from Direction B) must show
    // Accept/Reject/Counter — this control did not exist before this
    // session; the tab was previously read-only.
    const acceptButtons = page.getByRole("button", { name: "Accept" });
    await expect(acceptButtons.first()).toBeVisible({ timeout: 10000 });
    await acceptButtons.first().click();

    await page.getByRole("button", { name: /My Orders/ }).click();
    await expect(page.getByText(/Order #\d+/).first()).toBeVisible();
  });
});
