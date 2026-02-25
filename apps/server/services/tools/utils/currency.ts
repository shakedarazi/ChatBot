// packages/server/services/tools/utils/currency.ts

export function upper3(x: any): string | null {
   if (typeof x !== 'string') return null;
   const v = x.trim().toUpperCase();
   return /^[A-Z]{3}$/.test(v) ? v : null;
}
