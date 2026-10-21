# Finance Calculators

Free finance calculators for India, the US and the UK. Static site (no backend), all maths runs in the browser. First calculator: **SWP (Systematic Withdrawal Plan)**.

Calculators: SWP, SIP, step-up SIP, lump sum, goal planner, FIRE, inflation, EMI, loan prepayment, FD, RD, PPF, NPS, EPF, rent vs buy, builder delay interest, 401(k), IRA, ISA, SIPP.

See [PLAN.md](PLAN.md) for the plan and [DECISIONS.md](DECISIONS.md) for where the build differs from it.

## Stack

Next.js (App Router, static export) · React · TypeScript (strict) · Tailwind CSS · Recharts · React Hook Form + Zod · next-intl · Vitest · Playwright · pnpm workspace.

## Layout

```
packages/calc-core/   pure formulas + tests (no UI, no currency). Imported as @app/calc-core
config/               countries/*.json (currency, defaults, tax rules) and site.ts
messages/             en.json, hi.json, ... (all UI text) and per-calculator copy
src/app/[locale]/     pages (home, calculators/[slug], about, privacy, disclaimer)
src/calculators/      registry: fields, defaults and result views for every calculator
src/components/       calculator, layout and seo components
src/lib/              format, urlState, storage, marketData, csv, ...
e2e/                  Playwright tests
```

## Commands

```bash
pnpm install
pnpm dev            # http://localhost:3000
pnpm lint
pnpm typecheck
pnpm test           # calc-core (with coverage) + component tests
pnpm build          # static site in out/
pnpm test:e2e       # needs `pnpm build` first and `pnpm exec playwright install chromium`
pnpm check          # lint, typecheck, test, build
```

## Add a calculator

1. Write the formula in `packages/calc-core/src/<name>.ts` with a Zod `inputSchema`, `calculate()`, `defaults` and tests.
2. Add it to `src/calculators/registry.ts` (fields and result view) and to `calculators` in `config/countries/*.json`.
3. Add its copy to `messages/en.calculators.json` (name, SEO text, formula, FAQ) and any new labels to `messages/en.json`. `src/calculators/registry.test.ts` fails if a label is missing.

## Add a country

Add `config/countries/<code>.json` (copy `gb.json`) and register it in `config/site.ts`, then add its name under `countries` in `messages/en.json`.

## Deploy (GitHub Pages)

`.github/workflows/deploy.yml` runs lint, typecheck, unit tests, a build and the end-to-end tests, then deploys `out/`. In the repository settings set **Pages > Source: GitHub Actions**.

For a project page the site lives at `https://<user>.github.io/<repo>`, so the workflow builds with `NEXT_PUBLIC_BASE_PATH=/finance-calculators`. For a custom domain leave `NEXT_PUBLIC_BASE_PATH` empty and set `NEXT_PUBLIC_SITE_URL` to the domain.

Optional build settings: `NEXT_PUBLIC_ANALYTICS_DOMAIN` turns on Plausible analytics (off by default).

This is not financial advice. Results are estimates.
