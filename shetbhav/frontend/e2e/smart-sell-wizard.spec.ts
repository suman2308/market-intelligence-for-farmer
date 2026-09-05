import { test, expect, APIRequestContext } from "@playwright/test";

/**
 * Smart Sell wizard result screen (farmer/sell/page.tsx): its "Create a
 * Lot" button no longer creates the lot directly — it hands the
 * crop/quantity/grade/urgency the farmer already chose off to the My Lots
 * tab's own create-lot form via query params, prefilling and auto-opening
 * it there (the wizard itself doesn't collect a price anymore; that's set
 * on the My Lots form). This covers that handoff actually creates the lot
 * server-side once the farmer sets a price and submits.
 */

const API_BASE = process.env.E2E_API_URL || "http://127.0.0.1:8000";
const RUN_ID = Date.now();
const FARMER = { username: `e2e_wizard_${RUN_ID}`, password: "test123456", full_name: `E2E Wizard ${RUN_ID}` };

async function registerFarmer(request: APIRequestContext) {
  const resp = await request.post(`${API_BASE}/auth/register`, {
    data: {
      username: FARMER.username, email: `${FARMER.username}@example.com`,
      password: FARMER.password, full_name: FARMER.full_name, role: "farmer",
    },
  });
  if (!resp.ok()) throw new Error(`Register failed: ${resp.status()} ${await resp.text()}`);
}

test("Smart Sell wizard: Create a Lot hands off to My Lots and the lot gets created", async ({ page, request }) => {
  await registerFarmer(request);

  await page.goto("/login");
  await page.getByPlaceholder("Username").fill(FARMER.username);
  await page.locator('input[type="password"]').fill(FARMER.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/farmer$/, { timeout: 10000 });

  await page.goto("/farmer/sell");

  // Step 0: crop
  await page.locator(".toggle-btn").first().click();
  // Step 1: quantity (default value is fine) -> Next
  await page.getByRole("button", { name: "Next →" }).click();
  // Step 2: quality grade
  await page.getByText("Grade A").click();
  // Step 3: urgency
  await page.getByText("Within 3-5 days").click();
  // Step 4: storage
  await page.getByText("Yes, I have storage").click();
  // Step 5: confirm -> analyze
  await page.getByRole("button", { name: /Find Best Options/ }).click();

  // Result step — "Create a Lot" hands off to /farmer/lots, prefilled and open.
  await expect(page.getByRole("button", { name: /Create a Lot/ })).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: /Create a Lot/ }).click();

  await page.waitForURL(/\/farmer\/lots\?/, { timeout: 10000 });
  await expect(page.getByRole("button", { name: "List this produce" })).toBeVisible({ timeout: 10000 });

  // Quantity was carried over from the wizard; only the price still needs
  // to be set on this form (the wizard no longer collects one).
  const priceInput = page.locator('input[type="number"]').nth(1);
  await priceInput.fill("2400");
  await page.getByRole("button", { name: "List this produce" }).click();

  // Must actually create the lot server-side, not just look like it did.
  const login = await request.post(`${API_BASE}/auth/login`, { data: FARMER });
  const { access_token } = await login.json();
  const lots = await request.get(`${API_BASE}/lots`, { headers: { Authorization: `Bearer ${access_token}` } });
  const lotList = await lots.json();
  expect(lotList.some((l: any) => l.price_per_q === 2400)).toBeTruthy();
});
