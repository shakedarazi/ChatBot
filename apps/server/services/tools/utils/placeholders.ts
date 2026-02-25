// packages/server/services/tools/utils/placeholders.ts
import type { ResultStore } from '../../../schemas/plan.schema';
import { extractNumericValue } from './numbers';

/**
 * Resolve placeholders like <result_from_tool_1> in parameters
 * If referenced tool missing/failed -> "ERROR"
 */
export function resolvePlaceholders(
   params: Record<string, any>,
   resultStore: ResultStore
): Record<string, any> {
   const resolved = { ...params };
   for (const [key, value] of Object.entries(resolved)) {
      if (typeof value === 'string') {
         resolved[key] = value.replace(
            /<result_from_tool_(\d+)>/g,
            (_, idx) => {
               const r = resultStore.get(parseInt(idx));
               if (!r || !r.success) return 'ERROR';
               const raw = r.result;

               if (key === 'expression') {
                  const n = extractNumericValue(raw as any);
                  if (n !== null) return String(n);
               }

               return String(raw);
            }
         );
      }
   }
   return resolved;
}

export function containsErrorToken(obj: any): boolean {
   try {
      return JSON.stringify(obj).includes('ERROR');
   } catch {
      return true;
   }
}
