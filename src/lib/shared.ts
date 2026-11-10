// Pure rules behind the shared blocks (Gastos, Fechas, Meta de ahorro).

export type Debt = { from: string; to: string; cents: number };

// Expenses split equally between `people` → the fewest payments that
// settle it: whoever owes most pays whoever is owed most, until even.
// Spare cents go to the first people so the total always adds up.
export function settle(expenses: { paidById: string; amount: number }[], people: string[]): Debt[] {
  if (people.length === 0) return [];
  // What each paid, minus an equal share of the total (spare cents to the first people).
  const balance = new Map(people.map((p) => [p, 0]));
  let total = 0;
  for (const e of expenses) {
    balance.set(e.paidById, (balance.get(e.paidById) ?? 0) + e.amount);
    total += e.amount;
  }
  const share = Math.floor(total / people.length);
  people.forEach((p, i) => balance.set(p, balance.get(p)! - share - (i < total - share * people.length ? 1 : 0)));
  const owe = [...balance].filter(([, b]) => b < 0).map(([p, b]) => ({ p, b: -b })).sort((a, b) => b.b - a.b);
  const get = [...balance].filter(([, b]) => b > 0).map(([p, b]) => ({ p, b })).sort((a, b) => b.b - a.b);
  const out: Debt[] = [];
  let i = 0;
  let j = 0;
  while (i < owe.length && j < get.length) {
    const cents = Math.min(owe[i].b, get[j].b);
    if (cents > 0) out.push({ from: owe[i].p, to: get[j].p, cents });
    owe[i].b -= cents;
    get[j].b -= cents;
    if (owe[i].b === 0) i++;
    if (get[j].b === 0) j++;
  }
  return out;
}

// The day most people can make (earliest on a tie); null if nobody voted.
export function bestDay(options: { day: string; votes: number }[]): string | null {
  const top = [...options].sort((a, b) => b.votes - a.votes || a.day.localeCompare(b.day))[0];
  return top && top.votes > 0 ? top.day : null;
}
