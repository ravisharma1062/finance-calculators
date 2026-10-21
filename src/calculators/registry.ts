import {
  calculateDelayInterest,
  calculateEmi,
  calculateEpf,
  calculateFd,
  calculateFire,
  calculateGoal,
  calculateInflation,
  calculateLumpsum,
  calculateNps,
  calculatePpf,
  calculatePrepayment,
  calculateRentVsBuy,
  calculateRetirementAccount,
  calculateSip,
  calculateStepupSip,
  calculateSwp,
  delayInterestDefaults,
  delayInterestInputSchema,
  emiDefaults,
  emiInputSchema,
  epfDefaults,
  epfInputSchema,
  fdDefaults,
  fdInputSchema,
  fireDefaults,
  fireInputSchema,
  goalDefaults,
  goalInputSchema,
  inflationDefaults,
  inflationInputSchema,
  lumpsumDefaults,
  lumpsumInputSchema,
  npsDefaults,
  npsInputSchema,
  ppfDefaults,
  ppfInputSchema,
  prepaymentDefaults,
  prepaymentInputSchema,
  rdDefaults,
  rentVsBuyDefaults,
  rentVsBuyInputSchema,
  retirementAccountDefaults,
  retirementAccountInputSchema,
  sipDefaults,
  sipInputSchema,
  stepupSipDefaults,
  stepupSipInputSchema,
  swpDefaults,
  swpInputSchema,
  type AmortRow,
} from '@app/calc-core';
import { PLACEHOLDER_DATE, accumulationChart, accumulationTable, date, define, hiddenNum, num, sel } from './helpers';
import type { ChartSpec, ResultCard, TableSpec } from './types';
import type { CalcDef } from './types';

const RATE_METHODS = ['effective', 'nominal'];
const FREQUENCIES = ['monthly', 'quarterly', 'halfYearly', 'annual'];

const amortTable = (rows: AmortRow[]): TableSpec => ({
  id: 'monthly',
  labelKey: 'tables.monthly',
  columns: [
    { key: 'month', labelKey: 'month', kind: 'number' },
    { key: 'date', labelKey: 'date', kind: 'text' },
    { key: 'payment', labelKey: 'payment', kind: 'currency' },
    { key: 'principal', labelKey: 'principalPaid', kind: 'currency' },
    { key: 'interest', labelKey: 'interestPaid', kind: 'currency' },
    { key: 'balance', labelKey: 'balance', kind: 'currency' },
  ],
  rows: rows.map((r) => ({
    month: r.month,
    date: r.date,
    payment: r.payment,
    principal: r.principal,
    interest: r.interest,
    balance: r.closing,
  })),
});

const loanYearTable = (rows: ReturnType<typeof calculateEmi>['yearly']): TableSpec => ({
  id: 'yearly',
  labelKey: 'tables.yearly',
  columns: [
    { key: 'year', labelKey: 'year', kind: 'number' },
    { key: 'payment', labelKey: 'payment', kind: 'currency' },
    { key: 'principal', labelKey: 'principalPaid', kind: 'currency' },
    { key: 'interest', labelKey: 'interestPaid', kind: 'currency' },
    { key: 'balance', labelKey: 'balance', kind: 'currency' },
  ],
  rows: rows.map((r) => ({
    year: r.year,
    payment: r.flow,
    principal: r.flow - r.returns,
    interest: r.returns,
    balance: r.closing,
  })),
});

const loanChart = (rows: ReturnType<typeof calculateEmi>['yearly']): ChartSpec => ({
  xKey: 'year',
  xLabelKey: 'year',
  series: [
    { key: 'principal', labelKey: 'principalPaid', type: 'bar', stack: 'a' },
    { key: 'interest', labelKey: 'interestPaid', type: 'bar', stack: 'a' },
    { key: 'balance', labelKey: 'balance', type: 'line' },
  ],
  rows: rows.map((r) => ({ year: r.year, principal: r.flow - r.returns, interest: r.returns, balance: r.closing })),
});

