"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  MONTHS,
  applyWhatIf,
  gbp,
  sum,
  zeros,
  type Adjusted,
  type Plan,
  type Report,
} from "@/lib/earnings";
import ApprenticeTable from "./apprentice-table";
import EarningsChart, { type MonthTotals } from "./earnings-chart";
import Gateway from "./gateway";
import MonthBreakdown from "./month-breakdown";
import MonthlyTotals from "./monthly-totals";
import Planner from "./planner";
import RunOff from "./run-off";
import { AgeBands, ContractedValue } from "./value-split";

function toggleIn(record: Record<string, number>, ref: string, month: number) {
  const next = { ...record };
  if (next[ref] === month) delete next[ref];
  else next[ref] = month;
  return next;
}

export default function EarningsDashboard({
  report,
  plan,
  setPlan,
  masked,
}: {
  report: Report;
  plan: Plan;
  setPlan: Dispatch<SetStateAction<Plan>>;
  masked: boolean;
}) {
  const rows = report.rows;
  const [selected, setSelected] = useState<number | null>(null);
  const { early, epa, lag, programmes } = plan;
  const setter =
    <K extends keyof Plan>(key: K) =>
    (update: SetStateAction<Plan[K]>) =>
      setPlan((current) => ({
        ...current,
        [key]:
          typeof update === "function"
            ? (update as (value: Plan[K]) => Plan[K])(current[key])
            : update,
      }));
  const setEarly = setter("early");
  const setEpa = setter("epa");
  const setLag = setter("lag");
  const setProgrammes = setter("programmes");

  const adjusted = useMemo<Adjusted[]>(
    () =>
      rows.map((row) => ({
        ...row,
        ...applyWhatIf(row, early[row.ref], epa[row.ref]),
        fin: early[row.ref] ?? null,
      })),
    [rows, early, epa],
  );

  const gateway = useMemo(
    () =>
      adjusted
        .filter((row) => row.gateway)
        .sort(
          (a, b) =>
            (a.offMonth ?? 0) - (b.offMonth ?? 0) || b.element - a.element,
        ),
    [adjusted],
  );

  const intake = useMemo(() => {
    const income = zeros();
    const heads = zeros();
    for (const programme of programmes) {
      programme.starts.forEach((count, start) => {
        if (!count) return;
        for (let i = start; i < Math.min(12, start + programme.months); i++) {
          income[i] += programme.monthly * count;
          heads[i] += count;
        }
      });
    }
    return { income, heads };
  }, [programmes]);

  const k = useMemo(() => {
    const total = (pick: (row: Adjusted) => number) =>
      adjusted.reduce((acc, row) => acc + pick(row), 0);
    const monthly: MonthTotals[] = MONTHS.map((_, i) => {
      const onp = total((row) => row.instM[i] + row.otherM[i]);
      const comp = total((row) => row.lumpM[i]);
      const inc = total((row) => row.incM[i]);
      return {
        onp,
        comp,
        inc,
        plan: intake.income[i],
        learners:
          adjusted.filter((row) => row.instM[i] > 0).length + intake.heads[i],
        total: onp + comp + inc + intake.income[i],
      };
    });
    const active = adjusted.filter((row) => row.active);
    const waiting = active.filter((row) => row.total === 0);
    return {
      monthly,
      waiting,
      finishes: adjusted.filter((row) => row.fin != null).length,
      epas: adjusted.filter((row) => row.mode === "epa").length,
      provider: total((row) => row.total),
      priceEarned: total(
        (row) => sum(row.instM) + sum(row.lumpM) - (row.estRelease || 0),
      ),
      onp: total((row) => sum(row.instM) + sum(row.otherM)),
      comp: total((row) => sum(row.lumpM)),
      inc: total((row) => sum(row.incM)),
      ls: total((row) => sum(row.ls)),
      em: total((row) => sum(row.em) + sum(row.emb)),
      emp: total((row) => sum(row.emp)),
      pulledFin: total((row) => (row.mode === "finish" ? row.pulled : 0)),
      pulledEpa: total((row) => (row.mode === "epa" ? row.pulled : 0)),
      remaining: active.reduce((acc, row) => acc + row.rem, 0),
      completionElement: active.reduce((acc, row) => acc + row.cel, 0),
      waitingValue: waiting.reduce((acc, row) => acc + row.rem, 0),
      teens: adjusted.filter((row) => row.band === "16-18").length,
      maxCell: Math.max(1, ...adjusted.map((row) => row.baseMax)),
      lumpCount: adjusted.filter((row) => sum(row.lumpM) > 0).length,
    };
  }, [adjusted, intake]);

  const planTotal = sum(intake.income);
  const planHeads = programmes.reduce((acc, p) => acc + sum(p.starts), 0);
  const grand = k.provider + planTotal;

  const strip = useMemo(
    () =>
      adjusted
        .filter((row) => row.active || row.gateway || row.total > 0)
        .sort((a, b) => b.baseLast - a.baseLast || b.baseTotal - a.baseTotal),
    [adjusted],
  );

  const tiles = [
    { label: "On-programme", value: gbp(k.onp), detail: "monthly instalments" },
    {
      label: "Completion and balancing",
      value: gbp(k.comp),
      detail:
        k.finishes || k.pulledEpa
          ? [
              k.finishes ? `${k.finishes} early finishes` : null,
              k.pulledEpa ? `${k.epas} EPAs scheduled` : null,
            ]
              .filter(Boolean)
              .join(", ")
          : `${k.lumpCount} completing in-year`,
    },
    {
      label: "16-18 incentives",
      value: gbp(k.inc),
      detail: `${k.teens} apprentices aged 16-18`,
    },
    {
      label: "Funded in August",
      value: `${k.monthly[0].learners} of ${adjusted.length + intake.heads[0]}`,
      detail: `${gateway.filter((row) => row.offProgramme).length} already at gateway`,
    },
    {
      label: "Still to earn from 1 Aug",
      value: gbp(k.remaining),
      detail: "current cohort's contracted value",
    },
  ];

  const select = (month: number) =>
    setSelected((current) => (current === month ? null : month));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <span className="eyebrow-style text-subtle text-[11px] leading-[1.4]">
          Apps indicative earnings · funding year {report.year} · generated{" "}
          {report.generated}
        </span>
        <span className="text-[40px] leading-none font-medium tracking-[-0.02em] tabular-nums">
          {gbp(grand)}
        </span>
        <p className="caption-style text-subtle leading-[1.4]">
          {planHeads > 0
            ? `${gbp(k.provider)} from ${adjusted.length} apprentices on the report, ${gbp(planTotal)} from ${planHeads} planned starts`
            : `Forecast provider income across ${adjusted.length} apprentices on ${report.standard}`}
        </p>
      </div>

      <ul className="grid grid-cols-1 gap-3 min-[30em]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        {tiles.map((tile) => (
          <li
            key={tile.label}
            className="border-line-strong bg-card flex flex-col gap-2 rounded-xl border p-4"
          >
            <h2 className="caption-style text-subtle font-medium">
              {tile.label}
            </h2>
            <span className="text-[28px] leading-none font-medium tabular-nums">
              {tile.value}
            </span>
            <span className="caption-style text-subtle">{tile.detail}</span>
          </li>
        ))}
      </ul>

      <EarningsChart
        monthly={k.monthly}
        selected={selected}
        onSelect={select}
      />

      <MonthlyTotals
        monthly={k.monthly}
        selected={selected}
        onSelect={select}
      />

      {selected != null && (
        <MonthBreakdown
          month={selected}
          rows={adjusted}
          programmes={programmes}
          masked={masked}
          onClose={() => setSelected(null)}
        />
      )}

      <Planner
        programmes={programmes}
        setProgrammes={setProgrammes}
        inYear={planTotal}
      />

      <RunOff
        strip={strip}
        maxCell={k.maxCell}
        masked={masked}
        finishes={k.finishes}
        pulled={k.pulledFin}
        julyLearners={k.monthly[11].learners}
        nextYear={report.nextYear}
        onToggle={(ref, month) =>
          setEarly((current) => toggleIn(current, ref, month))
        }
        onClear={() => setEarly({})}
      />

      <Gateway
        list={gateway}
        epa={epa}
        setEpa={setEpa}
        masked={masked}
        lag={lag}
        setLag={setLag}
      />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ContractedValue
          year={report.year}
          remaining={k.remaining}
          earned={k.priceEarned}
          completionElement={k.completionElement}
          pulledEpa={k.pulledEpa}
          waiting={k.waiting.length}
          waitingValue={k.waitingValue}
        />
        <AgeBands
          rows={adjusted}
          provider={k.provider}
          learningSupport={k.ls}
          englishMaths={k.em}
          employer={k.emp}
        />
      </div>

      <ApprenticeTable
        rows={adjusted}
        epa={epa}
        masked={masked}
        year={report.year}
        fileName={report.fileName}
      />
    </div>
  );
}
