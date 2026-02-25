// packages/server/services/tools/utils/numbers.ts

/**
 * Extract a numeric value from a string/number result.
 * We prefer the LAST numeric token (robust for "1 USD = 3.67 ILS", "$1,999", etc.)
 */
export function extractNumericValue(
   result: string | number | null
): number | null {
   if (result === null) return null;
   if (typeof result === 'number') return result;

   const normalized = String(result).replace(/,/g, '');
   const matches = normalized.match(/[\d.]+/g);
   if (!matches || matches.length === 0) return null;

   for (let i = matches.length - 1; i >= 0; i--) {
      const n = parseFloat(matches[i]!);
      if (!isNaN(n)) return n;
   }
   return null;
}

/**
 * Extract exchange rate robustly from typical strings like:
 * "1 USD = 3.67 ILS", "USD/ILS: 3.67", "3.67"
 * Prefers the value after "=" if present.
 */
export function extractExchangeRateValue(
   result: string | number | null
): number | null {
   if (result === null) return null;
   if (typeof result === 'number') return result;

   const text = String(result).replace(/,/g, '');

   const eqMatch = text.match(/=\s*([\d.]+)/);
   if (eqMatch?.[1]) {
      const n = parseFloat(eqMatch[1]);
      if (!isNaN(n)) return n;
   }

   return extractNumericValue(text);
}