const swp = define({
  slug: 'swp',
  category: 'withdraw',
  icon: 'Wallet',
  related: ['sip', 'fire', 'inflation', 'lumpsum'],
  schema: swpInputSchema,
  defaults: { ...swpDefaults, startDate: PLACEHOLDER_DATE },
  modeField: 'mode',
  fields: [
    sel('mode', ['useUp', 'keep', 'corpus', 'duration', 'withdrawal']),
    num('corpus', 100_000, 100_000_000, 100_000, 'currency', { modes: ['useUp', 'keep', 'duration', 'withdrawal'] }),
    num('withdrawal', 1_000, 500_000, 1_000, 'currency', { modes: ['useUp', 'corpus', 'duration'] }),
    sel('frequency', ['monthly', 'quarterly', 'halfYearly', 'annual']),
    num('years', 1, 40, 1, 'years', { modes: ['useUp', 'keep', 'corpus', 'withdrawal'] }),
    num('annualReturn', 0, 30, 0.1, 'percent'),
    sel('rateMethod', RATE_METHODS, { advanced: true }),
    sel('timing', ['end', 'start'], { advanced: true }),
    num('withdrawalStepUpPct', 0, 20, 0.5, 'percent', { advanced: true }),
    num('inflationPct', 0, 15, 0.5, 'percent', { advanced: true }),
    num('taxOnReturnsPct', 0, 40, 1, 'percent', { advanced: true }),
    date('startDate', { advanced: true }),
  ],
  calculate: calculateSwp,
  present: (r, input) => {
    const cards: ResultCard[] = [];
    const lasts: ResultCard = r.neverDepletes
      ? { id: 'moneyLasts', value: Infinity, kind: 'duration', tone: 'good' }
      : { id: 'moneyLasts', value: r.moneyLastsMonths, kind: 'duration', tone: r.lastsFullPeriod ? 'good' : 'warn' };
    if (r.mode === 'corpus') cards.push({ id: 'requiredCorpus', value: r.corpus, kind: 'currency', tone: 'primary' });
    else if (r.mode === 'withdrawal' || r.mode === 'keep')
      cards.push({ id: 'withdrawalPerPeriod', value: r.withdrawal, kind: 'currency', tone: 'primary' });
    else cards.push({ ...lasts, tone: lasts.tone === 'warn' ? 'warn' : 'primary' });
    cards.push(
      { id: 'invested', value: r.corpus, kind: 'currency' },
      { id: 'totalWithdrawn', value: r.totalWithdrawn, kind: 'currency' },
      { id: 'totalReturns', value: r.totalReturns, kind: 'currency' },
      { id: 'finalBalance', value: r.finalBalance, kind: 'currency' },
    );
    if (r.finalPayout > 0) cards.push({ id: 'finalPayout', value: r.finalPayout, kind: 'currency' });
    if (input.inflationPct > 0) cards.push({ id: 'finalBalanceReal', value: r.finalBalanceReal, kind: 'currency' });
    const yearTable = (id: string, labelKey: string, rows: typeof r.yearlyPlan): TableSpec => ({
      id,
      labelKey,
      columns: [
        { key: 'year', labelKey: 'year', kind: 'number' },
        { key: 'invested', labelKey: 'invested', kind: 'currency' },
        { key: 'withdrawn', labelKey: 'withdrawnThisYear', kind: 'currency' },
        { key: 'returns', labelKey: 'returnsThisYear', kind: 'currency' },
        { key: 'cumulativeWithdrawn', labelKey: 'totalWithdrawn', kind: 'currency' },
        { key: 'cumulativeReturns', labelKey: 'totalReturns', kind: 'currency' },
        { key: 'balance', labelKey: 'balance', kind: 'currency' },
      ],
      rows: rows.map((y) => ({
        year: y.year,
        invested: r.corpus,
        withdrawn: y.withdrawn,
        returns: y.returns,
        cumulativeWithdrawn: y.cumulativeWithdrawn,
        cumulativeReturns: y.cumulativeReturns,
        balance: y.closingBalance,
      })),
    });
    const chartRows: Record<string, number | string>[] = [{ year: 0, balance: r.corpus, withdrawn: 0 }];
    r.yearlyPlan.forEach((y) =>
      chartRows.push({ year: y.year, balance: y.closingBalance, withdrawn: y.cumulativeWithdrawn }),
    );
    return {
      cards,
      warnings: r.warnings,
      chart: {
        xKey: 'year',
        xLabelKey: 'year',
        series: [
          { key: 'balance', labelKey: 'balance', type: 'area' },
          { key: 'withdrawn', labelKey: 'totalWithdrawn', type: 'line' },
        ],
        rows: chartRows,
      },
      tables: [
        yearTable('plan', 'tables.planYear', r.yearlyPlan),
        yearTable('calendar', 'tables.calendarYear', r.yearlyCalendar),
        {
          id: 'periods',
          labelKey: 'tables.periods',
          columns: [
            { key: 'index', labelKey: 'number', kind: 'number' },
            { key: 'date', labelKey: 'date', kind: 'text' },
            { key: 'opening', labelKey: 'openingBalance', kind: 'currency' },
            { key: 'returns', labelKey: 'returns', kind: 'currency' },
            { key: 'withdrawal', labelKey: 'withdrawal', kind: 'currency' },
            { key: 'closing', labelKey: 'balance', kind: 'currency' },
          ],
          rows: r.schedule.map((p) => ({
            index: p.index,
            date: p.date,
            opening: p.openingBalance,
            returns: p.returns,
            withdrawal: p.withdrawal,
            closing: p.closingBalance,
          })),
        } as TableSpec,
      ].filter((t) => t.rows.length > 0),
    };
  },
});

