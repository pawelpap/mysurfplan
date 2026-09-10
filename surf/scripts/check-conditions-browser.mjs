import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
export async function checkConditionsBrowser({ base, cookie }) {
  const modulePath =
    process.env.MWP_PLAYWRIGHT_MODULE ||
    "/Users/pawel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
  const { chromium } = await import(pathToFileURL(modulePath));

  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    colorScheme: "light",
    geolocation: { latitude: 38.6908, longitude: -9.369 },
    permissions: ["geolocation"],
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(25000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let checks = 0;
  try {
    const eq = cookie.indexOf("=");
    await ctx.addCookies([
      {
        name: cookie.slice(0, eq),
        value: cookie.slice(eq + 1),
        url: base,
        httpOnly: true,
        secure: base.startsWith("https"),
        sameSite: "Lax",
      },
    ]);
    const spots = (await (await ctx.request.get(base + "/api/spots")).json())
      .data;
    const bico = spots.find((s) => s.name.includes("Bico"));
    await ctx.setGeolocation({
      latitude: bico.latitude,
      longitude: bico.longitude,
    });
    const summaryRequests = [];
    page.on("request", (r) => {
      if (new URL(r.url()).pathname === "/api/conditions/summaries") summaryRequests.push(r.url());
    });
    await page.goto(base + "/?view=conditions");
    await page
      .getByRole("heading", { name: "16-day forecast", exact: true })
      .waitFor();
    await page.waitForFunction(() =>
      document
        .querySelector(".spot-card.selected")
        ?.textContent.includes("Bico"),
    );
    assert.equal(await page.locator(".calendar-day").count(), 16);
    assert.equal(
      await page
        .getByRole("button", { name: "Spot settings", exact: true })
        .count(),
      0,
    );
    checks++;
    console.log("Passed browser group", checks);
    await page.waitForFunction(() => document.querySelector(".spot-card.selected .spot-card-time")?.textContent.trim());
    const initialSpotTime = await page.locator(".spot-card.selected .spot-card-time").innerText();
    for (const tile of [page.locator(".spot-card.selected"), page.locator(".calendar-day").first()]) {
      assert.match(await tile.locator(".tile-wind-speed").innerText(), /\d+ km\/h/);
      assert.match(await tile.locator(".tile-swell-energy").innerText(), /\d.*kJ\/m²/);
      for (const direction of await tile.locator(".tile-direction").allInnerTexts()) assert.match(direction, /\d+°/);
    }
    assert.match(initialSpotTime, /(?:Now|Today|Tomorrow).*\d\d:\d\d/);
    const headingContext = await page.locator(".spot-comparison-time").innerText();
    assert.ok(!headingContext.includes("or next sunrise"));
    if (initialSpotTime.includes("Sunrise"))
      assert.ok(headingContext.includes(initialSpotTime.split(" · ")[0] + " at sunrise"));
    assert.ok(summaryRequests.some((url) => new URL(url).searchParams.get("spots").split(",").length > 1));
    await page.screenshot({
      path: "/private/tmp/f18-desktop.png",
      fullPage: true,
    });
    assert.equal(await page.locator('input[type="time"]').count(), 0);
    const timeSlider = page.getByRole("slider", { name: /Forecast time/ });
    await timeSlider.press("Home");
    for (let hour = 0; hour < 9; hour++) await timeSlider.press("PageUp");
    await page.waitForFunction(() =>
      document
        .querySelector(".selected-conditions-time")
        ?.textContent.includes("09:00"),
    );
    await page
      .getByRole("slider", { name: /Forecast time/ })
      .press("ArrowRight");
    await page.waitForFunction(() =>
      document
        .querySelector(".selected-conditions-time")
        ?.textContent.includes("09:15"),
    );
    assert.ok(
      (await page.locator(".spot-comparison-time").innerText()).includes("Local times"),
    );
    for (const text of await page
      .locator(".calendar-day")
      .evaluateAll((es) => es.map((e) => e.getAttribute("aria-label"))))
      assert.ok(text.includes("12:00"));
    assert.ok(
      (
        await page.locator(".interactive-tide").getAttribute("aria-valuetext")
      ).startsWith("09:15"),
    );
    checks++;
    console.log("Passed browser group", checks);
    const chart = page.locator(".interactive-forecast");
    await chart.scrollIntoViewIfNeeded();
    let rect = await chart.boundingBox();
    await page.mouse.move(rect.x + rect.width * 0.4, rect.y + 100);
    await page.mouse.down();
    await page.mouse.move(rect.x + rect.width * 0.65, rect.y + 100, {
      steps: 12,
    });
    await page.mouse.up();
    await page.waitForTimeout(800);
    let times = await page
      .locator("[role=slider]")
      .evaluateAll((es) =>
        es.map((e) => e.getAttribute("aria-valuetext").slice(0, 5)),
      );
    assert.equal(times[0], times[1]);
    assert.notEqual(times[0], "09:15");
    checks++;
    console.log("Passed browser group", checks);
    await page.getByRole("button", { name: "All spots", exact: true }).click();
    await page
      .getByRole("heading", { name: "All spots", exact: true })
      .waitFor();
    assert.equal(
      await page.locator(".spot-catalogue-grid .spot-card").count(),
      17,
    );
    await page.getByLabel("Search spots", { exact: true }).fill("sao pedro");
    assert.equal(
      await page.locator(".spot-catalogue-grid .spot-card").count(),
      2,
    );
    await page.getByLabel("Search spots", { exact: true }).fill("");
    assert.equal(await page.getByLabel("Time", { exact: true }).count(), 0);
    assert.ok(
      (await page.locator(".spot-comparison-time").innerText()).includes("Local times"),
    );
    await page.waitForFunction(() => [...document.querySelectorAll(".spot-catalogue-grid .spot-card-time")].every((el) => el.textContent.trim()));
    const beforeScrollBack = summaryRequests.length;
    await page
      .getByRole("button", { name: "Back to forecast", exact: true })
      .click();
    await page.waitForTimeout(800);
    assert.equal(summaryRequests.length, beforeScrollBack, "returning to loaded cards reuses the cache");
    assert.equal(await page.locator(".spot-card.selected .spot-card-time").innerText(), initialSpotTime);
    await page.locator(".calendar-day").nth(1).click();
    await page.waitForFunction(() =>
      document
        .querySelector(".selected-conditions-time")
        ?.textContent.includes("12:00"),
    );
    assert.ok(
      (await page.locator(".spot-comparison-time").innerText()).includes("Local times"),
    );
    checks++;
    console.log("Passed browser group", checks);
    await page
      .getByRole("button", { name: "Show all hours", exact: true })
      .click();
    assert.ok((await page.locator(".forecast-hour").count()) >= 13);
    await page
      .getByRole("button", { name: "Details", exact: true })
      .first()
      .click();
    assert.ok(
      await page
        .getByRole("region", { name: "Hourly conditions", exact: true })
        .getByText("Wind waves", { exact: true })
        .isVisible(),
    );
    checks++;
    console.log("Passed browser group", checks);
    await page
      .getByRole("button", { name: "Find lessons", exact: true })
      .first()
      .click();
    await page
      .getByRole("heading", { name: "School lessons", exact: true })
      .waitFor();
    assert.ok(await page.locator(".conditions-lesson-filter").isVisible());
    await page
      .getByRole("button", { name: "Back to conditions", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "16-day forecast", exact: true })
      .waitFor();
    checks++;
    console.log("Passed browser group", checks);
    await page.setViewportSize({ width: 430, height: 932 });
    await page.waitForTimeout(200);
    const carousel = await page.locator(".spot-carousel").boundingBox();
    const cardWidth = (await page.locator(".spot-card").first().boundingBox()).width;
    assert.ok(cardWidth * 2 + 12 <= carousel.width + 1, "two mobile cards fit at iPhone Pro Max width");
    await page.waitForFunction(() => document.querySelector(".spot-card.selected .spot-card-time")?.textContent.trim());
    await page.locator(".spot-browser").scrollIntoViewIfNeeded();
    for (const tile of [page.locator(".spot-card.selected"), page.locator(".calendar-day").first()]) {
      assert.ok(await tile.locator(".tile-wind-speed").isVisible());
      assert.ok(await tile.locator(".tile-swell-energy").isVisible());
      assert.ok(await tile.evaluate((el) => el.scrollWidth <= el.clientWidth + 1), "tile content fits without horizontal overflow");
    }
    await page.screenshot({ path: "/private/tmp/f18-spot-cards-mobile.png" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Open menu", exact: true }).click();
    await page.getByLabel("Dark theme", { exact: true }).check();
    await page.keyboard.press("Escape");
    await page.waitForFunction(
      () => document.documentElement.dataset.theme === "dark",
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    assert.equal(
      await page.locator(".calendar-day .calendar-surf").first().isVisible(),
      true,
    );
    assert.equal(
      await page.locator(".calendar-day .tile-directions").first().isVisible(),
      true,
    );
    await page.screenshot({
      path: "/private/tmp/f18-mobile.png",
      fullPage: true,
    });
    checks++;
    console.log("Passed browser group", checks);
    await page.locator(".interactive-tide").scrollIntoViewIfNeeded();
    rect = await page.locator(".interactive-tide").boundingBox();
    const beforeTouch = await page
      .locator(".interactive-tide")
      .getAttribute("aria-valuetext");
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: rect.x + rect.width * 0.4, y: rect.y + 140 }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: rect.x + rect.width * 0.7, y: rect.y + 140 }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await page.waitForTimeout(500);
    times = await page
      .locator("[role=slider]")
      .evaluateAll((es) =>
        es.map((e) => e.getAttribute("aria-valuetext").slice(0, 5)),
      );
    assert.equal(times[0], times[1]);
    assert.notEqual(
      await page.locator(".interactive-tide").getAttribute("aria-valuetext"),
      beforeTouch,
    );
    const afterHorizontal = await page
      .locator(".interactive-tide")
      .getAttribute("aria-valuetext");
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: rect.x + rect.width * 0.5, y: rect.y + 140 }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: rect.x + rect.width * 0.5, y: rect.y + 190 }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    assert.equal(
      await page.locator(".interactive-tide").getAttribute("aria-valuetext"),
      afterHorizontal,
    );
    checks++;
    console.log("Passed browser group", checks);
    await page.setViewportSize({ width: 320, height: 740 });
    await page.waitForTimeout(300);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );

    await page.goto(base + "/login");
    await page
      .getByText("Made for surfers by surfers", { exact: true })
      .waitFor({ state: "attached" });
    assert.equal(
      await page
        .getByRole("group", { name: "Appearance", exact: true })
        .count(),
      0,
    );
    await page.waitForFunction(
      () => document.documentElement.dataset.theme === "light",
    );
    assert.equal(
      await page.evaluate(() => localStorage.getItem("mywaveplan:appearance")),
      "dark",
    );
    await page.emulateMedia({ colorScheme: "dark" });
    await page.waitForFunction(
      () => document.documentElement.dataset.theme === "dark",
    );
    await page.emulateMedia({ colorScheme: "light" });
    await page.waitForFunction(
      () => document.documentElement.dataset.theme === "light",
    );
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page
      .getByText("Made for surfers by surfers", { exact: true })
      .waitFor();
    await page.screenshot({
      path: "/private/tmp/f18-login.png",
      fullPage: true,
    });
    await page.goto(base + "/?view=conditions&spot=" + bico.slug);
    await page.waitForFunction(
      () => document.documentElement.dataset.theme === "dark",
    );
    checks++;
    console.log("Passed browser group", checks);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ base, checks, errors }));
  } finally {
    await browser.close();
  }
}
