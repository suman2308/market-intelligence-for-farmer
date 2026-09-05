import { test, expect, Page, APIRequestContext } from "@playwright/test";

/**
 * Tests the P1 batch: clicking a lot or demand shows a detail page with
 * the poster's identity, and from there a "View Profile" button opens the
 * counterparty's profile (name, role, business info, contact) — reached
 * through the real UI, not just the API.
 */

const API_BASE = process.env.E2E_API_URL || "http://127.0.0.1:8000";
const RUN_ID = Date.now();
const FARMER = { username: `e2e_detail_farmer_${RUN_ID}`, password: "test123456", full_name: `Detail Farmer ${RUN_ID}` };
const BUYER = { username: `e2e_detail_buyer_${RUN_ID}`, password: "test123456", full_name: `Detail Buyer Co ${RUN_ID}` };

async function registerUser(request: APIRequestContext, user: { username: string; password: string; full_name: string }, role: "farmer" | "buyer") {
  const resp = await request.post(`${API_BASE}/auth/register`, {
    data: {
      username: user.username, email: `${user.username}@example.com`,
      password: user.password, full_name: user.full_name, role,
    },
  });
  if (!resp.ok()) throw new Error(`Register failed: ${resp.status()} ${await resp.text()}`);
}

async function loginViaUI(page: Page, user: { username: string; password: string }) {
  await page.goto("/login");
  await page.getByPlaceholder("Username").fill(user.username);
  await page.locator('input[type="password"]').fill(user.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/(farmer|buyer)$/, { timeout: 10000 });
}

test.describe.configure({ mode: "serial" });

test.describe("Lot/demand detail pages and counterparty profiles", () => {
  test.beforeAll(async ({ request }) => {
    await registerUser(request, FARMER, "farmer");
    await registerUser(request, BUYER, "buyer");
  });

  test("buyer clicks a lot, sees farmer identity on the detail page, and views their profile", async ({ page, request }) => {
    const login = await request.post(`${API_BASE}/auth/login`, { data: FARMER });
    const { access_token } = await login.json();
    const crops = await request.get(`${API_BASE}/crops`, { headers: { Authorization: `Bearer ${access_token}` } });
    const cropList = await crops.json();
    const tomato = cropList.find((c: any) => c.name === "Tomato") || cropList[0];
    await request.post(`${API_BASE}/lots`, {
      headers: { Authorization: `Bearer ${access_token}` },
      data: { crop_id: tomato.id, quantity_kg: 500, price_per_q: 2600, quality_grade: "A", urgency: "soon" },
    });

    await loginViaUI(page, BUYER);
    await expect(page.getByText(`Tomato — 500kg`).first()).toBeVisible({ timeout: 10000 });
    await page.getByText(`Tomato — 500kg`).first().click();

    await page.waitForURL(/\/lots\/\d+/, { timeout: 10000 });
    await expect(page.getByText(FARMER.full_name)).toBeVisible();
    await expect(page.getByText("₹2,600")).toBeVisible();

    await page.getByRole("button", { name: "View Profile" }).click();
    await page.waitForURL(/\/profile\/\d+/, { timeout: 10000 });
    await expect(page.getByText(FARMER.full_name)).toBeVisible();
    await expect(page.getByText(`@${FARMER.username}`)).toBeVisible();
  });

  test("farmer clicks a demand, sees buyer identity on the detail page, and views their profile", async ({ page, request }) => {
    const login = await request.post(`${API_BASE}/auth/login`, { data: BUYER });
    const { access_token } = await login.json();
    await request.post(`${API_BASE}/demand`, {
      headers: { Authorization: `Bearer ${access_token}` },
      data: { crop_id: 1, quantity_kg: 350, district: "Nashik", offered_price_per_q: 2450 },
    });

    await loginViaUI(page, FARMER);
    await page.goto("/farmer/demands");
    const demandCard = page.locator(".card", { hasText: BUYER.full_name });
    await expect(demandCard).toBeVisible({ timeout: 10000 });
    // Click on the buyer-name text itself, which sits inside the header div
    // that actually carries the onClick — the card below it also has a
    // "Lock & Fulfil" button, so clicking an arbitrary point on the whole
    // card is unreliable.
    await demandCard.getByText(BUYER.full_name).click();

    await page.waitForURL(/\/demands\/\d+/, { timeout: 10000 });
    await expect(page.getByText(BUYER.full_name)).toBeVisible();
    await expect(page.getByText("₹2,450")).toBeVisible();

    await page.getByRole("button", { name: "View Profile" }).click();
    await page.waitForURL(/\/profile\/\d+/, { timeout: 10000 });
    await expect(page.getByText(BUYER.full_name)).toBeVisible();
    await expect(page.getByText(`@${BUYER.username}`)).toBeVisible();
    // Buyer profile shows business-specific fields.
    await expect(page.getByText("Trust score")).toBeVisible();
  });
});
