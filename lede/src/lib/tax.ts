import type { TaxParams } from './types';

/** 2026/27 rates for England, Wales & Northern Ireland (thresholds frozen to April 2031). */
export const DEFAULT_TAX: TaxParams = {
  personalAllowance: 12_570,
  taperThreshold: 100_000,
  basicBand: 37_700,
  additionalThreshold: 125_140,
  basicRate: 0.2,
  higherRate: 0.4,
  additionalRate: 0.45,
  niLower: 12_570,
  niUpper: 50_270,
  niMainRate: 0.06,
  niUpperRate: 0.02,
  vatThreshold: 90_000,
};

export function personalAllowance(income: number, p: TaxParams) {
  const reduction = Math.max(0, Math.floor((income - p.taperThreshold) / 2));
  return Math.max(0, p.personalAllowance - reduction);
}

export function incomeTax(income: number, p: TaxParams) {
  const pa = personalAllowance(income, p);
  const taxable = Math.max(0, income - pa);
  const basic = Math.min(taxable, p.basicBand);
  const higher = Math.min(Math.max(taxable - p.basicBand, 0), p.additionalThreshold - p.basicBand);
  const additional = Math.max(taxable - p.additionalThreshold, 0);
  return basic * p.basicRate + higher * p.higherRate + additional * p.additionalRate;
}

export function class4(profit: number, p: TaxParams) {
  const main = Math.max(0, Math.min(profit, p.niUpper) - p.niLower);
  const upper = Math.max(0, profit - p.niUpper);
  return main * p.niMainRate + upper * p.niUpperRate;
}

export type BandKey = 'none' | 'basic' | 'higher' | 'taper' | 'additional';
export interface Band { key: BandKey; label: string; marginal: number; nextAt?: number; nextLabel?: string }

export function band(total: number, p: TaxParams): Band {
  const higherStart = p.personalAllowance + p.basicBand; // 50,270
  if (total <= p.personalAllowance)
    return { key: 'none', label: 'Within personal allowance', marginal: 0, nextAt: p.personalAllowance, nextLabel: 'basic rate' };
  if (total <= higherStart)
    return { key: 'basic', label: 'Basic rate · 20%', marginal: p.basicRate + p.niMainRate, nextAt: higherStart, nextLabel: 'higher rate' };
  if (total <= p.taperThreshold)
    return { key: 'higher', label: 'Higher rate · 40%', marginal: p.higherRate + p.niUpperRate, nextAt: p.taperThreshold, nextLabel: 'allowance taper' };
  if (total <= p.additionalThreshold)
    return { key: 'taper', label: 'Allowance taper · 60% effective', marginal: p.higherRate * 1.5 + p.niUpperRate, nextAt: p.additionalThreshold, nextLabel: 'additional rate' };
  return { key: 'additional', label: 'Additional rate · 45%', marginal: p.additionalRate + p.niUpperRate };
}

export interface TaxEstimate {
  profit: number;
  otherIncome: number;
  incomeTax: number; // attributable to self-employment
  ni: number;
  total: number;
  effectiveRate: number; // on profit
  band: Band;
}

/** Tax attributable to self-employed profit, given other (e.g. PAYE) income that uses allowance first. */
export function estimate(profit: number, otherIncome: number, p: TaxParams): TaxEstimate {
  profit = Math.max(0, profit);
  const it = incomeTax(profit + otherIncome, p) - incomeTax(otherIncome, p);
  const ni = class4(profit, p);
  const total = it + ni;
  return { profit, otherIncome, incomeTax: it, ni, total, effectiveRate: profit ? total / profit : 0, band: band(profit + otherIncome, p) };
}

/** Making Tax Digital for Income Tax: qualifying-income thresholds by start date. */
export function mtdStatus(qualifyingIncome: number) {
  if (qualifyingIncome > 50_000) return { required: true, from: 'April 2026', text: 'Over £50k — MTD for Income Tax applies from 6 April 2026: quarterly digital updates are required.' };
  if (qualifyingIncome > 30_000) return { required: true, from: 'April 2027', text: 'Over £30k — MTD for Income Tax is likely to apply from 6 April 2027. Worth choosing software now.' };
  if (qualifyingIncome > 20_000) return { required: true, from: 'April 2028', text: 'Over £20k — MTD for Income Tax is due to apply from 6 April 2028.' };
  return { required: false, from: '', text: 'Under £20k — not currently in scope for MTD for Income Tax.' };
}