const sipFields = (stepUp: boolean) => [
  num('monthlyInvestment', 500, 500_000, 500, 'currency'),
  num('years', 1, 40, 1, 'years'),
  num('annualReturn', 1, 30, 0.1, 'percent'),
  ...(stepUp ? [num('stepUpPct', 0, 30, 0.5, 'percent')] : []),
  sel('rateMethod', RATE_METHODS, { advanced: true }),
  sel('timing', ['start', 'end'], { advanced: true }),
  ...(stepUp ? [] : [num('stepUpPct', 0, 30, 0.5, 'percent', { advanced: true })]),
  num('inflationPct', 0, 15, 0.5, 'percent', { advanced: true }),
];

const sip = define({
  slug: 'sip',
  category: 'invest',
  icon: 'TrendingUp',
  related: ['step-up-sip', 'lumpsum', 'goal-planner', 'swp'],
  schema: sipInputSchema,
  defaults: sipDefaults,
  fields: sipFields(false),
  calculate: calculateSip,
  present: (r, i) => ({
    cards: [
      { id: 'futureValue', value: r.futureValue, kind: 'currency', tone: 'primary' },
      { id: 'invested', value: r.invested, kind: 'currency' },
      { id: 'returns', value: r.returns, kind: 'currency', tone: 'good' },
      ...(i.inflationPct > 0 ? [{ id: 'realValue', value: r.realValue, kind: 'currency' as const }] : []),
    ],
    warnings: r.warnings,
    chart: accumulationChart(r.yearly),
    tables: [accumulationTable(r.yearly)],
  }),
});

const stepupSip = define({
  slug: 'step-up-sip',
  category: 'invest',
  icon: 'ChartNoAxesCombined',
  related: ['sip', 'goal-planner', 'fire', 'lumpsum'],
  schema: stepupSipInputSchema,
  defaults: stepupSipDefaults,
  fields: sipFields(true),
  calculate: calculateStepupSip,
  present: (r, i) => ({
    cards: [
      { id: 'futureValue', value: r.futureValue, kind: 'currency', tone: 'primary' },
      { id: 'invested', value: r.invested, kind: 'currency' },
      { id: 'returns', value: r.returns, kind: 'currency', tone: 'good' },
      { id: 'flatFutureValue', value: r.flatFutureValue, kind: 'currency' },
      { id: 'extraFromStepUp', value: r.extraFromStepUp, kind: 'currency', tone: 'good' },
      { id: 'lastMonthlyInvestment', value: r.lastMonthlyInvestment, kind: 'currency' },
      ...(i.inflationPct > 0 ? [{ id: 'realValue', value: r.realValue, kind: 'currency' as const }] : []),
    ],
    warnings: r.warnings,
    chart: accumulationChart(r.yearly),
    tables: [accumulationTable(r.yearly)],
  }),
});

const lumpsum = define({
  slug: 'lumpsum',
  category: 'invest',
  icon: 'Banknote',
  related: ['sip', 'goal-planner', 'inflation', 'fd'],
  schema: lumpsumInputSchema,
  defaults: lumpsumDefaults,
  modeField: 'mode',
  fields: [
    sel('mode', ['forward', 'reverse']),
    num('amount', 10_000, 100_000_000, 10_000, 'currency'),
    num('years', 1, 40, 1, 'years'),
    num('annualReturn', 1, 30, 0.1, 'percent'),
    num('inflationPct', 0, 15, 0.5, 'percent', { advanced: true }),
  ],
  calculate: calculateLumpsum,
  present: (r, i) => ({
    cards: [
      r.mode === 'reverse'
        ? { id: 'requiredToday', value: r.invested, kind: 'currency', tone: 'primary' }
        : { id: 'futureValue', value: r.futureValue, kind: 'currency', tone: 'primary' },
      ...(r.mode === 'reverse'
        ? [{ id: 'targetAmount', value: r.futureValue, kind: 'currency' as const }]
        : [{ id: 'invested', value: r.invested, kind: 'currency' as const }]),
      { id: 'returns', value: r.returns, kind: 'currency', tone: 'good' },
      ...(i.inflationPct > 0 ? [{ id: 'realValue', value: r.realValue, kind: 'currency' as const }] : []),
    ],
    warnings: r.warnings,
    chart: {
      xKey: 'year',
      xLabelKey: 'year',
      series: [
        { key: 'balance', labelKey: 'balance', type: 'area' },
        { key: 'invested', labelKey: 'invested', type: 'line' },
      ],
      rows: [
        { year: 0, balance: r.invested, invested: r.invested },
        ...r.yearly.map((y) => ({ year: y.year, balance: y.closing, invested: r.invested })),
      ],
    },
    tables: [accumulationTable(r.yearly)],
  }),
});

