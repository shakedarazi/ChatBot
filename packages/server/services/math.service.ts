// packages/server/services/math.service.ts

type Token =
   | { type: 'num'; value: number }
   | { type: 'op'; value: '+' | '-' | '*' | '/' }
   | { type: 'paren'; value: '(' | ')' };

function tokenize(expr: string): Token[] {
   const s = expr.replace(/\s+/g, '');
   const tokens: Token[] = [];
   let i = 0;

   const isDigit = (c: string) => c >= '0' && c <= '9';

   while (i < s.length) {
      const c = s[i];
      if (!c) break;

      if (isDigit(c) || c === '.') {
         let j = i + 1;

         while (j < s.length) {
            const ch = s[j];
            if (!ch) break;
            if (isDigit(ch) || ch === '.') j++;
            else break;
         }

         const numStr = s.slice(i, j);
         const value = Number(numStr);
         if (!Number.isFinite(value)) throw new Error('Invalid number');

         tokens.push({ type: 'num', value });
         i = j;
         continue;
      }

      if (c === '+' || c === '-' || c === '*' || c === '/') {
         tokens.push({ type: 'op', value: c });
         i++;
         continue;
      }

      if (c === '(' || c === ')') {
         tokens.push({ type: 'paren', value: c });
         i++;
         continue;
      }

      throw new Error(`Invalid character: ${c}`);
   }

   return tokens;
}

function precedence(op: '+' | '-' | '*' | '/'): number {
   return op === '*' || op === '/' ? 2 : 1;
}

function toRpn(tokens: Token[]): Token[] {
   const output: Token[] = [];
   const stack: Token[] = [];

   for (let idx = 0; idx < tokens.length; idx++) {
      const t = tokens[idx]!;

      if (t.type === 'num') {
         output.push(t);
         continue;
      }

      if (t.type === 'op') {
         const prev = tokens[idx - 1];
         const isUnaryMinus =
            t.value === '-' &&
            (!prev ||
               prev.type === 'op' ||
               (prev.type === 'paren' && prev.value === '('));

         if (isUnaryMinus) output.push({ type: 'num', value: 0 });

         while (stack.length) {
            const top = stack[stack.length - 1]!;
            if (
               top.type === 'op' &&
               precedence(top.value) >= precedence(t.value)
            ) {
               output.push(stack.pop()!);
            } else break;
         }
         stack.push(t);
         continue;
      }

      if (t.type === 'paren' && t.value === '(') {
         stack.push(t);
         continue;
      }

      if (t.type === 'paren' && t.value === ')') {
         let foundOpen = false;
         while (stack.length) {
            const top = stack.pop()!;
            if (top.type === 'paren' && top.value === '(') {
               foundOpen = true;
               break;
            }
            output.push(top);
         }
         if (!foundOpen) throw new Error('Mismatched parentheses');
         continue;
      }
   }

   while (stack.length) {
      const top = stack.pop()!;
      if (top.type === 'paren') throw new Error('Mismatched parentheses');
      output.push(top);
   }

   return output;
}

function evalRpn(rpn: Token[]): number {
   const st: number[] = [];

   for (const t of rpn) {
      if (t.type === 'num') {
         st.push(t.value);
         continue;
      }

      if (t.type === 'op') {
         const b = st.pop();
         const a = st.pop();
         if (a === undefined || b === undefined)
            throw new Error('Bad expression');

         let v: number;
         switch (t.value) {
            case '+':
               v = a + b;
               break;
            case '-':
               v = a - b;
               break;
            case '*':
               v = a * b;
               break;
            case '/':
               if (b === 0) throw new Error('Division by zero');
               v = a / b;
               break;
         }
         st.push(v);
      }
   }

   if (st.length !== 1) throw new Error('Bad expression');
   return st[0]!;
}

export function calculateMath(expression: string): string {
   try {
      const tokens = tokenize(expression);
      const rpn = toRpn(tokens);
      const value = evalRpn(rpn);

      const rounded = Math.round(value);
      const display =
         Math.abs(value - rounded) < 1e-12 ? String(rounded) : String(value);

      return `Result: ${display}`;
   } catch (e: any) {
      return `Invalid math expression. (${e?.message ?? 'error'})`;
   }
}
