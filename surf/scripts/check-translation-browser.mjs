import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const base = process.argv[2];
assert(["https://staging.mywaveplan.com", "https://mywaveplan.com", "http://localhost:3011"].includes(base));
const upstream = base.startsWith("http://localhost") ? "https://staging.mywaveplan.com" : base;
const expectCrash = process.argv.includes("--expect-crash");
const { chromium } = await import(pathToFileURL(process.env.MWP_PLAYWRIGHT_MODULE || "/Users/pawel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs"));
const browser = await chromium.launch({ channel: "chrome", headless: true });
const checks = [];

// Reproduce the documented browser-translation DOM mutation, not translation
// quality or every behaviour of Google's service. No prototype patches.
async function translate(page, language) {
  return page.evaluate((language) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.textContent.trim() || node.parentElement.closest("script,style,textarea,input,select,svg,font,[translate=no]")) continue;
      nodes.push(node);
    }
    for (const node of nodes) {
      const outer = document.createElement("font"), inner = document.createElement("font");
      inner.textContent = node.textContent.replaceAll("Loading…", language === "fr" ? "Chargement…" : "A carregar…");
      outer.append(inner);
      node.parentNode.replaceChild(outer, node);
    }
    return nodes.length;
  }, language);
}

try {
  for (const language of expectCrash ? ["fr"] : ["fr", "pt"]) {
    const mobile = language === "fr";
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, isMobile: mobile, hasTouch: mobile, colorScheme: mobile ? "dark" : "light", locale: language });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    let release, brokenSpots = false;
    const gate = new Promise((resolve) => { release = resolve; });
    const headers = { Origin: upstream, "X-MyWavePlan-Request": "1" };
    try {
      // Delay location as well as the card request to exercise updates that
      // arrive after the initial forecast is already visible.
      await page.addInitScript(() => {
        Object.defineProperty(navigator, "geolocation", { configurable: true, value: {
          getCurrentPosition(success) { window.finishTestLocation = () => success({ coords: { latitude: 38.679, longitude: -9.336 } }); },
        } });
      });
      await page.route("**/api/**", async (route) => {
        const req = route.request(), url = new URL(req.url());
        if (url.pathname === "/api/conditions/summaries") await gate;
        if (brokenSpots && url.pathname === "/api/spots") {
          return route.fulfill({ json: { ok: true, data: [null] } });
        }
        // Only the local production-build test proxies to staging. On live
        // environments all routes use their own APIs and isolated cookies.
        if (base === upstream) return route.continue();
        const response = await context.request.fetch(upstream + url.pathname + url.search, {
          method: req.method(), headers: { ...headers, "Content-Type": "application/json" },
          data: req.postData() || undefined,
        });
        await route.fulfill({ response });
      });
      await page.goto(base + "/login");
      await page.getByRole("button", { name: "Try the demo", exact: true }).waitFor();
      assert(await translate(page, language) > 0);
      await page.getByRole("button", { name: "Try the demo", exact: true }).click();
      await page.getByRole("heading", { name: "16-day forecast", exact: true }).waitFor({ timeout: 70000 });
      assert.equal(await page.locator(".calendar-day").count(), 16);
      assert(await translate(page, language) > 0);
      release();
      if (expectCrash) {
        await page.getByText("Application error:", { exact: false }).waitFor({ timeout: 70000 });
        assert(errors.some((e) => /removeChild|insertBefore|NotFoundError/.test(e)), errors.join("\n"));
        checks.push({ language, reproduced: true, errors });
        continue;
      }
      await page.locator(".spot-card .tile-directions").first().waitFor({ timeout: 70000 });
      assert.equal(await page.getByRole("heading", { name: "16-day forecast", exact: true }).count(), 1);
      await translate(page, language);
      await page.evaluate(() => window.finishTestLocation());
      await page.waitForURL((url) => Boolean(url.searchParams.get("spot")));
      await page.getByRole("heading", { name: "16-day forecast", exact: true }).waitFor({ timeout: 70000 });
      await translate(page, language);
      const beforeTime = await page.locator(".selected-conditions-time").innerText();
      await page.getByRole("slider").first().focus();
      await page.keyboard.press("ArrowRight");
      await page.waitForFunction((before) => document.querySelector(".selected-conditions-time")?.textContent !== before, beforeTime);
      const beforeDay = await page.locator(".selected-day-heading h2").innerText();
      await page.locator(".calendar-day").nth(3).click();
      await page.waitForFunction((before) => document.querySelector(".selected-day-heading h2")?.textContent !== before, beforeDay);
      await translate(page, language);
      await page.getByRole("button", { name: "Show all hours", exact: true }).click();
      await page.getByRole("button", { name: "Include night hours", exact: true }).click();
      assert.equal(await page.getByRole("slider").count(), 2);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: `/private/tmp/mwp-translation-${new URL(base).hostname}-${language}.png`, fullPage: false });
      await page.getByRole("button", { name: "All spots", exact: true }).click();
      await page.getByRole("heading", { name: "All spots", exact: true }).waitFor();
      await translate(page, language);
      if (mobile) await page.getByRole("button", { name: "Filters", exact: true }).click();
      await page.getByLabel("Region", { exact: true }).selectOption({ label: "Sintra" });
      await page.getByRole("button", { name: "Clear filters", exact: true }).click();
      await page.getByRole("button", { name: "Back to forecast", exact: true }).click();
      await page.getByRole("heading", { name: "16-day forecast", exact: true }).waitFor({ timeout: 70000 });
      assert.deepEqual(errors, []);

      // This deliberate malformed response is confined to this browser. It
      // verifies the recovery UI, never changing an API, account or database.
      brokenSpots = true;
      await page.reload();
      await page.getByRole("heading", { name: "This page couldn’t finish loading", exact: true }).waitFor();
      brokenSpots = false;
      await page.getByRole("button", { name: "Reload page", exact: true }).click();
      await page.getByRole("heading", { name: "16-day forecast", exact: true }).waitFor({ timeout: 70000 });
      const identity = (await (await context.request.get(upstream + "/api/auth/session")).json()).data;
      assert.equal(identity.role, "student");assert.equal(identity.demo, true);
      checks.push({ language, mobile, translationUpdates: "passed", recovery: "passed", studentSessionPreserved: true });
    } catch (error) {
      console.error(JSON.stringify({ language, errors, visibleText: (await page.locator("body").innerText()).slice(0,800) }));
      throw error;
    } finally {
      release();
      await page.unrouteAll({ behavior: "ignoreErrors" });
      await context.request.delete(upstream + "/api/auth/session", { headers });
      await context.close();
    }
  }
  console.log(JSON.stringify({ base, checks, contextsClosed: true }));
} finally {
  await browser.close();
}
