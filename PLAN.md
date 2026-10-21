# Finance Calculators Website — Development Plan

> Give this file to Claude Code. Build the project step by step in the phase order below. After each phase: run tests, run the build, and commit.

## 1. Goal

Build a free, fast website with many finance calculators. It must work for all countries (India first, then US and UK). It is static (no backend now), hosted on GitHub Pages, and ready to add a backend or live data later.

First calculator: **SWP (Systematic Withdrawal Plan)**. All later calculators reuse the same design.

## 2. Principles

- All maths runs in the browser. No backend in v1.
- Formulas live in one pure TypeScript package with tests. No UI code and no currency inside it.
- One page per calculator, with its own URL, title, FAQ and formula notes (good for SEO).
- Country and language are settings, not code changes.
- Simple English in the UI. Mobile first. Accessible (keyboard, labels, contrast).
- Every result page shows: "This is not financial advice."

## 3. Tech Stack

| Area | Choice |
|---|---|
| Framework | Next.js (App Router) + React + TypeScript (strict) |
| Export | `output: 'export'` (static HTML) |
| Styling | Tailwind CSS + shadcn/ui |
| Charts | Recharts |
| Forms and validation | React Hook Form + Zod |
| i18n | next-intl |
| Tests | Vitest (unit), Playwright (a few end-to-end tests) |
| Lint and format | ESLint, Prettier |
| Package manager | pnpm |
| Hosting | GitHub Pages via GitHub Actions |
| Analytics | Plausible or GA (behind a flag, off by default) |

## 4. Folder Structure

```
/
├─ PLAN.md
├─ package.json
├─ next.config.mjs
├─ .github/workflows/deploy.yml
├─ packages/
│  └─ calc-core/              # pure formulas + tests (no UI, no currency)
│     ├─ src/
│     │  ├─ rates.ts          # nominal/effective rate conversion
│     │  ├─ swp.ts
│     │  ├─ sip.ts
│     │  ├─ stepupSip.ts
│     │  ├─ lumpsum.ts
│     │  ├─ fire.ts
│     │  ├─ inflation.ts
│     │  ├─ emi.ts
│     │  ├─ prepayment.ts
│     │  ├─ goal.ts
│     │  ├─ fd.ts / ppf.ts / nps.ts
│     │  ├─ rentVsBuy.ts
│     │  ├─ delayInterest.ts
│     │  └─ index.ts
│     └─ tests/
├─ config/
│  ├─ countries/              # in.json, us.json, gb.json (currency, defaults, tax rules)
│  └─ site.ts
├─ messages/                  # en.json, hi.json ... (translations)
├─ src/
│  ├─ app/[locale]/
│  │  ├─ page.tsx             # home: list of calculators
│  │  ├─ calculators/[slug]/page.tsx
│  │  ├─ about/ privacy/ disclaimer/
│  │  └─ sitemap.ts, robots.ts
│  ├─ components/
│  │  ├─ calculator/          # InputSlider, NumberField, ResultCards, YearTable, BalanceChart, ModeTabs
│  │  ├─ layout/              # Header, Footer, CountrySwitcher, LanguageSwitcher, ThemeToggle
│  │  └─ seo/                 # JsonLd, FAQ, FormulaNote
│  ├─ lib/
│  │  ├─ format.ts            # Intl.NumberFormat helpers (lakh/crore or million)
│  │  ├─ urlState.ts          # read/write inputs in URL query
│  │  ├─ storage.ts           # saveScenario()/loadScenario() abstraction
│  │  └─ marketData.ts        # getMarketData() abstraction
│  └─ data/                   # market.json (filled by scheduled GitHub Action)
└─ e2e/
```

Use a pnpm workspace so `calc-core` can be imported as `@app/calc-core` and reused later by a backend.

## 5. Calculation Core (`packages/calc-core`)

All functions are pure, typed, and fully tested. Use plain numbers; round only for display.

### 5.1 Rate conversion (`rates.ts`)

Two methods. Make it an option everywhere: `rateMethod: 'effective' | 'nominal'`.

