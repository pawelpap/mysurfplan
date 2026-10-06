import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const [base, phase = 'after', output = '/private/tmp/mwp-legal-browser.json'] = process.argv.slice(2);
assert(['https://staging.mywaveplan.com', 'http://localhost:3000'].includes(base));
const { chromium } = await import(pathToFileURL(process.env.MWP_PLAYWRIGHT_MODULE || '/Users/pawel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, isMobile: mobile, hasTouch: mobile, colorScheme: mobile ? 'dark' : 'light' });
    const page = await context.newPage();
    const hosts = new Set(), errors = [];
    page.on('request', request => { hosts.add(new URL(request.url()).hostname); });
    page.on('pageerror', error => errors.push(error.message));
    const storage = async () => ({
      cookies: (await context.cookies()).map(c => ({ name: c.name, domain: c.domain, httpOnly: c.httpOnly, secure: c.secure, sameSite: c.sameSite, remainingSeconds: Math.round(c.expires - Date.now()/1000) })),
      browser: await page.evaluate(async () => ({ localStorageKeys: Object.keys(localStorage), sessionStorageKeys: Object.keys(sessionStorage), serviceWorkers: (await navigator.serviceWorker?.getRegistrations() || []).length, cacheNames: await caches.keys(), indexedDatabaseNames: (await indexedDB.databases()).map(d => d.name) })),
    });
    try {
      await page.goto(base + '/legal');
      await page.getByRole('heading', { name: 'Data licences', exact: true }).waitFor();
      if (phase === 'after') {
        for (const [slug,title] of [['privacy','Privacy notice'],['terms','Adult-pilot terms'],['school-processing','School-processing agreement'],['storage','Cookies and browser storage']]) {
          await page.goto(base + '/legal/' + slug);
          await page.getByRole('heading', { name: title, exact: true, level: 1 }).waitFor();
          assert.equal(await page.locator('[data-legal-document]').count(), 1);
          assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
          await page.keyboard.press('Tab');
          assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Skip to document');
          await page.keyboard.press('Enter');
          assert.equal(await page.evaluate(() => document.activeElement.id), 'document');
          await page.screenshot({ path: output.replace(/\.json$/, `-${slug}-${mobile ? 'mobile' : 'desktop'}.png`), fullPage: true });
        }
        assert.equal((await context.request.get(base + '/api/legal/records')).status(),401);
        assert.equal((await context.request.get(base + '/legal/privacy?language=fr')).status(),404);
        assert.equal((await context.request.get(base + '/legal/privacy?version=missing')).status(),404);
      }
      await page.goto(base + '/login');
      await page.getByRole('button', { name: 'Try the demo', exact: true }).waitFor();
      const anonymous = await storage();
      await page.getByRole('button', { name: 'Try the demo', exact: true }).click();
      await page.getByRole('heading', { name: '16-day forecast', exact: true }).waitFor({ timeout: 120000 });
      assert.equal(await page.locator('.calendar-day').count(),16);
      assert.equal(await page.getByRole('button', { name: 'Spot settings', exact: true }).count(),0);
      const authenticated = await storage();
      const spots = await context.request.get(base + '/api/spots');
      assert.equal(spots.status(),200);
      assert.equal((await spots.json()).data.length,18);
      const forecast = await context.request.get(base + '/api/conditions?spot=cornelia-caparica');
      assert.equal(forecast.status(),200);
      assert.equal((await forecast.json()).data.dates.length,16);
      if (phase === 'after') {
        assert.equal((await context.request.post(base + '/api/legal/records', { headers:{Origin:base},data:{action:'optional_preference',purpose:'analytics',selected:false,version:'optional-preferences/1'} })).status(),403);
        await page.goto(base + '/legal/records');
        await page.getByRole('heading',{name:'Your legal records',exact:true}).waitFor();
        assert.equal(await page.getByRole('button',{name:'Keep optional purposes off'}).isEnabled(),false);
      }
      await context.request.delete(base + '/api/auth/session',{headers:{Origin:base,'X-MyWavePlan-Request':'1'}});
      assert.equal((await context.request.get(base + '/api/spots')).status(),401);
      if (phase === 'after') assert(![...hosts].some(h => /google|gstatic|facebook|linkedin|clarity|doubleclick/.test(h)), 'Unexpected external tracking/font request');
      assert.deepEqual(errors,[]);
      results.push({ mobile, hosts:[...hosts].sort(), anonymous, authenticated, forecastDays:16, activeSpots:18, browserErrors:0 });
    } finally {
      await context.request.delete(base + '/api/auth/session',{headers:{Origin:base,'X-MyWavePlan-Request':'1'}}).catch(()=>{});
      await context.close();
    }
  }
  const result = { base,phase,checkedAt:new Date().toISOString(),results,contextsClosed:true };
  await fs.writeFile(output, JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result));
} finally { await browser.close(); }
