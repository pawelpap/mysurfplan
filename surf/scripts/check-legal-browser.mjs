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
    let fontCheck = null, appearancePersisted = false;
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
        for (const [slug,title] of [['privacy','Privacy notice'],['terms','Terms of use'],['school-processing','School data-processing agreement'],['storage','Cookies and browser storage']]) {
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
        fontCheck = await page.evaluate(async()=>{
          for(const weight of [400,500,600,700]) await document.fonts.load(`${weight} 14px Poppins`);
          await document.fonts.ready;
          return { family:getComputedStyle(document.body).fontFamily, weights:[400,500,600,700].map(weight=>({weight,loaded:document.fonts.check(`${weight} 14px Poppins`)})) };
        });
        assert(fontCheck.family.includes('Poppins') && fontCheck.weights.every(w=>w.loaded));
        await page.getByRole('radio',{name:mobile?'Light theme':'Dark theme',exact:true}).check();
        await page.reload();
        appearancePersisted = await page.evaluate(mode=>localStorage.getItem('mywaveplan:appearance')===mode && document.documentElement.dataset.themeMode===mode,mobile?'light':'dark');
        assert(appearancePersisted);
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
        await page.getByRole('heading',{name:'Privacy and agreements',exact:true}).waitFor();
        await page.getByRole('heading',{name:'Your agreements',exact:true}).waitFor();
        assert.equal(await page.getByRole('button',{name:'Keep optional purposes off'}).count(),0);
        assert.equal(await page.locator('.sidebar').count(),1);
        assert.equal(await page.getByRole('button',{name:'Privacy and agreements',exact:true}).count(),0);
        assert.equal(await page.locator('.sidebar-footer .legal-link').count(),1);
        if (mobile) await page.getByRole('button',{name:'Open menu',exact:true}).click();
        const legalControl=page.locator('.sidebar-footer .legal-link');
        assert.equal(await legalControl.innerText(),'Legal');
        assert(await legalControl.evaluate(el=>{const r=el.getBoundingClientRect();return r.height>=44 && r.width<100;}));
        await page.screenshot({path:output.replace(/\.json$/,`-navigation-${mobile?'mobile':'desktop'}.png`)});
        await legalControl.click();
        assert(new URL(page.url()).searchParams.get('view')==='privacy');
        await page.locator('.data-licences summary').click();
        await page.locator('.data-licences').getByRole('link',{name:'Open-Meteo',exact:true}).waitFor();
        assert(await page.locator('.data-licences').getByText('Light times use',{exact:false}).isVisible());
        assert.equal(await page.getByRole('heading',{name:'School data-processing agreement',exact:true}).count(),0);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      }
      await context.request.delete(base + '/api/auth/session',{headers:{Origin:base,'X-MyWavePlan-Request':'1'}});
      assert.equal((await context.request.get(base + '/api/spots')).status(),401);
      if (phase === 'after') assert(![...hosts].some(h => /google|gstatic|facebook|linkedin|clarity|doubleclick/.test(h)), 'Unexpected external tracking/font request');
      assert.deepEqual(errors,[]);
      results.push({ mobile, hosts:[...hosts].sort(), anonymous, authenticated, fontCheck, appearancePersisted, forecastDays:16, activeSpots:18, browserErrors:0 });
    } finally {
      await context.request.delete(base + '/api/auth/session',{headers:{Origin:base,'X-MyWavePlan-Request':'1'}}).catch(()=>{});
      await context.close();
    }
  }
  if (phase === 'after') {
    for (const width of [320,768]) {
      const context=await browser.newContext({viewport:{width,height:844},colorScheme:width===320?'dark':'light'});
      const page=await context.newPage();
      for (const slug of ['privacy','terms','school-processing','storage']) {
        await page.goto(base+'/legal/'+slug);
        const text=await page.locator('[data-legal-document]').innerText();
        assert(!/English|en-GB|Publication condition|Staging|not installed|MFA/.test(text));
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
        await page.waitForFunction(()=>document.querySelector('.legal-menu summary')?.getBoundingClientRect().height>=44);
        assert(await page.locator('.legal-menu summary').evaluate(el=>el.getBoundingClientRect().height>=44));
        await page.locator('.legal-menu summary').click();
        await page.getByRole('navigation',{name:'Legal documents',exact:true}).waitFor();
        await page.locator('.legal-menu summary').click();
        await page.locator('.legal-mobile-contents summary').click();
        await page.locator('.legal-mobile-contents a').last().click();
        assert((await page.url()).includes('#section-'));
        await page.goto(base+'/legal/'+slug);
        await page.screenshot({path:output.replace(/\.json$/,`-${slug}-${width}.png`)});
      }
      await context.close();
      results.push({width,documentMenusAndAnchors:true,noHorizontalOverflow:true,noReleaseNotesOrLanguageLabels:true});
    }
  }
  const result = { base,phase,checkedAt:new Date().toISOString(),results,contextsClosed:true };
  await fs.writeFile(output, JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result));
} finally { await browser.close(); }