- **effective (default):** the yearly rate `r` is the real yearly return (like CAGR). Monthly rate `i = (1 + r)^(1/12) − 1`.
- **nominal:** `i = r / 12` (like "compounded monthly").

Also support other frequencies: quarterly (`n=4`), half-yearly (`n=2`), annual (`n=1`) using the same idea.

### 5.2 SWP (`swp.ts`)

Inputs:
```
corpus, withdrawal, frequency ('monthly'|'quarterly'|'halfYearly'|'annual'),
years, annualReturn, rateMethod, timing ('end'|'start'),
withdrawalStepUpPct (default 0), inflationPct (optional), taxOnReturnsPct (optional),
startDate (default: today)
```

Modes:
1. **Use up principal:** simulate period by period. If balance is less than the withdrawal, pay the remaining balance and stop.
2. **Keep principal:** `max sustainable withdrawal per year = corpus × r` (flat). With yearly step-up `g`: first-year withdrawal that keeps the principal real is `corpus × (r − g)` (show a warning when `g ≥ r`).
3. **Solve for corpus:** given withdrawal, years, rate → required corpus (present value).
4. **Solve for duration:** given corpus, withdrawal, rate → how long the money lasts.
5. **Solve for withdrawal:** given corpus, years, rate → maximum withdrawal.

Core formulas (period rate `i`, number of periods `n`, payment `P`, end-of-period timing):
- Required corpus: `PV = P × (1 − (1 + i)^−n) / i`. For start-of-period timing multiply by `(1 + i)`.
- Duration: `n = −ln(1 − PV × i / P) / ln(1 + i)` (valid only when `P > PV × i`; otherwise money lasts forever → show "Principal is never used up").
- Max withdrawal for `n` periods: `P = PV × i / (1 − (1 + i)^−n)`.
- With step-up, use simulation (or growing-annuity formula) and verify both agree in tests.

Simulation output per period: `{ index, date, openingBalance, returns, withdrawal, closingBalance }`.
Yearly summary: group by **calendar year** and by **plan year**; show: invested, withdrawn (cumulative), returns (cumulative), balance.

Result object must include: `moneyLastsMonths`, `lastsFullPeriod: boolean`, `totalWithdrawn`, `totalReturns`, `finalBalance`, `schedule`, `yearly`, `warnings[]`.

**Important behaviour:** if the money ends before the chosen period, set `lastsFullPeriod = false` and add a warning like "Your money lasts 8 years 5 months, not 12 years." (A popular competitor site does not show this and confuses users.)

### 5.3 Other calculators in `calc-core`

- **SIP:** future value of monthly investment; optional yearly step-up; optional inflation-adjusted value.
- **Lump sum:** `FV = P × (1 + r)^t`; also reverse (what to invest today for a target).
- **Goal planner:** required SIP or lump sum for a future goal (education, house) with goal inflation.
- **FIRE:** corpus = annual expenses (inflated to retirement year) ÷ safe withdrawal rate (default 3.5%, editable); years to FIRE from current savings and SIP.
- **Inflation:** future cost and real value of money.
- **EMI:** `EMI = P × i × (1 + i)^n / ((1 + i)^n − 1)`; amortisation schedule; prepayment effect (reduce tenure or reduce EMI).
- **FD / RD, PPF, NPS, EPF:** rules and rates are data in country config; formulas in core.
- **Rent vs buy:** compare net worth after N years with assumptions.
- **Builder delay interest:** simple interest on amount paid for delay days, with editable rate and dates.

Each calculator exports: `inputSchema` (Zod), `calculate(input)`, and `defaults`.

### 5.4 Test fixtures (must pass)

Nominal method (`r/12`), end-of-month, rate 6%:
- ₹25,000 × 180 months → required corpus ≈ **₹29,61,000** (tolerance ±₹1,000).
- ₹50,000 × 60 months → required corpus ≈ **₹25,86,000**.
- Corpus ₹20,00,000, withdrawal ₹25,000 → lasts ≈ **102.4 months**.
- Keep principal: ₹1 crore at 6% → ₹50,000 per month.

