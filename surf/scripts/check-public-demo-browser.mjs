import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
const base = process.argv[2];
assert(["https://staging.mywaveplan.com", "https://mywaveplan.com"].includes(base));
const { chromium } = await import(pathToFileURL(process.env.MWP_PLAYWRIGHT_MODULE || "/Users/pawel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs"));
const browser = await chromium.launch({ channel: "chrome", headless: true });
const checks = [];
try {
  for (const mobile of [false, true]) {
    // Isolated contexts leave the owner's browser sessions untouched.
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, isMobile: mobile, hasTouch: mobile, colorScheme: mobile ? "dark" : "light" });
    const page = await context.newPage();page.setDefaultTimeout(30000);
    const errors = [];page.on("pageerror", error => errors.push(error.message));
    const responses = [];page.on("response", response => { const url = new URL(response.url());if (url.pathname.startsWith("/api/")) responses.push({ path: url.pathname, status: response.status() }); });
    const prefix = `/private/tmp/mwp-demo-${base.includes("staging") ? "staging" : "production"}-${mobile ? "mobile" : "desktop"}`;
    try {
      await page.goto(base + "/login");
      await page.getByRole("button", { name: "Try the demo", exact: true }).waitFor();
      if (mobile) {
        // The explicit entry must ignore unwanted autofilled credentials.
        await page.getByLabel("Email or username", { exact: true }).fill("unwanted-autofill");
        await page.getByLabel("Password", { exact: true }).fill("unwanted-autofill");
        await page.getByRole("button", { name: "Show password", exact: true }).click();
        assert.equal(await page.getByLabel("Password", { exact: true }).getAttribute("autocapitalize"), "none");
        assert.equal(await page.getByLabel("Password", { exact: true }).getAttribute("autocorrect"), "off");
      } else {
        await page.getByLabel("Email or username", { exact: true }).fill("teststudent");
        await page.getByRole("button", { name: "Log in", exact: true }).click();
        await page.getByRole("alert").filter({ hasText: "Enter both" }).waitFor();
        await page.getByLabel("Email or username", { exact: true }).fill("");
        assert.equal(await page.getByRole("alert").filter({ hasText: "Enter both" }).count(), 0);
      }
      await page.screenshot({ path: prefix + "-login.png", fullPage: true });
      await page.getByRole("button", { name: mobile ? "Try the demo" : "Log in", exact: true }).click();
      await page.getByRole("heading", { name: "16-day forecast", exact: true }).waitFor({ timeout: 70000 });
      assert.equal(new URL(page.url()).searchParams.get("view"), "conditions");
      assert.equal(await page.locator(".calendar-day").count(), 16);
      assert.equal(await page.getByRole("button", { name: "Spot settings", exact: true }).count(), 0);
      assert.equal(await page.getByRole("button", { name: "+ Add spot", exact: true }).count(), 0);
      const identity = (await (await context.request.get(base + "/api/auth/session")).json()).data;
      assert.equal(identity.role, "student");assert.equal(identity.demo, true);
      assert.equal(await page.getByRole("slider").count(), 2);
      await page.getByRole("slider").first().focus();await page.keyboard.press("ArrowRight");
      const cursor = await page.getByRole("slider").first().getAttribute("aria-valuenow");assert(cursor);
      if (mobile) await page.getByRole("button", { name: "Open menu", exact: true }).click();
      assert.deepEqual(await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button").allTextContents(), ["Conditions"]);
      if (mobile) await page.keyboard.press("Escape");
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: prefix + "-conditions.png", fullPage: false });
      if (mobile) await page.getByRole("button", { name: "Open menu", exact: true }).click();
      await page.getByRole("button", { name: "Log out", exact: true }).click();
      await page.getByRole("button", { name: "Try the demo", exact: true }).waitFor();
      assert.equal((await context.request.get(base + "/api/spots")).status(), 401);
      assert.deepEqual(errors, []);
      checks.push(mobile ? "Mobile demo button ignores autofill; forecast, menu and logout work" : "Desktop empty submit, partial validation, forecast and logout work");
    } catch (error) {
      await page.screenshot({ path: prefix + "-failure.png", fullPage: true });
      console.error(JSON.stringify({ mobile, path: new URL(page.url()).pathname, visibleText: (await page.locator("body").innerText()).slice(0,1800), responses, errors }));
      throw error;
    } finally {
      await context.request.delete(base + "/api/auth/session", { headers: { Origin: base, "X-MyWavePlan-Request": "1" } });
      await context.close();
    }
  }
  console.log(JSON.stringify({ base, checks, passed: checks.length, browserErrors: 0, contextsClosed: true }));
} finally {
  await browser.close();
}