const goal = define({
  slug: 'goal-planner',
  category: 'invest',
  icon: 'Target',
  related: ['sip', 'lumpsum', 'inflation', 'step-up-sip'],
  schema: goalInputSchema,
  defaults: goalDefaults,
  fields: [
    num('goalAmountToday', 100_000, 100_000_000, 100_000, 'currency'),
    num('years', 1, 40, 1, 'years'),
    num('goalInflationPct', 0, 15, 0.5, 'percent'),
    num('annualReturn', 1, 30, 0.1, 'percent'),
    num('existingSavings', 0, 50_000_000, 50_000, 'currency'),
    sel('rateMethod', RATE_METHODS, { advanced: true }),
  ],
  calculate: calculateGoal,
  present: (r) => ({
    cards: [
      { id: 'requiredSip', value: r.requiredMonthlySip, kind: 'currency', tone: 'primary' },
      { id: 'requiredLumpsum', value: r.requiredLumpsum, kind: 'currency', tone: 'primary' },
      { id: 'goalAmountFuture', value: r.goalAmountFuture, kind: 'currency' },
      { id: 'existingSavingsFuture', value: r.existingSavingsFuture, kind: 'currency' },
      { id: 'shortfall', value: r.shortfall, kind: 'currency' },
      { id: 'totalSipInvested', value: r.totalSipInvested, kind: 'currency' },
    ],
    warnings: r.warnings,
    tables: [],
  }),
});

const inflation = define({
  slug: 'inflation',
  category: 'invest',
  icon: 'Percent',
  related: ['goal-planner', 'sip', 'fire', 'swp'],
  schema: inflationInputSchema,
  defaults: inflationDefaults,
  fields: [
    num('amount', 1_000, 10_000_000, 1_000, 'currency'),
    num('years', 1, 50, 1, 'years'),
    num('inflationPct', 0, 20, 0.1, 'percent'),
  ],
  calculate: calculateInflation,
  present: (r) => ({
    cards: [
      { id: 'futureCost', value: r.futureCost, kind: 'currency', tone: 'primary' },
      { id: 'purchasingPower', value: r.purchasingPower, kind: 'currency', tone: 'warn' },
      { id: 'powerLost', value: r.powerLostPct, kind: 'percent' },
    ],
    warnings: [],
    chart: {
      xKey: 'year',
      xLabelKey: 'year',
      series: [
        { key: 'futureCost', labelKey: 'futureCost', type: 'area' },
        { key: 'purchasingPower', labelKey: 'purchasingPower', type: 'line' },
      ],
      rows: r.yearly.map((y) => ({ year: y.year, futureCost: y.futureCost, purchasingPower: y.purchasingPower })),
    },
    tables: [
      {
        id: 'yearly',
        labelKey: 'tables.yearly',
        columns: [
          { key: 'year', labelKey: 'year', kind: 'number' },
          { key: 'futureCost', labelKey: 'futureCost', kind: 'currency' },
          { key: 'purchasingPower', labelKey: 'purchasingPower', kind: 'currency' },
        ],
        rows: r.yearly.map((y) => ({ year: y.year, futureCost: y.futureCost, purchasingPower: y.purchasingPower })),
      },
    ],
  }),
});

