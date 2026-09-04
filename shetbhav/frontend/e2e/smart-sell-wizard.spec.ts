import { test, expect, APIRequestContext } from "@playwright/test";

/**
 * Regression test for the "Create Lot & Find Buyers" button on the Smart
 * Sell wizard result screen (farmer/sell/page.tsx). It previously called
 * POST /lots inside a try/catch with an EMPTY catch block — any failure
 * (validation, expired auth, network) was silently swallowed, so a user
 * clicking it got zero feedback: no navigation, no error, nothing. Fixed
 * to surface errors via the existing `error` state and show a loading
 * state on the button while the request is in flight.
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

test("Smart Sell wizard: Create Lot & Find Buyers actually creates the lot and navigates home", async ({ page, request }) => {
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

  // Result step
  await expect(page.getByRole("button", { name: /Create Lot & Find Buyers/ })).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: /Create Lot & Find Buyers/ }).click();

  // Must actually navigate — this is exactly what silently failed before the fix.
  await expect(page).toHaveURL(/\/farmer$/, { timeout: 10000 });

  // And the lot must really exist server-side, not just a client-side redirect.
  const login = await request.post(`${API_BASE}/auth/login`, { data: FARMER });
  const { access_token } = await login.json();
  const lots = await request.get(`${API_BASE}/lots`, { headers: { Authorization: `Bearer ${access_token}` } });
  const lotList = await lots.json();
  expect(lotList.length).toBeGreaterThan(0);
});
