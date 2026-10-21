# Decisions

Choices that PLAN.md did not cover, and places where the build differs from the plan. Newest ideas go at the bottom of each section.

## Differences from PLAN.md

### Two test fixtures in section 5.4 do not match the plan's own formulas

The tests use the exact values that the plan's formulas give.

| Fixture in PLAN.md                                                                      | Exact value from the plan's formula | Test                                                                           |
| --------------------------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------ |
| 25,000 x 180 months at 6% nominal, corpus about 29,61,000 (+-1,000)                     | 29,62,587                           | the corpus must be within 5 of 29,62,587 and within 2,000 of the plan's number |
| Effective 6%, 20 lakh, 25,000 a month: final balance about 18,262 after 101 withdrawals | 14,821                              | the balance after the 101st withdrawal must be within 1 of 14,821              |

The second one cannot be right: the plan's year-1 balance (1,811,837) only comes from the exact monthly rate `1.06^(1/12) - 1`, and the same rate gives 14,821 after 101 withdrawals. A final balance of 18,262 would need a monthly rate of about 0.4890%, which would give a year-1 balance of 1,812,366, not 1,811,837. The other fixtures (50,000 x 60 months, 102.4 months, 50,000 a month for 1 crore, year-1 balance, 101 full withdrawals, total withdrawn 25,25,000) match.

### "Money lasts" results stop at the last full withdrawal

The plan says to pay the remaining balance when it is smaller than the withdrawal, and also that `totalWithdrawn` is 25,25,000 (101 full withdrawals). Both hold like this: the schedule has a last partial row (flagged `partial`), but `totalWithdrawn`, `totalReturns` and `finalBalance` stop at the last full withdrawal, and the small last payout is reported on its own as `finalPayout`. With this, `totalWithdrawn + finalBalance = corpus + totalReturns` always holds (property test).

### Warnings are codes, not text

`calc-core` returns `{ code, params }` and the UI turns it into text from `messages/*.json`. This keeps UI text and languages out of the formula package. The plan's example sentence is the `endsEarly` message.

### Hand-written shadcn-style components

There is no `components.json` and no shadcn CLI. The few components that are needed (button, tabs, slider field, table) are written by hand in the same style (class-variance-authority, tailwind-merge, CSS variables). It avoids a generated dependency tree for a handful of components.

### Hindi is partial

`messages/hi.json` and `messages/hi.calculators.json` translate the shell (menu, home, footer, buttons) and the main SWP labels. Missing keys fall back to English (`deepMerge` in `src/i18n/messages.ts`), so no page breaks. Longer texts (FAQ, formulas) are English for now. Hindi is available for India only (`hi-in`).

### Country-only calculators

PPF, NPS, EPF (India), 401(k), IRA (US), ISA, SIPP (UK) are all offered. EPF, 401(k), IRA, ISA and SIPP are not in the plan's phase list, but section 7 asks for them. 401(k), IRA, ISA and SIPP share one formula (`retirementAccount.ts`) because they only differ in rules (limit, employer match, government top-up), and rules are data.

### Tax rules are examples

Every rule in `config/countries/*.json` has `lastUpdated` and `sourceUrl`. Values were set from general knowledge and have not been checked against the sources on the date of the build. The calculator pages show the rules, the date and the source link, and every result shows the "not financial advice" line.

### Open Graph images

Not built. Pages have `og:title`, `og:description` and canonical/hreflang tags. A per-calculator image would need `next/og` at build time with fonts for every language; it is left for Phase 6 polish.

## Tooling

- **next-intl is pinned to 4.5.8 and `@swc/core` to 1.15.47** (`overrides` in `pnpm-workspace.yaml`). next-intl 4.14 pulls in `@swc/core` 1.16, whose native addon refuses to load on Windows when `C:\` has a write ACL for the user, which stops `next build`. 4.5.8 supports Next 16.
- **TypeScript 6**, not 7: `typescript-eslint` does not support 7 yet.
- **pnpm 12** (`packageManager` in `package.json`).
- **Windows build quirk**: on Windows, `next build` writes the router prefetch files (`__next.*.txt`) into folders, so the browser gets a 404 for them and falls back to a normal page load. The site works. The Linux build in GitHub Actions writes them correctly. The end-to-end tests ignore 404s for `__next.*` files only.

## Maths

- **Rate method.** Effective is the default everywhere except loans (EMI, prepayment, rent vs buy loan) and FD/RD/PPF-type products, which use the nominal rate the way banks quote it.
- **Tax on returns (SWP).** Applied as a cut of the period return (`i x (1 - tax)`), so the closed-form solve modes and the simulation agree.
- **Step-up (SWP).** The withdrawal rises once a year (every `periodsPerYear` withdrawals). The closed-form growing annuity is used in tests to cross-check the loop that the app uses.
- **Keep principal.** `corpus x i` each period, which is `corpus x r / n` for the nominal method (so 1 crore at 6% gives 50,000 a month). With a step-up `g` the first withdrawal is scaled by `(r - g) / r`, as the plan says (`corpus x (r - g)` a year). A warning is shown when `g >= r`.
- **SIP timing.** The default is the start of the month (the common way SIP calculators work); the end of the month is an option.
- **FIRE.** The corpus target grows with inflation every year, and "earliest FIRE age" is the first year-end where the projected balance reaches that year's target. The default safe withdrawal rate is 3.5%.
- **PPF.** Interest is credited once a year on the balance after the yearly deposit (deposit at the start of the year). Real PPF counts monthly minimum balances; this is a simple model.
- **EPF.** Interest is worked out monthly on the running balance and added once a year.
- **Delay interest.** Simple interest, `amount x rate x days / 365`.

## Product

- **Locale in the URL is `<language>-<country>`** (`en-in`, `hi-in`, `en-us`, `en-gb`). Adding a country needs one JSON file in `config/countries/` and a name in `messages/en.json` (`countries.xx`).
- **Currency amounts for other countries** are the Indian defaults times `amountScale` and rounded to a nice number (for example 20 lakh becomes 25,000 in US dollars). They are only starting points.
- **"Today" is not known at build time.** The first render uses a fixed placeholder date so the pre-built HTML and the first browser render match, then the real date is set after load. "Today" is not written into share links.
- **Share link.** Only inputs that differ from the defaults are written to the query string. Unknown keys and wrong types in a link are ignored.
- **Contact link** in the footer goes to the GitHub issues page, so no personal email address is published.
- **Analytics** use Plausible and are off unless `NEXT_PUBLIC_ANALYTICS_DOMAIN` is set at build time.
- **No licence file** was added. Choose one before inviting contributions.
- **Scheduled data workflow** (`update-data.yml`) is present but disabled (`if: false`). `marketData.ts` reads `src/data/market.json`, which holds sample values.