Effective method (default), end-of-month, rate 6%, corpus ₹20,00,000, withdrawal ₹25,000/month:
- Balance after year 1 ≈ **₹18,11,837** (tolerance ±₹5).
- Money lasts **101 full withdrawals**; total withdrawn **₹25,25,000**; final balance ≈ **₹18,262** (tolerance ±₹50).

Also add property tests: balance is never negative; total withdrawn + final balance = corpus + total returns; zero rate works (no divide-by-zero); very large and very small inputs do not crash.

## 6. UI / UX

### 6.1 Calculator page layout (desktop: two columns; mobile: stacked)
- **Left: inputs.** Each input has a slider and a typed number field, kept in sync. Show units and sensible min/max. Use Zod for validation with clear error messages.
- **Right: results.** Summary cards (invested, withdrawn, returns, balance, "money lasts"), a balance-over-time chart, and a year-by-year table (sticky header, scrollable).
- **Mode tabs** for SWP: Use up principal / Keep principal / Find corpus / Find duration / Find withdrawal.
- **Advanced section** (collapsed): rate method, timing, step-up %, inflation %, tax %.
- Warning banner when money ends early or inputs are unrealistic (for example, return above 20%).
- Buttons: Share link, Print, Download CSV, Reset.
- Below the tool: short "How it works" with the formula, an FAQ (with JSON-LD), related calculators, and the disclaimer.

### 6.2 Global UI
- Header with logo, calculator menu, country switcher, language switcher, dark mode toggle.
- Home page: search box, calculator categories (Invest, Withdraw, Loans, Retirement, Tax, Property).
- Footer: About, Privacy, Disclaimer, Contact.
- Design: clean, calm, lots of white space, one accent colour, large readable numbers.

### 6.3 Accessibility and performance
- WCAG AA contrast, labels on all inputs, keyboard-friendly sliders, `aria-live` for result changes.
- Lighthouse targets: Performance ≥ 90, Accessibility ≥ 95, SEO ≥ 95.
- Lazy-load the chart library. Debounce recalculation (about 150 ms).

## 7. Multi-country and Multi-language

- `config/countries/*.json` holds: `code`, `currency`, `locale`, `numberSystem` (`indian` or `international`), `defaultReturn`, `defaultInflation`, `taxRules` (editable data with `lastUpdated` and `sourceUrl`), and the list of calculators available for that country.
- Start with **India (`en-IN`), US (`en-US`), UK (`en-GB`)**. Adding a country must need only a new JSON file and translations.
- Currency and numbers via `Intl.NumberFormat`. Lakh/crore for India; million/billion elsewhere. Short form option ("25.9 L", "1 Cr").
- Country-only calculators: PPF, NPS, EPF (India); 401(k), IRA (US); ISA, SIPP (UK).
- Routes: `/en-in/...`, `/en-us/...`, `/en-gb/...`. Add `hreflang` and canonical tags. Default redirect by browser language, always changeable by the user.
- Use Tailwind logical classes (`ms-`, `me-`, `ps-`, `pe-`) so right-to-left languages work later.
- Start with English. Add Hindi next. Keep all text in `messages/*.json` (no hard-coded strings).

## 8. Data Layer (ready for the future)

- `lib/storage.ts`: `saveScenario(calcId, inputs)` and `loadScenario(id)`. v1 uses URL query + `localStorage`. Later it can call an API without changing the pages.
- `lib/marketData.ts`: `getMarketData()` reads `src/data/market.json` (default values at first). Show "last updated" next to any live value.
- Optional workflow `.github/workflows/update-data.yml` (scheduled daily) can fetch public data, write `market.json`, and commit it. API keys go in GitHub Secrets and never in frontend code. Keep it disabled until needed.
- If live data is needed later, use a small serverless proxy (Cloudflare Workers) and call it from `marketData.ts`. Always keep a fallback value.
- If login and saved plans are needed later, use Supabase behind the same `storage.ts` interface. Reuse the Zod schemas for validation.