const fire = define({
  slug: 'fire',
  category: 'retirement',
  icon: 'Flame',
  related: ['swp', 'sip', 'step-up-sip', 'inflation'],
  schema: fireInputSchema,
  defaults: fireDefaults,
  fields: [
    num('currentAge', 18, 70, 1, 'age'),
    num('retirementAge', 30, 80, 1, 'age'),
    num('annualExpenses', 100_000, 10_000_000, 50_000, 'currency'),
    num('currentSavings', 0, 100_000_000, 100_000, 'currency'),
    num('monthlyInvestment', 0, 1_000_000, 1_000, 'currency'),
    num('annualReturn', 1, 25, 0.1, 'percent'),
    num('inflationPct', 0, 15, 0.5, 'percent', { advanced: true }),
    num('safeWithdrawalPct', 1, 8, 0.1, 'percent', { advanced: true }),
    num('stepUpPct', 0, 20, 0.5, 'percent', { advanced: true }),
    sel('rateMethod', RATE_METHODS, { advanced: true }),
  ],
  calculate: calculateFire,
  present: (r) => ({
    cards: [
      { id: 'fireCorpus', value: r.fireCorpus, kind: 'currency', tone: 'primary' },
      { id: 'projectedCorpus', value: r.projectedCorpus, kind: 'currency', tone: r.onTrack ? 'good' : 'warn' },
      { id: 'gap', value: r.gap, kind: 'currency' },
      { id: 'extraMonthlyNeeded', value: r.extraMonthlyNeeded, kind: 'currency' },
      { id: 'fireAge', value: r.fireAge ?? '-', kind: typeof r.fireAge === 'number' ? 'age' : 'text' },
      { id: 'expensesAtRetirement', value: r.expensesAtRetirement, kind: 'currency' },
    ],
    warnings: r.warnings,
    chart: {
      xKey: 'age',
      xLabelKey: 'age',
      series: [
        { key: 'corpus', labelKey: 'projectedCorpus', type: 'area' },
        { key: 'target', labelKey: 'fireTarget', type: 'line' },
      ],
      rows: r.yearly.map((y) => ({ age: y.age, corpus: y.corpus, target: y.target })),
    },
    tables: [
      {
        id: 'yearly',
        labelKey: 'tables.yearly',
        columns: [
          { key: 'age', labelKey: 'age', kind: 'number' },
          { key: 'corpus', labelKey: 'projectedCorpus', kind: 'currency' },
          { key: 'target', labelKey: 'fireTarget', kind: 'currency' },
        ],
        rows: r.yearly.map((y) => ({ age: y.age, corpus: y.corpus, target: y.target })),
      },
    ],
  }),
});

const emi = define({
  slug: 'emi',
  category: 'loans',
  icon: 'Landmark',
  related: ['loan-prepayment', 'rent-vs-buy', 'goal-planner', 'inflation'],
  schema: emiInputSchema,
  defaults: { ...emiDefaults, startDate: PLACEHOLDER_DATE },
  fields: [
    num('loanAmount', 50_000, 100_000_000, 50_000, 'currency'),
    num('annualRate', 1, 30, 0.05, 'percent'),
    num('tenureMonths', 6, 360, 6, 'months'),
    sel('rateMethod', RATE_METHODS, { advanced: true }),
    date('startDate', { advanced: true }),
  ],
  calculate: calculateEmi,
  present: (r, i) => ({
    cards: [
      { id: 'emi', value: r.emi, kind: 'currency', tone: 'primary' },
      { id: 'totalInterest', value: r.totalInterest, kind: 'currency', tone: 'warn' },
      { id: 'totalPayment', value: r.totalPayment, kind: 'currency' },
      { id: 'loanAmount', value: i.loanAmount, kind: 'currency' },
      { id: 'interestShare', value: r.interestSharePct, kind: 'percent' },
    ],
    warnings: r.warnings,
    chart: loanChart(r.yearly),
    tables: [loanYearTable(r.yearly), amortTable(r.schedule)],
  }),
});

const prepayment = define({
  slug: 'loan-prepayment',
  category: 'loans',
  icon: 'PiggyBank',
  related: ['emi', 'rent-vs-buy', 'sip', 'lumpsum'],
  schema: prepaymentInputSchema,
  defaults: { ...prepaymentDefaults, startDate: PLACEHOLDER_DATE },
  modeField: 'effect',
  fields: [
    sel('effect', ['reduceTenure', 'reduceEmi']),
    num('loanAmount', 50_000, 100_000_000, 50_000, 'currency'),
    num('annualRate', 1, 30, 0.05, 'percent'),
    num('tenureMonths', 6, 360, 6, 'months'),
    num('prepaymentAmount', 0, 50_000_000, 10_000, 'currency'),
    num('prepaymentAfterMonth', 1, 360, 1, 'months'),
    num('extraMonthly', 0, 500_000, 500, 'currency'),
    sel('rateMethod', RATE_METHODS, { advanced: true }),
    date('startDate', { advanced: true }),
  ],
  calculate: calculatePrepayment,
  present: (r) => ({
    cards: [
      { id: 'interestSaved', value: r.interestSaved, kind: 'currency', tone: 'primary' },
      { id: 'monthsSaved', value: r.monthsSaved, kind: 'duration', tone: 'good' },
      { id: 'newEmi', value: r.newEmi, kind: 'currency' },
      { id: 'originalEmi', value: r.originalEmi, kind: 'currency' },
      { id: 'newInterest', value: r.newInterest, kind: 'currency' },
      { id: 'originalInterest', value: r.originalInterest, kind: 'currency' },
      { id: 'newTenure', value: r.newMonths, kind: 'duration' },
    ],
    warnings: r.warnings,
    chart: loanChart(r.yearly),
    tables: [loanYearTable(r.yearly), amortTable(r.schedule)],
  }),
});

