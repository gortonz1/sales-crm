import type { CostGroup, MonthCosts } from "@/lib/sage-costs";

export type CostMode = "recurring" | "oneoff" | "fixed";

export type CostOverride = { mode: CostMode; amount?: number };

export type CostPlan = { overrides: Record<string, CostOverride> };

export const RECENT_MONTHS = 3;
export const RECURRING_WINDOW = 4;
export const RECURRING_MIN = 3;

export type CategoryForecast = {
  label: string;
  group: CostGroup;
  activeMonths: number;
  completeMonths: number;
  recentAverage: number;
  detected: "recurring" | "oneoff";
  mode: CostMode;
  overridden: boolean;
  monthly: number;
};

export type PnlMonth = {
  key: string;
  income: number;
  cost: number;
  profit: number;
  basis: "actual" | "forecast";
};

const round2 = (value: number) => Math.round(value * 100) / 100;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function readCostPlan(value: unknown): CostPlan {
  const overrides: Record<string, CostOverride> = {};
  if (!isRecord(value) || !isRecord(value.overrides)) return { overrides };
  for (const [label, raw] of Object.entries(value.overrides)) {
    if (!isRecord(raw)) continue;
    if (raw.mode === "recurring" || raw.mode === "oneoff") {
      overrides[label] = { mode: raw.mode };
    } else if (raw.mode === "fixed") {
      const amount = Number(raw.amount);
      overrides[label] = {
        mode: "fixed",
        amount: Number.isFinite(amount) ? Math.max(0, amount) : 0,
      };
    }
  }
  return { overrides };
}

export function forecastCategories(
  months: MonthCosts[],
  plan: CostPlan | undefined,
): CategoryForecast[] {
  const complete = months.slice(0, -1);
  const groups = new Map<string, CostGroup>();
  for (const month of months) {
    for (const tally of month.byAccount) groups.set(tally.label, tally.group);
  }
  const overrides = plan?.overrides ?? {};
  for (const label of Object.keys(overrides)) {
    if (!groups.has(label)) groups.set(label, "overheads");
  }

  const forecasts = [...groups.entries()].map(([label, group]) => {
    const series = complete.map(
      (month) => month.byAccount.find((t) => t.label === label)?.amount ?? 0,
    );
    const recent = series.slice(-RECENT_MONTHS);
    const recentAverage = recent.length
      ? round2(recent.reduce((sum, value) => sum + value, 0) / recent.length)
      : 0;
    const detected: CategoryForecast["detected"] =
      series.slice(-RECURRING_WINDOW).filter((value) => value > 0).length >=
      RECURRING_MIN
        ? "recurring"
        : "oneoff";
    const override = overrides[label];
    const mode = override?.mode ?? detected;
    const monthly =
      mode === "fixed"
        ? round2(Math.max(0, override?.amount ?? 0))
        : mode === "recurring"
          ? Math.max(0, recentAverage)
          : 0;
    return {
      label,
      group,
      activeMonths: series.filter((value) => value !== 0).length,
      completeMonths: complete.length,
      recentAverage,
      detected,
      mode,
      overridden: Boolean(override),
      monthly,
    };
  });

  return forecasts.sort(
    (a, b) => b.monthly - a.monthly || b.recentAverage - a.recentAverage,
  );
}

export function fundingYearMonths(year: string): string[] {
  const start = parseInt(year, 10);
  if (!Number.isFinite(start)) return [];
  return Array.from({ length: 12 }, (_, i) =>
    new Date(Date.UTC(start, 7 + i, 1)).toISOString().slice(0, 7),
  );
}

export function forecastPnl({
  year,
  income,
  months,
  categories,
  now = new Date(),
}: {
  year: string;
  income: number[];
  months: MonthCosts[];
  categories: CategoryForecast[];
  now?: Date;
}): PnlMonth[] {
  const current = now.toISOString().slice(0, 7);
  const actuals = new Map(
    months.filter((m) => m.month < current).map((m) => [m.month, m.total]),
  );
  const forecastCost = round2(
    categories.reduce((sum, category) => sum + category.monthly, 0),
  );

  return fundingYearMonths(year).map((key, i) => {
    const actual = actuals.get(key);
    const cost = actual ?? forecastCost;
    const monthIncome = income[i] ?? 0;
    return {
      key,
      income: monthIncome,
      cost,
      profit: round2(monthIncome - cost),
      basis: actual === undefined ? "forecast" : "actual",
    };
  });
}
