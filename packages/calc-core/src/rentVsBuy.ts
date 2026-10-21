import { z } from 'zod';
import { collect, unrealisticReturn, type Warning } from './common';
import { emiAmount } from './emi';
import { periodRate } from './rates';

export const rentVsBuyInputSchema = z.object({
  homePrice: z.number().min(1).max(1e12),
  downPaymentPct: z.number().min(0).max(100),
  loanRate: z.number().min(0).max(40),
  loanYears: z.number().int().min(1).max(40),
  buyingCostPct: z.number().min(0).max(20),
  sellingCostPct: z.number().min(0).max(20),
  appreciationPct: z.number().min(-10).max(30),
  maintenancePct: z.number().min(0).max(10),
  monthlyRent: z.number().min(0).max(1e9),
  rentIncreasePct: z.number().min(0).max(30),
  investReturnPct: z.number().min(0).max(40),
  horizonYears: z.number().int().min(1).max(50),
});
export type RentVsBuyInput = z.infer<typeof rentVsBuyInputSchema>;

export const rentVsBuyDefaults: RentVsBuyInput = {
  homePrice: 8_000_000,
  downPaymentPct: 20,
  loanRate: 8.5,
  loanYears: 20,
  buyingCostPct: 6,
  sellingCostPct: 2,
  appreciationPct: 5,
  maintenancePct: 1,
  monthlyRent: 25_000,
  rentIncreasePct: 5,
  investReturnPct: 10,
  horizonYears: 15,
};

export interface RentVsBuyRow {
  year: number;
  homeValue: number;
  loanBalance: number;
  buyNetWorth: number;
  rentNetWorth: number;
}

export interface RentVsBuyResult {
  emi: number;
  downPayment: number;
  homeValueAtEnd: number;
  loanBalanceAtEnd: number;
  buyNetWorth: number;
  rentNetWorth: number;
  /** positive = buying ends up ahead */
  difference: number;
  verdict: 'buy' | 'rent';
  yearly: RentVsBuyRow[];
  warnings: Warning[];
}

export function calculateRentVsBuy(input: RentVsBuyInput): RentVsBuyResult {
  const loan = (input.homePrice * (100 - input.downPaymentPct)) / 100;
  const downPayment = input.homePrice - loan;
  const loanRate = periodRate(input.loanRate, 12, 'nominal');
  const emi = emiAmount(loan, loanRate, input.loanYears * 12);
  const investRate = periodRate(input.investReturnPct, 12, 'effective');
  const apprRate = periodRate(input.appreciationPct, 12, 'effective');

  let homeValue = input.homePrice;
  let loanBalance = loan;
  // renter starts with the cash the buyer would have used for the down payment and buying costs
  let portfolio = downPayment + (input.homePrice * input.buyingCostPct) / 100;
  const yearly: RentVsBuyRow[] = [];
  const months = input.horizonYears * 12;
  for (let m = 1; m <= months; m++) {
    const year = Math.ceil(m / 12);
    const rent = input.monthlyRent * Math.pow(1 + input.rentIncreasePct / 100, year - 1);
    const payment = m <= input.loanYears * 12 ? emi : 0;
    const maintenance = (homeValue * input.maintenancePct) / 100 / 12;
    const buyerOutflow = payment + maintenance;
    // the renter invests whatever the buyer spends beyond the rent (or draws on savings if rent is higher)
    portfolio = portfolio * (1 + investRate) + (buyerOutflow - rent);
    if (m <= input.loanYears * 12) {
      const interest = loanBalance * loanRate;
      loanBalance = Math.max(0, loanBalance - (emi - interest));
    }
    homeValue *= 1 + apprRate;
    if (m % 12 === 0) {
      yearly.push({
        year,
        homeValue,
        loanBalance,
        buyNetWorth: homeValue * (1 - input.sellingCostPct / 100) - loanBalance,
        rentNetWorth: portfolio,
      });
    }
  }
  const buyNetWorth = homeValue * (1 - input.sellingCostPct / 100) - loanBalance;
  return {
    emi,
    downPayment,
    homeValueAtEnd: homeValue,
    loanBalanceAtEnd: loanBalance,
    buyNetWorth,
    rentNetWorth: portfolio,
    difference: buyNetWorth - portfolio,
    verdict: buyNetWorth >= portfolio ? 'buy' : 'rent',
    yearly,
    warnings: collect(
      unrealisticReturn(input.investReturnPct),
      input.horizonYears < 5 && { code: 'shortHorizon' },
      input.monthlyRent * 12 > input.homePrice * 0.1 && { code: 'rentVeryHigh' },
    ),
  };
}