const fdLike = (kind: 'fd' | 'rd') =>
  define({
    slug: kind,
    category: 'invest',
    icon: kind === 'fd' ? 'Vault' : 'CalendarClock',
    related: kind === 'fd' ? ['rd', 'ppf', 'lumpsum', 'inflation'] : ['fd', 'sip', 'goal-planner', 'ppf'],
    schema: fdInputSchema,
    defaults: kind === 'fd' ? fdDefaults : rdDefaults,
    rulesMap: kind === 'fd' ? { indicativeRate: 'annualRate' } : undefined,
    fields: [
      num(
        'amount',
        kind === 'fd' ? 10_000 : 500,
        kind === 'fd' ? 50_000_000 : 200_000,
        kind === 'fd' ? 10_000 : 500,
        'currency',
      ),
      num('annualRate', 1, 15, 0.05, 'percent'),
      num('years', 0.5, 20, 0.5, 'years'),
      sel('compounding', FREQUENCIES),
      num('taxPct', 0, 40, 1, 'percent', { advanced: true }),
      { kind: 'select', name: 'kind', options: [kind], hidden: true },
    ],
    calculate: calculateFd,
    present: (r) => ({
      cards: [
        { id: 'maturity', value: r.maturity, kind: 'currency', tone: 'primary' },
        { id: 'invested', value: r.invested, kind: 'currency' },
        { id: 'interestEarned', value: r.interest, kind: 'currency', tone: 'good' },
        { id: 'effectiveYield', value: r.effectiveYieldPct, kind: 'percent' },
        ...(r.tax > 0
          ? [
              { id: 'taxOnInterest', value: r.tax, kind: 'currency' as const },
              { id: 'maturityAfterTax', value: r.maturityAfterTax, kind: 'currency' as const },
            ]
          : []),
      ],
      warnings: r.warnings,
      chart: accumulationChart(r.yearly),
      tables: [accumulationTable(r.yearly)],
    }),
  });

const ppf = define({
  slug: 'ppf',
  category: 'tax',
  icon: 'ShieldCheck',
  related: ['fd', 'nps', 'epf', 'sip'],
  schema: ppfInputSchema,
  defaults: ppfDefaults,
  rulesMap: { rate: 'annualRate', yearlyLimit: 'yearlyLimit' },
  fields: [
    num('yearlyDeposit', 500, 150_000, 500, 'currency'),
    num('years', 15, 50, 5, 'years'),
    num('annualRate', 4, 10, 0.1, 'percent'),
    sel('depositTiming', ['start', 'end'], { advanced: true }),
    hiddenNum('yearlyLimit'),
  ],
  calculate: calculatePpf,
  present: (r) => ({
    cards: [
      { id: 'maturity', value: r.maturity, kind: 'currency', tone: 'primary' },
      { id: 'invested', value: r.invested, kind: 'currency' },
      { id: 'interestEarned', value: r.interest, kind: 'currency', tone: 'good' },
    ],
    warnings: r.warnings,
    chart: accumulationChart(r.yearly),
    tables: [accumulationTable(r.yearly)],
  }),
});

const nps = define({
  slug: 'nps',
  category: 'retirement',
  icon: 'Umbrella',
  related: ['epf', 'ppf', 'fire', 'sip'],
  schema: npsInputSchema,
  defaults: npsDefaults,
  rulesMap: { minAnnuityPct: 'minAnnuityPct', retirementAge: 'retirementAge' },
  fields: [
    num('monthlyContribution', 500, 200_000, 500, 'currency'),
    num('currentAge', 18, 65, 1, 'age'),
    num('retirementAge', 40, 75, 1, 'age'),
    num('annualReturn', 4, 16, 0.1, 'percent'),
    num('annuityPct', 0, 100, 1, 'percent'),
    num('annuityRate', 3, 10, 0.1, 'percent'),
    num('stepUpPct', 0, 20, 0.5, 'percent', { advanced: true }),
    sel('rateMethod', RATE_METHODS, { advanced: true }),
    hiddenNum('minAnnuityPct'),
  ],
  calculate: calculateNps,
  present: (r) => ({
    cards: [
      { id: 'corpus', value: r.corpus, kind: 'currency', tone: 'primary' },
      { id: 'monthlyPension', value: r.monthlyPension, kind: 'currency', tone: 'good' },
      { id: 'lumpSum', value: r.lumpSum, kind: 'currency' },
      { id: 'annuityCorpus', value: r.annuityCorpus, kind: 'currency' },
      { id: 'invested', value: r.invested, kind: 'currency' },
      { id: 'returns', value: r.returns, kind: 'currency' },
    ],
    warnings: r.warnings,
    chart: accumulationChart(r.yearly),
    tables: [accumulationTable(r.yearly)],
  }),
});

