import type { Values } from '@/calculators/types';

/**
 * Scenario storage. Version 1 keeps scenarios in this browser (localStorage).
 * Later this can call an API (for example Supabase) without changing the pages.
 */
export interface Scenario {
  id: string;
  calcId: string;
  inputs: Values;
  savedAt: string;
}

const KEY = 'fincalc:scenarios:v1';

function readAll(): Scenario[] {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as Scenario[]) : [];
  } catch {
    return [];
  }
}

function writeAll(list: Scenario[]): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(list));
  } catch {
    // storage may be full or blocked: saving is optional, so ignore
  }
}

export function saveScenario(calcId: string, inputs: Values): Scenario {
  const scenario: Scenario = {
    id: `${calcId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    calcId,
    inputs,
    savedAt: new Date().toISOString(),
  };
  writeAll([scenario, ...readAll()].slice(0, 50));
  return scenario;
}

export function loadScenario(id: string): Scenario | null {
  return readAll().find((s) => s.id === id) ?? null;
}

export function listScenarios(calcId?: string): Scenario[] {
  const all = readAll();
  return calcId ? all.filter((s) => s.calcId === calcId) : all;
}

export function deleteScenario(id: string): void {
  writeAll(readAll().filter((s) => s.id !== id));
}
