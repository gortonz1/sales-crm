import type { CostPlan } from "@/lib/cost-forecast";

export const MONTHS = [
  "August",
  "September",
  "October",
  "November",
  "December",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
];
export const SHORT_MONTHS = MONTHS.map((month) => month.slice(0, 3));
export const COMPLETION_SHARE = 0.2;
export const DEFAULT_COMPLETION = 2200;

export const EARNINGS_SERIES = [
  { key: "onp", label: "On-programme", color: "#4c8df6" },
  { key: "comp", label: "Completion and balancing", color: "#9d7cf0" },
  { key: "inc", label: "16-18 incentive", color: "#eab308" },
  { key: "plan", label: "New starts", color: "#d95926" },
] as const;

export type SeriesKey = (typeof EARNINGS_SERIES)[number]["key"];
export const seriesColor = (key: SeriesKey) =>
  EARNINGS_SERIES.find((series) => series.key === key)!.color;

const STANDARDS: Record<string, string> = { "737": "Multi-channel marketer" };
const STATUS: Record<string, string> = {
  "1": "In learning",
  "2": "Complete",
  "3": "Withdrawn",
  "6": "Break",
};
const OUTCOME: Record<string, string> = {
  "1": "Achieved",
  "2": "Partial",
  "3": "No achievement",
  "8": "N/A",
};

type Months = number[];

type Episode = {
  ref: string;
  fn: string;
  sn: string;
  band: "16-18" | "19+" | "—";
  active: boolean;
  st: string;
  oc: string;
  start: string;
  pend: string;
  aend: string;
  std: string;
  price: number;
  rem: number;
  cel: number;
  inst: number;
  rs: boolean;
  peStart: number;
  onp: Months;
  bal: Months;
  comp: Months;
  ls: Months;
  em: Months;
  emb: Months;
  inc: Months;
  emp: Months;
};

const EPISODE_SERIES = [
  "onp",
  "bal",
  "comp",
  "ls",
  "em",
  "emb",
  "inc",
  "emp",
] as const;

export type Apprentice = Episode & {
  instM: Months;
  lumpM: Months;
  otherM: Months;
  provM: Months;
  baseTotal: number;
  basePrice: number;
  baseComp: number;
  baseMax: number;
  baseLast: number;
  startTs: number;
  pendTs: number;
  offMonth: number | null;
  offProgramme: boolean;
  elementEst: boolean;
  element: number;
  headroom: number;
  gateway: boolean;
};

export type Report = {
  rows: Apprentice[];
  fileName: string;
  generated: string;
  year: string;
  nextYear: string;
  standardShort: string;
  standard: string;
  typicalPrice: number;
  typicalMonths: number;
};

export type WhatIf = {
  instM: Months;
  lumpM: Months;
  otherM: Months;
  incM: Months;
  provM: Months;
  total: number;
  pulled: number;
  mode: "finish" | "epa" | null;
  estRelease: number;
};

export type Adjusted = Apprentice & WhatIf & { fin: number | null };

export type Programme = {
  id: string;
  name: string;
  monthly: number;
  months: number;
  starts: number[];
};

const currency = [0, 2].map(
  (digits) =>
    new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }),
);

export const gbp = (value: number, decimals: 0 | 2 = 0) =>
  currency[decimals ? 1 : 0].format(value || 0);

export const num = (value: unknown) => {
  const parsed = parseFloat(String(value ?? "").replace(/,/g, ""));
  return isFinite(parsed) ? parsed : 0;
};

export const zeros = () => Array<number>(12).fill(0);
export const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

export const apprenticeName = (row: Apprentice, masked: boolean) =>
  masked
    ? `${(row.fn[0] || "?").toUpperCase()}${(row.sn[0] || "?").toUpperCase()} · ${row.ref}`
    : `${row.fn} ${row.sn}`;

const toTimestamp = (date: unknown) => {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(date || "").trim());
  return match ? Date.UTC(+match[3], +match[2] - 1, +match[1]) : 0;
};