const epf = define({
  slug: 'epf',
  category: 'retirement',
  icon: 'Building2',
  related: ['nps', 'ppf', 'fire', 'sip'],
  schema: epfInputSchema,
  defaults: epfDefaults,
  rulesMap: { rate: 'annualRate', employeePct: 'employeePct', employerEpfPct: 'employerPct' },
  fields: [
    num('monthlyBasicSalary', 5_000, 1_000_000, 1_000, 'currency'),
    num('currentAge', 18, 65, 1, 'age'),
    num('retirementAge', 40, 75, 1, 'age'),
    num('salaryHikePct', 0, 20, 0.5, 'percent'),
    num('currentBalance', 0, 20_000_000, 10_000, 'currency'),
    num('annualRate', 4, 12, 0.05, 'percent', { advanced: true }),
    num('employeePct', 0, 30, 0.5, 'percent', { advanced: true }),
    num('employerPct', 0, 30, 0.01, 'percent', { advanced: true }),
  ],
  calculate: calculateEpf,
  present: (r) => ({
    cards: [
      { id: 'maturity', value: r.maturity, kind: 'currency', tone: 'primary' },
      { id: 'employeeTotal', value: r.employeeTotal, kind: 'currency' },
      { id: 'employerTotal', value: r.employerTotal, kind: 'currency' },
      { id: 'interestEarned', value: r.interest, kind: 'currency', tone: 'good' },
    ],
    warnings: r.warnings,
    chart: accumulationChart(r.yearly),
    tables: [accumulationTable(r.yearly)],
  }),
});

const rentVsBuy = define({
  slug: 'rent-vs-buy',
  category: 'property',
  icon: 'House',
  related: ['emi', 'loan-prepayment', 'sip', 'inflation'],
  schema: rentVsBuyInputSchema,
  defaults: rentVsBuyDefaults,
  fields: [
    num('homePrice', 500_000, 200_000_000, 100_000, 'currency'),
    num('downPaymentPct', 0, 90, 1, 'percent'),
    num('loanRate', 1, 20, 0.05, 'percent'),
    num('loanYears', 5, 40, 1, 'years'),
    num('monthlyRent', 1_000, 500_000, 500, 'currency'),
    num('horizonYears', 1, 40, 1, 'years'),
    num('appreciationPct', -2, 15, 0.1, 'percent'),
    num('investReturnPct', 1, 20, 0.1, 'percent'),
    num('rentIncreasePct', 0, 15, 0.5, 'percent', { advanced: true }),
    num('buyingCostPct', 0, 12, 0.5, 'percent', { advanced: true }),
    num('sellingCostPct', 0, 12, 0.5, 'percent', { advanced: true }),
    num('maintenancePct', 0, 5, 0.1, 'percent', { advanced: true }),
  ],
  calculate: calculateRentVsBuy,
  present: (r) => ({
    cards: [
      {
        id: r.verdict === 'buy' ? 'verdictBuy' : 'verdictRent',
        value: Math.abs(r.difference),
        kind: 'currency',
        tone: 'primary',
      },
      { id: 'buyNetWorth', value: r.buyNetWorth, kind: 'currency' },
      { id: 'rentNetWorth', value: r.rentNetWorth, kind: 'currency' },
      { id: 'emi', value: r.emi, kind: 'currency' },
      { id: 'downPayment', value: r.downPayment, kind: 'currency' },
      { id: 'homeValueAtEnd', value: r.homeValueAtEnd, kind: 'currency' },
      { id: 'loanBalanceAtEnd', value: r.loanBalanceAtEnd, kind: 'currency' },
    ],
    warnings: r.warnings,
    chart: {
      xKey: 'year',
      xLabelKey: 'year',
      series: [
        { key: 'buyNetWorth', labelKey: 'buyNetWorth', type: 'line' },
        { key: 'rentNetWorth', labelKey: 'rentNetWorth', type: 'line' },
      ],
      rows: r.yearly.map((y) => ({ year: y.year, buyNetWorth: y.buyNetWorth, rentNetWorth: y.rentNetWorth })),
    },
    tables: [
      {
        id: 'yearly',
        labelKey: 'tables.yearly',
        columns: [
          { key: 'year', labelKey: 'year', kind: 'number' },
          { key: 'homeValue', labelKey: 'homeValue', kind: 'currency' },
          { key: 'loanBalance', labelKey: 'loanBalance', kind: 'currency' },
          { key: 'buyNetWorth', labelKey: 'buyNetWorth', kind: 'currency' },
          { key: 'rentNetWorth', labelKey: 'rentNetWorth', kind: 'currency' },
        ],
        rows: r.yearly.map((y) => ({ ...y })),
      },
    ],
  }),
});

