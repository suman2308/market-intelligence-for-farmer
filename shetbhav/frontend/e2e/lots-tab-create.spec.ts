import { test, expect, APIRequestContext } from "@playwright/test";

/**
 * The farmer nav was reworked so lot creation, active lots, and order
 * history all live together on one "My Lots" tab (replacing the separate
 * Sell/Orders tabs), with a direct create-lot form rather than the Smart
 * Sell wizard. This covers that the form actually creates a lot server-side
 * and shows it in the active lots list — not just a client-side illusion.
 */

const API_BASE = process.env.E2E_API_URL || "http://127.0.0.1:8000";
const RUN_ID = Date.now();
const FARMER = { username: `e2e_lotstab_${RUN_ID}`, password: "test123456", full_name: `E2E LotsTab ${RUN_ID}` };

async function registerFarmer(request: APIRequestContext) {
  const resp = await request.post(`${API_BASE}/auth/register`, {
    data: {
      username: FARMER.username, email: `${FARMER.username}@example.com`,
      password: FARMER.password, full_name: FARMER.full_name, role: "farmer",
    },
  });
  if (!resp.ok()) throw new Error(`Register failed: ${resp.status()} ${await resp.text()}`);
}

test("My Lots tab: direct create-lot form lists the new lot as active", async ({ page, request }) => {
  await registerFarmer(request);

  await page.goto("/login");
  await page.getByPlaceholder("Username").fill(FARMER.username);
  await page.locator('input[type="password"]').fill(FARMER.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/farmer$/, { timeout: 10000 });

  await page.goto("/farmer/lots");
  await page.getByRole("button", { name: /Create a Lot/ }).click();

  // The crop select's value comes from an async default-fill once /crops
  // resolves — explicitly choosing a value (even the one already showing)
  // forces a real onChange, so this doesn't race that default-fill. Wait
  // for the option to actually exist first (the select renders empty
  // until /crops resolves).
  const cropSelect = page.locator("select").first();
  await cropSelect.locator("option", { hasText: "Tomato" }).waitFor({ state: "attached" });
  await cropSelect.selectOption({ label: "🍅 Tomato" });
  await page.locator('input[type="number"]').first().fill("777");
  await page.locator('input[type="number"]').nth(1).fill("3100");
  await page.getByRole("button", { name: "List this produce" }).click();

  await expect(page.getByText("777kg")).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(/₹3,100\/q/)).toBeVisible();

  // Really exists server-side, not just an optimistic client-side render.
  const login = await request.post(`${API_BASE}/auth/login`, { data: FARMER });
  const { access_token } = await login.json();
  const lots = await request.get(`${API_BASE}/lots`, { headers: { Authorization: `Bearer ${access_token}` } });
  const lotList = await lots.json();
  expect(lotList.some((l: any) => l.quantity_kg === 777 && l.price_per_q === 3100)).toBeTruthy();
});
