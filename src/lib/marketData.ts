import market from '@/data/market.json';

export interface MarketData {
  lastUpdated: string;
  source: string;
  rates: Record<string, Record<string, number>>;
}

/**
 * Market data. Version 1 reads a static file (`src/data/market.json`).
 * Later a scheduled GitHub Action or a serverless proxy can fill it; keep the fallback values.
 */
export function getMarketData(): MarketData {
  return market as MarketData;
}

export function getRate(country: string, key: string): number | undefined {
  return getMarketData().rates[country]?.[key];
}
