import {
  EARNINGS_SERIES,
  MONTHS,
  adjustRows,
  planIntake,
  type Adjusted,
  type Apprentice,
  type Report,
  type SeriesKey,
  type Snapshot,
} from "@/lib/earnings";

export type ComparedLearner = {
  ref: string;
  row: Apprentice;
  forecast: number;
  actual: number;
  reason: string;
};

export type ComparedSeries = {
  key: SeriesKey;
  label: string;
  forecast: number;
  actual: number;
};

export type Comparison = {
  forecast: Adjusted[];
  actual: Apprentice[];
  income: number[];
  monthly: { forecast: number; actual: number }[];
};

export function compare(snapshot: Snapshot, report: Report): Comparison {
  const forecast = adjustRows(
    snapshot.report.rows,
    snapshot.early,
    snapshot.epa,
  );
  const { income } = planIntake(snapshot.programmes);
  return {
    forecast,
    actual: report.rows,
    income,
    monthly: MONTHS.map((_, i) => ({
      forecast:
        forecast.reduce((total, row) => total + row.provM[i], 0) + income[i],
      actual: report.rows.reduce((total, row) => total + row.provM[i], 0),
    })),
  };
}

const parts = (row: Apprentice | Adjusted | undefined, month: number) => {
  if (!row) return { onp: 0, comp: 0, inc: 0 };
  const inc = "incM" in row ? row.incM[month] : row.inc[month];
  return {
    onp: row.instM[month] + row.otherM[month],
    comp: row.lumpM[month],
    inc,
  };
};

function reason(
  before: Adjusted,
  after: Apprentice | undefined,
  month: number,
) {
  if (!after) return "Not on the latest report";
  const then = parts(before, month);
  const now = parts(after, month);
  const down = now.onp + now.comp + now.inc < then.onp + then.comp + then.inc;
  if (down && after.st === "Withdrawn") return "Withdrawn";
  if (down && after.st === "Break") return "Break in learning";

  const gaps = {
    onp: now.onp - then.onp,
    comp: now.comp - then.comp,
    inc: now.inc - then.inc,
  };
  const biggest = (Object.keys(gaps) as (keyof typeof gaps)[]).reduce(
    (best, key) => (Math.abs(gaps[key]) > Math.abs(gaps[best]) ? key : best),
  );

  if (biggest === "comp") {
    if (then.comp > 0 && now.comp === 0) {
      if (before.fin === month) return "Early finish not recorded yet";
      if (before.mode === "epa") return "EPA not recorded yet";
      return "Completion not recorded yet";
    }
    if (now.comp > 0 && then.comp === 0) return "Completed";
    return "Completion amount changed";
  }
  if (biggest === "inc") return "16-18 incentive changed";
  if (then.onp > 0 && now.onp === 0) {
    return after.aend && !before.aend
      ? "Went to gateway"
      : "Instalments stopped";
  }
  if (now.onp > 0 && then.onp === 0) return "Instalments started";
  return "Instalment changed";
}

export function compareMonth(comparison: Comparison, month: number) {
  const before = new Map(comparison.forecast.map((row) => [row.ref, row]));
  const after = new Map(comparison.actual.map((row) => [row.ref, row]));
  const totals: Record<SeriesKey, { forecast: number; actual: number }> = {
    onp: { forecast: 0, actual: 0 },
    comp: { forecast: 0, actual: 0 },
    inc: { forecast: 0, actual: 0 },
    plan: { forecast: comparison.income[month], actual: 0 },
  };
  const learners: ComparedLearner[] = [];

  for (const row of comparison.forecast) {
    const then = parts(row, month);
    totals.onp.forecast += then.onp;
    totals.comp.forecast += then.comp;
    totals.inc.forecast += then.inc;
    const now = after.get(row.ref);
    const actual = now ? now.provM[month] : 0;
    if (Math.abs(actual - row.provM[month]) >= 0.5) {
      learners.push({
        ref: row.ref,
        row: now ?? row,
        forecast: row.provM[month],
        actual,
        reason: reason(row, now, month),
      });
    }
  }

  for (const row of comparison.actual) {
    if (!before.has(row.ref)) {
      totals.plan.actual += row.provM[month];
      if (row.provM[month] > 0) {
        learners.push({
          ref: row.ref,
          row,
          forecast: 0,
          actual: row.provM[month],
          reason: "New on the report",
        });
      }
      continue;
    }
    const now = parts(row, month);
    totals.onp.actual += now.onp;
    totals.comp.actual += now.comp;
    totals.inc.actual += now.inc;
  }

  const series: ComparedSeries[] = EARNINGS_SERIES.map((item) => ({
    key: item.key,
    label: item.label,
    ...totals[item.key],
  }));

  learners.sort(
    (a, b) => Math.abs(b.actual - b.forecast) - Math.abs(a.actual - a.forecast),
  );

  return { series, learners };
}
