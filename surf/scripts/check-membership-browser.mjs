import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
export async function checkMembershipBrowser({
  base,
  environment,
  student,
  admin,
  coach,
  a,
  b,
  lesson,
  otherLesson,
  spot,
}) {
  const browserModule =
    process.env.MWP_PLAYWRIGHT_MODULE ||
    "/Users/pawel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
  const { chromium } = await import(pathToFileURL(browserModule));
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  let count = 0;
  const contexts = [];
  const context = async (cookie, options = {}) => {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      colorScheme: "light",
      ...options,
    });
    contexts.push(ctx);
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
    return ctx;
  };
  const errors = [];
  const page = async (ctx) => {
    const p = await ctx.newPage();
    p.on("pageerror", (e) => errors.push(e.message));
    p.setDefaultTimeout(40000);
    return p;
  };
  try {
    const adminContext = await context(admin.cookie);
    const adminPage = await page(adminContext);
    await adminPage.goto(base + "/?view=people&school=" + a.slug);
    await adminPage
      .getByRole("heading", { name: "People", exact: true })
      .waitFor();
    assert.equal(
      await adminPage.getByText("Accounts", { exact: true }).count(),
      0,
    );
    assert.equal(
      (await adminPage
        .locator("main")
        .getByRole("button", { name: /Access check Fixture/ })
        .count()) > 0,
      true,
    );
    await adminPage
      .locator("main")
      .getByRole("button", { name: /Access check Fixture/ })
      .first()
      .click();
    await adminPage
      .getByRole("heading", { name: "School access", exact: true })
      .waitFor();
    assert.equal(
      await adminPage.getByLabel("School admin", { exact: true }).count(),
      1,
    );
    assert.equal(
      await adminPage.getByLabel("Instructor", { exact: true }).count(),
      1,
    );
    assert.equal(await adminPage.getByLabel(/password|email/i).count(), 0);
    count++;
    await adminPage.screenshot({
      path: `/private/tmp/mwp-b2-${environment}-school-access.png`,
    });
    const coachContext = await context(coach.cookie);
    const coachPage = await page(coachContext);
    await coachPage.goto(base + "/?view=teaching&school=" + b.slug);
    await coachPage
      .getByRole("heading", { name: "My teaching", exact: true })
      .waitFor();
    await coachPage
      .getByRole("button", { name: "My bookings", exact: true })
      .waitFor();
    await coachPage.getByLabel("Current school").waitFor();
    const schoolOptions = await coachPage
      .getByLabel("Current school")
      .locator("option")
      .allTextContents();
    assert(schoolOptions.includes(a.name) && schoolOptions.includes(b.name));
    assert.equal(
      await coachPage
        .getByRole("button", { name: "People", exact: true })
        .count(),
      0,
    );
    count++;
    await coachPage.getByLabel("Current school").selectOption(a.slug);
    await coachPage
      .getByRole("heading", { name: "My teaching", exact: true })
      .waitFor();
    assert.equal(
      await coachPage
        .getByRole("button", { name: "People", exact: true })
        .count(),
      0,
    ); // school A was suspended, personal access is retained
    await coachPage
      .getByRole("button", { name: "My bookings", exact: true })
      .click();
    await coachPage
      .getByRole("heading", { name: "My bookings", exact: true })
      .waitFor();
    count++;
    const studentContext = await context(student.cookie, {
      permissions: ["geolocation"],
      geolocation: { latitude: 38.6933, longitude: -9.372 },
    });
    const studentPage = await page(studentContext);
    await studentPage.goto(base + "/?view=conditions");
    await studentPage.getByLabel("Surf spot", { exact: true }).waitFor();
    await studentPage.waitForFunction(
      () =>
        document.querySelector("select") &&
        Array.from(document.querySelectorAll("select")).some((s) =>
          s.selectedOptions[0]?.textContent.includes("Bico"),
        ),
    );
    const select = studentPage.getByLabel("Surf spot", { exact: true });
    const options = await select.locator("option").allTextContents();
    assert.equal(options.length, 17);
    assert.match(options[0], /Bico/);
    await studentPage.getByRole("region", { name: "16-day outlook" }).waitFor();
    assert.equal(
      await studentPage
        .getByRole("region", { name: "16-day outlook" })
        .getByRole("button", { name: /, surf / })
        .count(),
      16,
    );
    assert.equal(
      await studentPage
        .getByRole("button", { name: "Spot settings", exact: true })
        .count(),
      0,
    );
    count++;
    const slider = studentPage.getByRole("slider");
    await slider.waitFor();
    const before = await slider.getAttribute("aria-valuenow");
    await slider.focus();
    await slider.press("ArrowRight");
    assert.notEqual(await slider.getAttribute("aria-valuenow"), before);
    count++;
    await studentPage.screenshot({
      path: `/private/tmp/mwp-b2-${environment}-desktop.png`,
    });
    await studentPage.setViewportSize({ width: 390, height: 844 });
    await studentPage.emulateMedia({ colorScheme: "dark" });
    await studentPage
      .getByRole("button", { name: "Open menu", exact: true })
      .click();
    await studentPage
      .getByRole("button", { name: "My bookings", exact: true })
      .click();
    await studentPage
      .getByRole("heading", { name: "My bookings", exact: true })
      .waitFor();
    assert(
      await studentPage
        .getByRole("button", { name: "Open menu", exact: true })
        .isVisible(),
    );
    assert.equal(
      await studentPage.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
      false,
    );
    count++;
    await studentPage.screenshot({
      path: `/private/tmp/mwp-b2-${environment}-mobile.png`,
    });
    assert.deepEqual(errors, []);
    count++;
    console.log({ environment, browserChecks: count, nativeChrome: true });
  } finally {
    for (const ctx of contexts) await ctx.close();
    await browser.close();
  }
}
