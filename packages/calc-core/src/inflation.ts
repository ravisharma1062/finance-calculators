import { z } from 'zod';

export const inflationInputSchema = z.object({
  amount: z.number().min(1).max(1e12),
  years: z.number().min(1).max(100),
  inflationPct: z.number().min(0).max(50),
});
export type InflationInput = z.infer<typeof inflationInputSchema>;
export const inflationDefaults: InflationInput = { amount: 100_000, years: 20, inflationPct: 6 };

export interface InflationRow {
  year: number;
  futureCost: number;
  purchasingPower: number;
}
export interface InflationResult {
  /** what it will cost in the future to buy what `amount` buys today */
  futureCost: number;
  /** what `amount` will be worth in today's money after the years */
  purchasingPower: number;
  /** share of buying power lost, in percent */
  powerLostPct: number;
  yearly: InflationRow[];
}

export function calculateInflation(input: InflationInput): InflationResult {
  const f = input.inflationPct / 100;
  const yearly: InflationRow[] = [];
  for (let y = 1; y <= Math.ceil(input.years); y++) {
    yearly.push({
      year: y,
      futureCost: input.amount * Math.pow(1 + f, y),
      purchasingPower: input.amount / Math.pow(1 + f, y),
    });
  }
  const futureCost = input.amount * Math.pow(1 + f, input.years);
  const purchasingPower = input.amount / Math.pow(1 + f, input.years);
  return { futureCost, purchasingPower, powerLostPct: (1 - purchasingPower / input.amount) * 100, yearly };
}
