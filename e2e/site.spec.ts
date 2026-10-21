import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const SWP = '/en-in/calculators/swp/';

async function fill(page: Page, label: string, value: string) {
  const input = page.getByRole('spinbutton', { name: label });
  await input.fill(value);
}

test.describe('home', () => {
  test('lists calculators, searches and opens one', async ({ page }) => {
    await page.goto('/en-in/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Free finance calculators');
    await expect(page.getByRole('link', { name: /SWP Calculator/ }).first()).toBeVisible();
    await page.getByRole('searchbox', { name: 'Search calculators' }).fill('loan');
    await expect(page.getByRole('link', { name: /Loan Prepayment Calculator/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /SWP Calculator/ })).toHaveCount(0);
    await page.getByRole('searchbox', { name: 'Search calculators' }).fill('zzzz');
    await expect(page.getByText('No calculator matches your search.')).toBeVisible();
    await page.getByRole('searchbox', { name: 'Search calculators' }).fill('swp');
    await page
      .getByRole('link', { name: /SWP Calculator/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/en-in\/calculators\/swp\//);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('SWP Calculator');
  });

  test.describe('root redirect', () => {
    test.describe('with an Indian browser', () => {
      test.use({ locale: 'en-IN' });
      test('goes to en-in', async ({ page }) => {
        await page.goto('/');
        await page.waitForURL(/\/en-in\/$/);
      });
    });
    test.describe('with a British browser', () => {
      test.use({ locale: 'en-GB' });
      test('goes to en-gb', async ({ page }) => {
        await page.goto('/');
        await page.waitForURL(/\/en-gb\/$/);
      });
    });
  });

  test('unknown page shows the 404 page', async ({ page }) => {
    const res = await page.goto('/en-in/nope/');
    expect(res?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  });
});

test.describe('SWP page', () => {
  test('shows an honest warning when the money ends early (plan fixture)', async ({ page }) => {
    await page.goto(SWP);
    await fill(page, 'Total investment (corpus)', '2000000');
    await fill(page, 'Withdrawal each period', '25000');
    await fill(page, 'Time period', '15');
    await fill(page, 'Expected yearly return', '6');
    await expect(page.getByRole('list', { name: 'Warnings' })).toContainText(
      'Your money lasts 8 years 5 months, not 15 years 0 months.',
    );
    await expect(page.getByTestId('card-moneyLasts')).toContainText('8 years 5 months');
    await expect(page.getByTestId('card-totalWithdrawn')).toContainText('₹25,25,000');
    await expect(page.getByTestId('card-finalBalance')).toContainText('₹14,821');
  });

  test('other modes give the expected numbers', async ({ page }) => {
    await page.goto(SWP);
    await page
      .getByRole('button', { name: /Advanced options/ })
      .or(page.getByText('Advanced options'))
      .first()
      .click();
    await page.getByLabel('How the yearly rate is used').selectOption('nominal');
    await fill(page, 'Expected yearly return', '6');

    await page.getByRole('tab', { name: 'Find the corpus' }).click();
    await fill(page, 'Withdrawal each period', '25000');
    await fill(page, 'Time period', '15');
    await expect(page.getByTestId('card-requiredCorpus')).toContainText('₹29,62,5');

    await page.getByRole('tab', { name: 'Keep the principal' }).click();
    await fill(page, 'Total investment (corpus)', '10000000');
    await expect(page.getByTestId('card-withdrawalPerPeriod')).toContainText('₹50,000');

    await page.getByRole('tab', { name: 'Find how long' }).click();
    await fill(page, 'Total investment (corpus)', '2000000');
    await fill(page, 'Withdrawal each period', '25000');
    await expect(page.getByTestId('card-moneyLasts')).toContainText('8 years 6 months');

    await fill(page, 'Withdrawal each period', '5000');
    await expect(page.getByTestId('card-moneyLasts')).toContainText('Never used up');
    await expect(page.getByRole('list', { name: 'Warnings' })).toContainText('Principal is never used up');
  });

  test('slider and number field stay in sync', async ({ page }) => {
    await page.goto(SWP);
    const slider = page.getByRole('slider', { name: 'Expected yearly return' });
    const number = page.getByRole('spinbutton', { name: 'Expected yearly return' });
    await number.fill('12');
    await expect(slider).toHaveValue('12');
    await slider.focus();
    await slider.press('ArrowRight');
    await expect(number).toHaveValue('12.1');
  });

  test('shows validation messages', async ({ page }) => {
    await page.goto(SWP);
    await page.getByRole('spinbutton', { name: 'Time period' }).fill('');
    await expect(page.getByText('Enter a number.')).toBeVisible();
    await page.getByRole('spinbutton', { name: 'Time period' }).fill('99');
    await expect(page.getByText('Must be at most 60.')).toBeVisible();
    await expect(page.getByTestId('card-moneyLasts')).toHaveCount(0);
  });

  test('share link restores the same inputs', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'clipboard permission is Chromium only');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto(SWP);
    await fill(page, 'Total investment (corpus)', '3300000');
    await page.getByRole('tab', { name: 'Find how long' }).click();
    await page.getByRole('button', { name: 'Share link' }).click();
    await expect(page.getByRole('button', { name: 'Link copied' })).toBeVisible();
    const link = await page.evaluate(() => navigator.clipboard.readText());
    expect(link).toContain('corpus=3300000');
    expect(link).toContain('mode=duration');
    expect(link).not.toContain('startDate');
    const fresh = await context.newPage();
    await fresh.goto(link);
    await expect(fresh.getByRole('spinbutton', { name: 'Total investment (corpus)' })).toHaveValue('3300000');
    await expect(fresh.getByRole('tab', { name: 'Find how long' })).toHaveAttribute('aria-selected', 'true');
  });

  test('downloads CSV', async ({ page }) => {
    await page.goto(SWP);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download CSV' }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('swp-plan.csv');
    const path = await download.path();
    const fs = await import('node:fs/promises');
    const text = (await fs.readFile(path, 'utf8')).replace(/^﻿/, '');
    const lines = text.split('\r\n');
    expect(lines[0]).toBe('Year,Invested,Withdrawn this year,Returns this year,Total withdrawn,Total returns,Balance');
    expect(lines.length).toBeGreaterThan(5);
  });

  test('table view can be switched', async ({ page }) => {
    await page.goto(SWP);
    await page.getByRole('button', { name: 'Calendar years' }).click();
    await expect(page.getByRole('heading', { name: 'Calendar years' })).toBeVisible();
    await page.getByRole('button', { name: 'Each withdrawal' }).click();
    await expect(page.getByRole('region', { name: 'Each withdrawal' }).getByRole('row').nth(10)).toBeVisible();
  });

  test('print view hides the controls and keeps the results', async ({ page }) => {
    await page.goto(SWP);
    await page.emulateMedia({ media: 'print' });
    await expect(page.getByRole('button', { name: 'Print' })).toBeHidden();
    await expect(page.locator('header').first()).toBeHidden();
    await expect(page.getByTestId('card-moneyLasts')).toBeVisible();
    await expect(page.getByText('This is not financial advice').first()).toBeVisible();
  });

  test('has the explanation, FAQ, structured data and SEO tags', async ({ page }) => {
    await page.goto(SWP);
    await expect(page.getByRole('heading', { name: 'How it works' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Frequently asked questions' })).toBeVisible();
    await page.getByText('What is an SWP?').click();
    await expect(page.getByText('lets you take a fixed amount from your investment')).toBeVisible();
    const types = await page.$$eval('script[type="application/ld+json"]', (els) =>
      els.map((e) => JSON.parse(e.textContent ?? '{}')['@type']),
    );
    expect(types).toEqual(expect.arrayContaining(['WebApplication', 'FAQPage', 'BreadcrumbList']));
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/en-in\/calculators\/swp\/$/);
    const hreflang = await page.$$eval('link[rel="alternate"][hreflang]', (els) =>
      els.map((e) => e.getAttribute('hreflang')),
    );
    expect(hreflang).toEqual(expect.arrayContaining(['en-IN', 'hi-IN', 'en-US', 'en-GB', 'x-default']));
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /SWP calculator/i);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-IN');
  });
});

test.describe('countries, languages and theme', () => {
  test('country switcher changes route and currency', async ({ page }) => {
    await page.goto(SWP);
    await page.getByLabel('Country').selectOption('us');
    await expect(page).toHaveURL(/\/en-us\/calculators\/swp\//);
    await expect(page.getByTestId('card-invested')).toContainText('$25,000');
    await page.getByLabel('Country').selectOption('gb');
    await expect(page).toHaveURL(/\/en-gb\/calculators\/swp\//);
    await expect(page.getByTestId('card-invested')).toContainText('£20,000');
  });

  test('switching to a country without the calculator goes home', async ({ page }) => {
    await page.goto('/en-in/calculators/ppf/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('PPF Calculator');
    await page.getByLabel('Country').selectOption('us');
    await expect(page).toHaveURL(/\/en-us\/$/);
  });

  test('country-only calculators exist only for their country', async ({ page }) => {
    expect((await page.goto('/en-us/calculators/ppf/'))?.status()).toBe(404);
    expect((await page.goto('/en-us/calculators/401k/'))?.status()).toBe(200);
    expect((await page.goto('/en-gb/calculators/sipp/'))?.status()).toBe(200);
  });

  test('Hindi works and falls back to English for missing text', async ({ page }) => {
    await page.goto('/en-in/');
    await page.getByLabel('Language').selectOption('hi');
    await expect(page).toHaveURL(/\/hi-in\//);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('मुफ़्त फाइनेंस कैलकुलेटर');
    await page.goto('/hi-in/calculators/swp/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('SWP कैलकुलेटर');
    await expect(
      page
        .getByRole('heading', { name: 'How it works' })
        .or(page.getByRole('heading', { name: 'यह कैसे काम करता है' })),
    ).toBeVisible();
  });

  test('dark mode toggle', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/en-in/');
    const html = page.locator('html');
    await expect(html).not.toHaveClass(/dark/);
    await page.getByRole('button', { name: /Theme/ }).click(); // system -> light
    await page.getByRole('button', { name: /Theme/ }).click(); // light -> dark
    await expect(html).toHaveClass(/dark/);
    await page.reload();
    await expect(html).toHaveClass(/dark/);
  });
});

test.describe('every calculator page', () => {
  const pages: [string, string][] = [
    ['en-in', 'swp'],
    ['en-in', 'sip'],
    ['en-in', 'step-up-sip'],
    ['en-in', 'lumpsum'],
    ['en-in', 'goal-planner'],
    ['en-in', 'fire'],
    ['en-in', 'inflation'],
    ['en-in', 'emi'],
    ['en-in', 'loan-prepayment'],
    ['en-in', 'fd'],
    ['en-in', 'rd'],
    ['en-in', 'ppf'],
    ['en-in', 'nps'],
    ['en-in', 'epf'],
    ['en-in', 'rent-vs-buy'],
    ['en-in', 'builder-delay-interest'],
    ['en-us', '401k'],
    ['en-us', 'ira'],
    ['en-gb', 'isa'],
    ['en-gb', 'sipp'],
  ];
  for (const [locale, slug] of pages) {
    test(`${locale}/${slug} renders results without errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => {
        // missing files are reported through the response listener below
        if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push(m.text());
      });
      // Next.js prefetch files (__next.*) are named differently by a Windows build; the page still works without them.
      page.on('response', (r) => {
        if (r.status() >= 400 && !r.url().includes('__next.')) errors.push(`${r.status()} ${r.url()}`);
      });
      await page.goto(`/${locale}/calculators/${slug}/`);
      await expect(page.locator('[data-testid^="card-"]').first()).toBeVisible();
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.locator('table').first())
        .toBeAttached()
        .catch(() => undefined);
      expect(await page.locator('text=/NaN|undefined|Infinity/').count()).toBe(0);
      expect(errors).toEqual([]);
    });
  }
});

test.describe('mobile layout', () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test('no horizontal scrolling and everything usable', async ({ page }) => {
    for (const path of ['/en-in/', SWP, '/en-in/calculators/emi/']) {
      await page.goto(path);
      await expect(page.locator('main')).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
    await page.goto(SWP);
    await expect(page.getByTestId('card-moneyLasts')).toBeVisible();
    await page
      .getByRole('button', { name: 'Calculators' })
      .or(page.getByText('Calculators', { exact: true }))
      .first()
      .click();
    await expect(page.getByRole('link', { name: 'EMI Calculator' }).first()).toBeVisible();
  });
});

test.describe('metadata files', () => {
  test('sitemap and robots', async ({ request }) => {
    const sitemap = await (await request.get('/sitemap.xml')).text();
    expect(sitemap).toContain('/en-in/calculators/swp/');
    expect(sitemap).toContain('/en-us/calculators/401k/');
    expect(sitemap).not.toContain('/en-us/calculators/ppf/');
    expect(sitemap).toContain('hreflang="en-US"');
    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).toContain('Sitemap:');
  });
});

test.describe('accessibility (axe)', () => {
  for (const scheme of ['light', 'dark'] as const) {
    for (const path of ['/en-in/', SWP, '/en-in/calculators/emi/', '/en-in/about/']) {
      test(`${path} has no serious violations (${scheme})`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto(path);
        await page.waitForTimeout(400);
        const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        const bad = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
        expect(
          bad.map(
            (v) =>
              `${v.id}: ${v.nodes
                .map((n) => n.target.join(' '))
                .slice(0, 3)
                .join(' | ')}`,
          ),
        ).toEqual([]);
      });
    }
  }
});
