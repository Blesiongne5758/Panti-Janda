const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1',
    ignoreHTTPSErrors: true
  });
  const page = await context.newPage();

  try {
    console.log('Navigating to https://www.pantijanda.my.id...');
    await page.goto('https://www.pantijanda.my.id', { waitUntil: 'networkidle', timeout: 60000 });

    console.log('--- UI Mobile View Checks ---');

    // 1. Check Mobile Navigation
    const navExists = await page.locator('div.fixed.bottom-0').isVisible();
    console.log(`Mobile Navigation exists: ${navExists}`);

    if (navExists) {
      const navText = await page.innerText('div.fixed.bottom-0');
      const expected = ['Home', 'Market', 'Post', 'Inbox', 'Profile'];
      const allFound = expected.every(item => navText.includes(item));
      console.log(`All nav items found: ${allFound}`);
    }

    // 2. Check Theme Colors (via Computed Styles)
    const bgColor = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--background').trim();
    });
    console.log(`Computed --background: ${bgColor}`);

    const primaryColor = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
    });
    console.log(`Computed --primary: ${primaryColor}`);

    // 3. Check Background Image (Marvel)
    const bodyStyle = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).backgroundImage;
    });
    const hasMarvelBg = bodyStyle.includes('unsplash.com') || bodyStyle.includes('hero');
    console.log(`Marvel background applied: ${hasMarvelBg}`);

    await page.screenshot({ path: 'debug_mobile_view.png', fullPage: true });
    console.log('Screenshot saved to debug_mobile_view.png');

  } catch (err) {
    console.error('Error during verification:', err);
  } finally {
    await browser.close();
  }
})();
