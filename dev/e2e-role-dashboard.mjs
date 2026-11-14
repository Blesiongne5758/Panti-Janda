// Mobile regression for non-widow dashboard access, including legacy generic-public.
// Requires the isolated fixture server (node dev/server.mjs) and local Vite UI
// (VITE_SUPABASE_URL=http://127.0.0.1:5176 ... npm run dev -- --port 5176).
// This test only logs in and reads fixture data; it never writes to production.
import assert from "node:assert/strict";
import { chromium } from "playwright";

const BASE = process.env.PJ_TEST_URL ?? "http://127.0.0.1:5176";
const WIDTHS = [320, 360, 390];
const ACCOUNTS = [
  { role: "Kades", email: "budi@contoh.id" },
  { role: "legacy public", email: "legacy-public@local.test" },
];
const browser = await chromium.launch({ headless: true });

async function login(page, email) {
  await page.goto(`${BASE}/#/masuk`, { waitUntil: "networkidle" });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill("rahasia123");
  await page.getByRole("button", { name: /masuk/i }).click();
  await page.waitForURL("**/#/feed");
}

try {
  for (const account of ACCOUNTS) {
    for (const width of WIDTHS) {
      for (const entry of ["home-cta", "mobile-menu"]) {
        const context = await browser.newContext({
          viewport: { width, height: 800 },
          isMobile: true,
        });
        const page = await context.newPage();
        const runtimeErrors = [];
        const forbiddenRequests = [];
        page.on("pageerror", (error) => runtimeErrors.push(error.message));
        page.on("response", async (response) => {
          if (!response.url().includes("/functions/v1/app") || response.status() !== 403) return;
          const action = response.request().postData()?.match(/"action":"([^"]+)"/)?.[1];
          if (action) forbiddenRequests.push(action);
        });

        try {
          await login(page, account.email);
          if (entry === "home-cta") {
            await page.goto(`${BASE}/#/`, { waitUntil: "networkidle" });
            await page.getByRole("link", { name: /buka dasbor saya/i }).click();
          } else {
            await page.locator("header button").filter({ has: page.locator("svg.lucide-menu") }).click();
            await page.locator('[data-slot="sheet-content"] a').filter({ hasText: /^Dasbor$/ }).click();
          }

          await page.waitForURL("**/#/dasbor");
          await page.getByRole("heading", { name: "Dasbor", exact: true }).waitFor({
            state: "visible",
            timeout: 3000,
          });
          const mainText = await page.locator("main").innerText();
          assert.match(mainText, /Ruang dukungan komunitas/, `${account.role} ${entry} @${width}px lost the public dashboard content`);
          assert.equal(
            await page.evaluate(() => document.documentElement.scrollWidth),
            width,
            `${account.role} ${entry} @${width}px caused horizontal overflow`,
          );
          assert.deepEqual(forbiddenRequests, [], `${account.role} ${entry} @${width}px made an endpoint request forbidden to this role`);
          assert.deepEqual(runtimeErrors, [], `${account.role} ${entry} @${width}px caused an uncaught runtime error`);
          console.log(`PASS ${account.role} dashboard via ${entry} @${width}px`);
        } finally {
          await context.close();
        }
      }
    }
  }
} finally {
  await browser.close();
}