## 9. SEO

- Unique title, meta description, and H1 per calculator and per country.
- JSON-LD: `WebApplication`, `FAQPage`, `BreadcrumbList`.
- `sitemap.xml` and `robots.txt` generated at build time. `hreflang` links between country pages.
- Open Graph image per calculator.
- Short helpful text (formula, example, FAQ) on every page. Avoid thin pages.

## 10. Build and Deploy (GitHub Pages)

`next.config.mjs`:
```js
const repo = process.env.NEXT_PUBLIC_BASE_PATH || '';
export default {
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true,
  basePath: repo,
  assetPrefix: repo || undefined,
};
```
- Use a custom domain if possible (then `basePath` is empty). For a project URL, set `NEXT_PUBLIC_BASE_PATH=/repo-name`.
- `.github/workflows/deploy.yml`: on push to `main` → install pnpm → lint → typecheck → unit tests → build → upload `out/` → deploy with `actions/deploy-pages`. Add `public/.nojekyll` and a `404.html`.
- Repo setting: Settings → Pages → Source: GitHub Actions.
- Keep the build portable so the same output can be hosted on Cloudflare Pages.

## 11. Testing Strategy

- **Unit tests (Vitest):** every function in `calc-core`, including the fixtures in section 5.4. Coverage target ≥ 90% for `calc-core`.
- **Component tests:** slider and number field stay in sync; validation messages appear.
- **E2E (Playwright):** open SWP page, change inputs, see correct results, share link restores the same inputs, mobile viewport works, print view works.
- **CI blocks deploy** if any test fails.

## 12. Phases and Deliverables

**Phase 0 — Setup**
pnpm workspace, Next.js static export, Tailwind, shadcn/ui, ESLint, Prettier, Vitest, CI, GitHub Pages deploy with a hello page.

**Phase 1 — `calc-core` for SWP**
Rate conversion, SWP simulation, the 5 solve modes, warnings, and all fixtures from 5.4 passing.

**Phase 2 — SWP page**
Shared calculator components, inputs, results, chart, year table, share link, print, CSV, FAQ, formula note, disclaimer. India config only, English only.

**Phase 3 — Site shell**
Home page, header/footer, dark mode, SEO basics (sitemap, robots, JSON-LD), about/privacy/disclaimer pages.

**Phase 4 — i18n and countries**
next-intl, country switcher, `hreflang`, US and UK configs, number formatting rules.

**Phase 5 — More calculators (one by one, each with tests)**
SIP → step-up SIP → lump sum → inflation → goal planner → FIRE → EMI → prepayment → FD/PPF/NPS → rent vs buy → builder delay interest.

**Phase 6 — Polish**
Lighthouse fixes, accessibility audit, e2e tests, analytics (opt-in), custom domain.

**Phase 7 — Optional future**
Scheduled market-data workflow, serverless proxy, Supabase login and saved plans, extra languages.

## 13. Definition of Done (for each calculator)

- [ ] Formula in `calc-core` with Zod schema, defaults, and tests
- [ ] Page with inputs, results, chart, table, share, print
- [ ] Warnings for early depletion and unrealistic inputs
- [ ] FAQ, formula note, disclaimer, SEO tags, JSON-LD
- [ ] Works on mobile, keyboard accessible, Lighthouse targets met
- [ ] Added to the home page, sitemap, and country config

## 14. Rules for Claude Code

- Work phase by phase. At the end of each phase: run `pnpm lint && pnpm typecheck && pnpm test && pnpm build` and fix all issues before moving on.
- Do not put formulas inside React components. Do not put currency or country logic inside `calc-core`.
- No hard-coded UI text; use `messages/*.json`.
- No API keys in the repo. No backend code in v1.
- Keep commits small, with clear messages.
- Where a choice is not covered here, pick the simplest option, and note it in `DECISIONS.md`.
- Tax rules and rates are examples only. Mark them with `lastUpdated` and `sourceUrl`, and show the disclaimer on every result page.