const median = (values: number[]) => {
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
};

export function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char !== '"') cell += char;
      else if (text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((cells) => cells.some((value) => value.trim() !== ""));
}

export function buildReport(
  text: string,
  fileName: string,
  lastModified: number,
): Report {
  const [fields, ...rawRows] = parseCsv(text);
  if (!rawRows.length) {
    throw new Error(
      "That file has no rows in it. Check the export finished before you saved it.",
    );
  }

  const columns = new Map<string, number>();
  fields.forEach((field, index) => {
    const name = field.replace(/^﻿/, "").trim();
    if (!columns.has(name)) columns.set(name, index);
  });
  const get = (row: string[], name: string) => {
    const index = columns.get(name);
    return index === undefined ? "" : String(row[index] ?? "").trim();
  };

  if (
    !columns.has("August on programme earnings") ||
    !columns.has("Learning aim reference")
  ) {
    throw new Error(
      "This doesn't look like an Apps Indicative Earnings Report — the monthly earnings columns are missing. Export the report again from the funding reports area and upload the CSV unchanged.",
    );
  }

  const programmeRows = rawRows.filter(
    (row) => get(row, "Learning aim reference") === "ZPROG001",
  );
  if (!programmeRows.length) {
    throw new Error(
      "No programme aims found in this file. The report needs its ZPROG001 rows, so check the export wasn't filtered or edited before saving.",
    );
  }

  const series = (row: string[], suffix: string) =>
    MONTHS.map((month) => num(get(row, `${month} ${suffix}`)));

  const byRef = new Map<string, Episode>();
  for (const row of programmeRows) {
    const ref = get(row, "Learner reference number");
    const fundingLine = get(row, "Funding line type");
    const episode: Episode = {
      ref,
      fn: get(row, "Given names"),
      sn: get(row, "Family name"),
      band: fundingLine.startsWith("16-18")
        ? "16-18"
        : fundingLine
          ? "19+"
          : "—",
      active: !!fundingLine,
      st: STATUS[get(row, "Completion status")] || "—",
      oc: OUTCOME[get(row, "Outcome")] || "—",
      start: get(row, "Learning start date"),
      pend: get(row, "Learning planned end date"),
      aend: get(row, "Learning actual end date"),
      std: get(row, "Standard code"),
      price: num(get(row, "Total price applicable to this episode")),
      rem: num(
        get(
          row,
          "Price amount remaining (with upper limit applied) at start of this episode",
        ),
      ),
      cel: num(get(row, "Completion element (potential or actual earnings)")),
      inst: num(get(row, "Planned number of on programme instalments for aim")),
      rs:
        get(
          row,
          "Learning delivery funding and monitoring type - restart indicator",
        ) === "1",
      peStart: toTimestamp(get(row, "Price episode start date")),
      onp: series(row, "on programme earnings"),
      bal: series(row, "balancing payment earnings"),
      comp: series(row, "aim completion earnings"),
      ls: series(row, "learning support earnings"),
      em: series(row, "English and maths on programme earnings"),
      emb: series(row, "English and maths balancing payment earnings"),
      inc: series(row, "16-18 additional payments for providers"),
      emp: series(row, "additional payments for employers"),
    };

    const previous = byRef.get(ref);
    if (!previous) {
      byRef.set(ref, episode);
      continue;
    }
    for (const key of EPISODE_SERIES) {
      previous[key] = previous[key].map((value, i) => value + episode[key][i]);
    }
    if (episode.peStart >= previous.peStart) {
      Object.assign(previous, {
        band: episode.band,
        active: previous.active || episode.active,
        st: episode.st,
        oc: episode.oc,
        pend: episode.pend,
        aend: episode.aend,
        price: episode.price,
        rem: episode.rem,
        cel: episode.cel,
        inst: episode.inst,
        rs: previous.rs || episode.rs,
        peStart: episode.peStart,
      });
    }
  }

  const stamp = /(\d{4})(\d{2})(\d{2})-\d{6}/.exec(fileName);
  const generated = stamp
    ? new Date(Date.UTC(+stamp[1], +stamp[2] - 1, +stamp[3]))
    : new Date(lastModified || Date.now());
  const year = generated.getUTCFullYear();
  const fundingYear = generated.getUTCMonth() >= 7 ? year : year - 1;
  const monthIndex = (time: number) => {
    if (!time) return null;
    const date = new Date(time);
    const index =
      (date.getUTCFullYear() - fundingYear) * 12 + date.getUTCMonth() - 7;
    return index > 11 ? null : Math.max(0, index);
  };

  const rows: Apprentice[] = [...byRef.values()].map((episode) => {
    const instM = episode.onp.slice();
    const lumpM = MONTHS.map((_, i) => episode.bal[i] + episode.comp[i]);
    const otherM = MONTHS.map(
      (_, i) => episode.ls[i] + episode.em[i] + episode.emb[i],
    );
    const provM = MONTHS.map(
      (_, i) => instM[i] + lumpM[i] + otherM[i] + episode.inc[i],
    );
    const basePrice = sum(instM) + sum(lumpM);
    const baseComp = sum(episode.comp);
    const offMonth = monthIndex(
      toTimestamp(episode.aend) || toTimestamp(episode.pend),
    );
    const offProgramme = !!episode.aend;
    return {
      ...episode,
      instM,
      lumpM,
      otherM,
      provM,
      baseTotal: sum(provM),
      basePrice,
      baseComp,
      baseMax: Math.max(0, ...provM),
      baseLast: provM.reduce((last, value, i) => (value > 0 ? i : last), -1),
      startTs: toTimestamp(episode.start),
      pendTs: toTimestamp(episode.aend || episode.pend),
      offMonth,
      offProgramme,
      elementEst: !(episode.cel > 0),
      element: episode.cel > 0 ? episode.cel : DEFAULT_COMPLETION,
      headroom:
        episode.rem > 0
          ? Math.max(0, episode.rem - basePrice)
          : DEFAULT_COMPLETION,
      gateway:
        baseComp === 0 &&
        offMonth != null &&
        (episode.st === "In learning" || episode.st === "Complete") &&
        (episode.active ? episode.cel > 0 : offProgramme),
    };
  });

  const live = rows.filter((row) => row.active);
  const prices = live.map((row) => row.price).filter((value) => value > 0);
  const instalments = live.map((row) => row.inst).filter((value) => value > 0);
  const codes = [...new Set(rows.map((row) => row.std).filter(Boolean))];
  const single = codes.length === 1 ? codes[0] : null;

  return {
    rows,
    fileName,
    generated: generated.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }),
    year: `${fundingYear}/${String(fundingYear + 1).slice(2)}`,
    nextYear: `${fundingYear + 1}/${String(fundingYear + 2).slice(2)}`,
    standardShort: single
      ? STANDARDS[single] || `Standard ${single}`
      : "Current cohort",
    standard: single
      ? STANDARDS[single]
        ? `${STANDARDS[single]} (standard ${single})`
        : `standard ${single}`
      : `${codes.length} standards`,
    typicalPrice: prices.length ? Math.round(median(prices) / 50) * 50 : 11000,
    typicalMonths: instalments.length ? Math.round(median(instalments)) : 12,
  };
}

