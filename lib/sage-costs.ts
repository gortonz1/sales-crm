const DIRECT_TYPES = new Set(["DIRECT_EXPENSES", "COST_OF_SALES"]);
const OVERHEAD_TYPES = new Set([
  "OVERHEADS",
  "DEPRECIATION",
  "EXPENSES",
  "EXPENSE",
]);

export type SageLedgerAccount = {
  id: string;
  displayed_as?: string | null;
  name?: string | null;
  ledger_account_type?: { id?: string | null } | null;
};

export type SageLedgerEntry = {
  date?: string | null;
  debit?: number | string | null;
  credit?: number | string | null;
  ledger_account?: { id?: string | null } | null;
};

export type CostGroup = "direct" | "overheads";

export type CostAccount = { id: string; label: string; group: CostGroup };

export type CostTally = { label: string; amount: number; group: CostGroup };

export type MonthCosts = {
  month: string;
  total: number;
  direct: number;
  overheads: number;
  byAccount: CostTally[];
};

export type CostSummary = {
  months: MonthCosts[];
  byAccount: CostTally[];
  total: number;
};

export function costAccounts(
  accounts: SageLedgerAccount[],
): Map<string, CostAccount> {
  const map = new Map<string, CostAccount>();
  for (const account of accounts) {
    const type = account.ledger_account_type?.id?.toUpperCase() ?? "";
    const group: CostGroup | null = DIRECT_TYPES.has(type)
      ? "direct"
      : OVERHEAD_TYPES.has(type)
        ? "overheads"
        : null;
    if (!group || !account.id) continue;
    const label =
      account.displayed_as?.trim() || account.name?.trim() || account.id;
    map.set(account.id, { id: account.id, label, group });
  }
  return map;
}

export function monthKeys(now: Date, count: number): string[] {
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1),
    );
    keys.push(d.toISOString().slice(0, 7));
  }
  return keys;
}

export function monthRange(
  now: Date,
  count: number,
): { fromDate: string; toDate: string } {
  const [first] = monthKeys(now, count);
  return { fromDate: `${first}-01`, toDate: now.toISOString().slice(0, 10) };
}

function pence(value: number | string | null | undefined): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function sortedTallies(
  totals: Map<string, number>,
  groups: Map<string, CostGroup>,
): CostTally[] {
  return [...totals.entries()]
    .filter(([, p]) => p !== 0)
    .sort((a, b) => b[1] - a[1])
    .map(([label, p]) => ({
      label,
      amount: p / 100,
      group: groups.get(label) ?? "overheads",
    }));
}

export function summariseCosts(
  entries: SageLedgerEntry[],
  accounts: Map<string, CostAccount>,
  months: string[],
): CostSummary {
  const perMonth = new Map(
    months.map((m) => [
      m,
      { direct: 0, overheads: 0, byAccount: new Map<string, number>() },
    ]),
  );
  const overall = new Map<string, number>();
  const groups = new Map<string, CostGroup>();

  for (const entry of entries) {
    const account = entry.ledger_account?.id
      ? accounts.get(entry.ledger_account.id)
      : undefined;
    const bucket = entry.date
      ? perMonth.get(entry.date.slice(0, 7))
      : undefined;
    if (!account || !bucket) continue;

    const amount = pence(entry.debit) - pence(entry.credit);
    groups.set(account.label, account.group);
    bucket[account.group] += amount;
    bucket.byAccount.set(
      account.label,
      (bucket.byAccount.get(account.label) ?? 0) + amount,
    );
    overall.set(account.label, (overall.get(account.label) ?? 0) + amount);
  }

  const result = months.map((month) => {
    const b = perMonth.get(month)!;
    return {
      month,
      total: (b.direct + b.overheads) / 100,
      direct: b.direct / 100,
      overheads: b.overheads / 100,
      byAccount: sortedTallies(b.byAccount, groups),
    };
  });

  const totalPence = result.reduce(
    (sum, m) => sum + Math.round(m.total * 100),
    0,
  );
  return {
    months: result,
    byAccount: sortedTallies(overall, groups),
    total: totalPence / 100,
  };
}
