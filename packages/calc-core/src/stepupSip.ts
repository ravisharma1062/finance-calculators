import { calculateSip, sipDefaults, sipInputSchema, type SipInput, type SipResult } from './sip';

export const stepupSipInputSchema = sipInputSchema;
export type StepupSipInput = SipInput;
export const stepupSipDefaults: StepupSipInput = { ...sipDefaults, stepUpPct: 10 };

export interface StepupSipResult extends SipResult {
  /** same plan without the yearly step-up */
  flatFutureValue: number;
  flatInvested: number;
  /** extra wealth from stepping up the SIP */
  extraFromStepUp: number;
}

export function calculateStepupSip(input: StepupSipInput): StepupSipResult {
  const main = calculateSip(input);
  const flat = calculateSip({ ...input, stepUpPct: 0 });
  return {
    ...main,
    flatFutureValue: flat.futureValue,
    flatInvested: flat.invested,
    extraFromStepUp: main.futureValue - flat.futureValue,
  };
}