export function applyWhatIf(
  row: Apprentice,
  finish: number | undefined,
  epa: number | undefined,
): WhatIf {
  if (finish != null) {
    const instM = zeros();
    const lumpM = zeros();
    const otherM = zeros();
    const incM = zeros();
    let earned = 0;
    for (let i = 0; i < finish; i++) {
      instM[i] = row.instM[i];
      lumpM[i] = row.lumpM[i];
      otherM[i] = row.otherM[i];
      incM[i] = row.inc[i];
      earned += row.instM[i] + row.lumpM[i];
    }
    const left = Math.max(
      0,
      (row.rem > 0 ? row.rem : DEFAULT_COMPLETION) - earned,
    );
    instM[finish] = Math.min(row.instM[finish], left);
    lumpM[finish] = left - instM[finish];
    otherM[finish] = row.otherM[finish];
    incM[finish] = row.inc[finish];
    const provM = MONTHS.map(
      (_, i) => instM[i] + lumpM[i] + otherM[i] + incM[i],
    );
    const total = sum(provM);
    return {
      instM,
      lumpM,
      otherM,
      incM,
      provM,
      total,
      pulled: total - row.baseTotal,
      mode: "finish",
      estRelease: row.rem > 0 ? 0 : lumpM[finish],
    };
  }

  if (epa != null) {
    const release = Math.min(row.element, row.headroom);
    if (release > 0) {
      const lumpM = row.lumpM.slice();
      lumpM[epa] += release;
      const provM = MONTHS.map(
        (_, i) => row.instM[i] + lumpM[i] + row.otherM[i] + row.inc[i],
      );
      return {
        instM: row.instM,
        lumpM,
        otherM: row.otherM,
        incM: row.inc,
        provM,
        total: row.baseTotal + release,
        pulled: release,
        mode: "epa",
        estRelease: row.elementEst ? release : 0,
      };
    }
  }

  return {
    instM: row.instM,
    lumpM: row.lumpM,
    otherM: row.otherM,
    incM: row.inc,
    provM: row.provM,
    total: row.baseTotal,
    pulled: 0,
    mode: null,
    estRelease: 0,
  };
}

