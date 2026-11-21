export const gbp = (n: number, dp = 0) =>
  (n < 0 ? '−' : '') + '£' + Math.abs(n).toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp });
export const gbpK = (n: number) => (Math.abs(n) >= 10_000 ? '£' + (n / 1000).toFixed(n >= 100_000 ? 0 : 1) + 'k' : gbp(n));
export const pct = (n: number, dp = 0) => (n * 100).toFixed(dp) + '%';
export const uid = () => crypto.randomUUID();
export const sum = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((a, x) => a + (f(x) || 0), 0);
