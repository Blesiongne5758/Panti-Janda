// Regression for opening the mobile app drawer over an active chat and navigating to Dashboard.
// Requires `node dev/server.mjs` and a local Vite app with its fixture API proxy.
// This test logs in and reads fixture data only; it never touches production.
import assert from "node:assert/strict";
import { chromium } from "playwright";

const BASE = process.env.PJ_TEST_URL ?? "http://127.0.0.1:5176";
const WIDTHS = [360, 390];
const browser = await chromium.launch({ headless: true });

async function login(page) {
  await page.goto(`${BASE}/#/masuk`, { waitUntil: "networkidle" });
  await page.locator('input[type="email"]').fill("wulan@contoh.id");
  await page.locator('input[type="password"]').fill("rahasia123");
  await page.getByRole("button", { name: /masuk/i }).click();
  await page.waitForURL("**/#/dasbor");
}

try {
  for (const width of WIDTHS) {
    const context = await browser.newContext({ viewport: { width, height: 800 }, isMobile: true });
    const page = await context.newPage();
    const runtimeErrors = [];
    page.on("pageerror", (error) => runtimeErrors.push(error.message));

    try {
      await login(page);
      await page.goto(`${BASE}/#/pesan`, { waitUntil: "domcontentloaded" });
      const group = page.getByRole("button", { name: /Kelompok Menjahit Nusantara/ });
      await group.waitFor({ state: "visible", timeout: 8000 });
      await group.click();
      await page.getByRole("button", { name: "Kembali ke daftar" }).waitFor({ state: "visible" });
      await page.locator("main section header").getByText("Kelompok Menjahit Nusantara", { exact: true }).waitFor({ state: "visible" });

      const menuButton = page.locator("header button").filter({ has: page.locator("svg.lucide-menu") });
      await menuButton.click();
      const drawer = page.locator('[data-slot="sheet-content"]');
      await drawer.waitFor({ state: "visible" });
      const dashboardLink = drawer.locator("a").filter({ hasText: /^Dasbor$/ });
      await dashboardLink.waitFor({ state: "visible" });
      await dashboardLink.click();

      await page.waitForURL("**/#/dasbor");
      await page.getByRole("heading", { name: "Dasbor", exact: true }).waitFor({ state: "visible", timeout: 5000 });
      const mainText = await page.locator("main").innerText();
      assert.ok(mainText.trim().length > 30, `dashboard is blank at ${width}px`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width, `horizontal overflow at ${width}px`);
      assert.deepEqual(runtimeErrors, [], `runtime errors at ${width}px`);
      console.log(`PASS active chat → mobile menu → dashboard @${width}px`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