const delay = define({
  slug: 'builder-delay-interest',
  category: 'property',
  icon: 'CalendarX2',
  related: ['rent-vs-buy', 'emi', 'inflation', 'loan-prepayment'],
  schema: delayInterestInputSchema,
  defaults: delayInterestDefaults,
  fields: [
    num('amountPaid', 100_000, 200_000_000, 100_000, 'currency'),
    num('annualRatePct', 1, 24, 0.25, 'percent'),
    date('dueDate'),
    date('actualDate'),
  ],
  calculate: calculateDelayInterest,
  present: (r) => ({
    cards: [
      { id: 'delayInterest', value: r.interest, kind: 'currency', tone: 'primary' },
      { id: 'delayDays', value: r.delayDays, kind: 'days' },
      { id: 'interestPerMonth', value: r.interestPerMonth, kind: 'currency' },
      { id: 'totalWithInterest', value: r.totalDue, kind: 'currency' },
    ],
    warnings: r.warnings,
    tables: [],
  }),
});

const retirementAccount = (slug: string, icon: string, related: string[], opts: { match?: boolean; topUp?: boolean }) =>
  define({
    slug,
    category: 'retirement',
    icon,
    related,
    schema: retirementAccountInputSchema,
    defaults: retirementAccountDefaults,
    rulesMap: {
      yearlyLimit: 'yearlyLimit',
      ...(opts.match ? { employerMatchPct: 'employerMatchPct' } : {}),
      ...(opts.topUp ? { governmentTopUpPct: 'governmentTopUpPct' } : {}),
    },
    fields: [
      num('yearlyContribution', 500, 100_000, 100, 'currency'),
      num('years', 1, 50, 1, 'years'),
      num('annualReturn', 1, 15, 0.1, 'percent'),
      num('currentBalance', 0, 5_000_000, 1_000, 'currency'),
      num('inflationPct', 0, 10, 0.1, 'percent', { advanced: true }),
      num('stepUpPct', 0, 10, 0.5, 'percent', { advanced: true }),
      ...(opts.match
        ? [num('employerMatchPct', 0, 100, 5, 'percent', { advanced: true })]
        : [hiddenNum('employerMatchPct')]),
      ...(opts.topUp
        ? [num('governmentTopUpPct', 0, 50, 1, 'percent', { advanced: true })]
        : [hiddenNum('governmentTopUpPct')]),
      hiddenNum('yearlyLimit'),
    ],
    calculate: calculateRetirementAccount,
    present: (r) => ({
      cards: [
        { id: 'futureValue', value: r.futureValue, kind: 'currency', tone: 'primary' },
        { id: 'realValue', value: r.realValue, kind: 'currency' },
        { id: 'ownContributions', value: r.ownTotal, kind: 'currency' },
        ...(r.employerTotal > 0
          ? [{ id: 'employerContributions', value: r.employerTotal, kind: 'currency' as const }]
          : []),
        ...(r.governmentTotal > 0
          ? [{ id: 'governmentTopUp', value: r.governmentTotal, kind: 'currency' as const }]
          : []),
        { id: 'returns', value: r.returns, kind: 'currency', tone: 'good' },
      ],
      warnings: r.warnings,
      chart: accumulationChart(r.yearly),
      tables: [accumulationTable(r.yearly)],
    }),
  });

export const calculators: CalcDef[] = [
  swp,
  sip,
  stepupSip,
  lumpsum,
  goal,
  fire,
  inflation,
  emi,
  prepayment,
  fdLike('fd'),
  fdLike('rd'),
  ppf,
  nps,
  epf,
  rentVsBuy,
  delay,
  retirementAccount('401k', 'BriefcaseBusiness', ['ira', 'fire', 'sip', 'inflation'], { match: true }),
  retirementAccount('ira', 'PiggyBank', ['401k', 'fire', 'sip', 'inflation'], {}),
  retirementAccount('isa', 'ShieldCheck', ['sipp', 'fire', 'sip', 'inflation'], {}),
  retirementAccount('sipp', 'Umbrella', ['isa', 'fire', 'sip', 'inflation'], { topUp: true }),
];

export const calculatorBySlug = (slug: string): CalcDef | undefined => calculators.find((c) => c.slug === slug);
