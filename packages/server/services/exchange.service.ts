// packages/server/services/exchange.service.ts
const ratesToILS: Record<string, number> = {
   USD: 3.75,
   EUR: 4.05,
   GBP: 4.7,
   ILS: 1,
};

export function getExchangeRate(from: string, to: string = 'ILS'): string {
   const f = from.toUpperCase();
   const t = to.toUpperCase();

   const fromToIls = ratesToILS[f];
   const toToIls = ratesToILS[t];

   if (!fromToIls || !toToIls) {
      return `I don't have a rate for ${f} or ${t}.`;
   }

   // convert: from -> ILS -> to
   const rate = fromToIls / toToIls;

   return `Official ${f} rate is ${rate.toFixed(4)} ${t}.`;
}