export const programmeMonthsInYear = (programme: Programme) =>
  programme.starts.reduce(
    (total, count, start) =>
      total +
      count *
        programme.monthly *
        Math.max(0, Math.min(12 - start, programme.months)),
    0,
  );

export type Plan = {
  year: string;
  programmes: Programme[];
  early: Record<string, number>;
  epa: Record<string, number>;
  lag: number;
  costs?: CostPlan;
};

export type SavedWorkspace = {
  report: Report;
  plan: Plan;
  savedAt: string;
  savedBy: string | null;
};

export const defaultPlan = (report: Report): Plan => ({
  year: report.year,
  programmes: [
    {
      id: "p1",
      name: report.standardShort,
      monthly: Math.round(
        (report.typicalPrice * (1 - COMPLETION_SHARE)) / report.typicalMonths,
      ),
      months: report.typicalMonths,
      starts: zeros(),
    },
    {
      id: "p2",
      name: "AI in Marketing",
      monthly: 950,
      months: 12,
      starts: zeros(),
    },
  ],
  early: {},
  epa: {},
  lag: 2,
});

export function carryPlan(plan: Plan, report: Report): Plan {
  if (plan.year !== report.year) {
    return plan.costs
      ? { ...defaultPlan(report), costs: plan.costs }
      : defaultPlan(report);
  }
  const rows = new Map(report.rows.map((row) => [row.ref, row]));
  const keep = (
    record: Record<string, number>,
    allowed: (row: Apprentice, month: number) => boolean,
  ) =>
    Object.fromEntries(
      Object.entries(record).filter(([ref, month]) => {
        const row = rows.get(ref);
        return row != null && allowed(row, month);
      }),
    );
  return {
    ...plan,
    early: keep(plan.early, () => true),
    epa: keep(
      plan.epa,
      (row, month) =>
        row.gateway && row.offMonth != null && month >= row.offMonth,
    ),
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function readWorkspace(value: unknown): SavedWorkspace | null {
  if (!isRecord(value)) return null;
  const { report, plan, saved_at, saved_by } = value;
  if (
    !isRecord(report) ||
    !Array.isArray(report.rows) ||
    typeof report.year !== "string" ||
    !isRecord(plan) ||
    !Array.isArray(plan.programmes)
  ) {
    return null;
  }
  return {
    report: report as unknown as Report,
    plan: plan as unknown as Plan,
    savedAt: String(saved_at),
    savedBy: typeof saved_by === "string" ? saved_by : null,
  };
}
