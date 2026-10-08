"use client";

import { use, type Dispatch, type SetStateAction } from "react";
import Button from "@/components/_ui/button";
import { Input } from "@/components/_ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/_ui/select";
import {
  forecastCategories,
  forecastPnl,
  RECENT_MONTHS,
  RECURRING_MIN,
  RECURRING_WINDOW,
  type CategoryForecast,
  type CostMode,
  type CostPlan,
  type PnlMonth,
} from "@/lib/cost-forecast";
import type { CostStats } from "@/lib/costs";
import { MONTHS, SHORT_MONTHS, gbp, num } from "@/lib/earnings";
import { cn } from "@/lib/utils";
import { Footnote, Panel, numberInputClass } from "./panel";

type Choice = "auto" | CostMode;

const CHOICE_LABEL: Record<Choice, string> = {
  auto: "Automatic",
  recurring: "Recurring",
  oneoff: "One-off",
  fixed: "Fixed amount",
};

export default function ForecastPnl({
  costs,
  income,
  year,
  plan,
  setPlan,
}: {
  costs: Promise<CostStats>;
  income: number[];
  year: string;
  plan: CostPlan | undefined;
  setPlan: Dispatch<SetStateAction<CostPlan>>;
}) {
  const stats = use(costs);

  if (stats.status !== "ok") {
    return (
      <Panel
        title="Forecast profit and loss"
        description="Connect Sage in the Costs section at the bottom of this page to forecast costs against this income."
      >
        {null}
      </Panel>
    );
  }

  const categories = forecastCategories(stats.months, plan);
  const pnl = forecastPnl({ year, income, months: stats.months, categories });

  return (
    <>
      <PnlTable pnl={pnl} />
      <RecurringCosts categories={categories} setPlan={setPlan} />
    </>
  );
}

function PnlTable({ pnl }: { pnl: PnlMonth[] }) {
  const income = pnl.reduce((sum, month) => sum + month.income, 0);
  const cost = pnl.reduce((sum, month) => sum + month.cost, 0);
  const profit = income - cost;
  const margin = income > 0 ? Math.round((profit / income) * 100) : null;
  const actualMonths = pnl.filter((month) => month.basis === "actual").length;
  const cumulative = pnl.map((_, i) =>
    pnl.slice(0, i + 1).reduce((sum, month) => sum + month.profit, 0),
  );
  const lowest = pnl.reduce<{ month: number; value: number } | null>(
    (low, _, i) =>
      cumulative[i] < 0 && (!low || cumulative[i] < low.value)
        ? { month: i, value: cumulative[i] }
        : low,
    null,
  );

  const rows: {
    label: string;
    values: number[];
    year: number;
    strong?: boolean;
    signed?: boolean;
  }[] = [
    { label: "Income", values: pnl.map((m) => m.income), year: income },
    { label: "Costs", values: pnl.map((m) => m.cost), year: cost },
    {
      label: "Profit",
      values: pnl.map((m) => m.profit),
      year: profit,
      strong: true,
      signed: true,
    },
    {
      label: "Cumulative",
      values: cumulative,
      year: profit,
      signed: true,
    },
  ];

  return (
    <Panel
      title="Forecast profit and loss"
      description={`Income from the forecast above, less costs. ${
        actualMonths
          ? `The first ${actualMonths === 1 ? "month uses its actual" : `${actualMonths} months use their actual`} costs from Sage; the rest`
          : "Every month"
      } use the recurring costs below.`}
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span
          className={cn(
            "text-[28px] leading-none font-medium tabular-nums",
            profit < 0 && "text-(--tag-red-text)",
          )}
        >
          {gbp(profit)}
        </span>
        <span className="caption-style text-subtle">
          {margin === null
            ? "forecast profit for the year"
            : `forecast profit for the year, a ${margin}% margin`}
          {lowest &&
            ` · cash dips to ${gbp(lowest.value)} by ${MONTHS[lowest.month]}`}
        </span>
      </div>

      <div className="-mx-4 overflow-x-auto px-4">
        <table className="caption-style w-full min-w-[64em] text-left tabular-nums">
          <thead>
            <tr className="text-subtle">
              <th className="py-1.5 pr-3 font-normal">
                <span className="sr-only">Profit and loss</span>
              </th>
              {pnl.map((month, i) => (
                <th
                  key={month.key}
                  className="px-2 py-1.5 text-right font-normal"
                >
                  <span className="flex flex-col items-end gap-0.5">
                    {SHORT_MONTHS[i]}
                    <span className="text-faint text-[10px] leading-none">
                      {month.basis === "actual" ? "actual" : "forecast"}
                    </span>
                  </span>
                </th>
              ))}
              <th className="py-1.5 pl-2 text-right font-normal">Year</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-line-strong border-t">
                <td className="text-soft py-1.5 pr-3 whitespace-nowrap">
                  {row.label}
                </td>
                {row.values.map((value, i) => (
                  <td
                    key={pnl[i].key}
                    className={cn(
                      "px-2 py-1.5 text-right",
                      row.strong && "font-medium",
                      row.signed && value < 0
                        ? "text-(--tag-red-text)"
                        : row.label === "Costs" && pnl[i].basis === "forecast"
                          ? "text-soft"
                          : "text-foreground",
                    )}
                  >
                    {gbp(value)}
                  </td>
                ))}
                <td
                  className={cn(
                    "py-1.5 pl-2 text-right",
                    row.strong && "font-medium",
                    row.signed && row.year < 0 && "text-(--tag-red-text)",
                  )}
                >
                  {row.label === "Cumulative" ? "" : gbp(row.year)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function RecurringCosts({
  categories,
  setPlan,
}: {
  categories: CategoryForecast[];
  setPlan: Dispatch<SetStateAction<CostPlan>>;
}) {
  const total = categories.reduce((sum, c) => sum + c.monthly, 0);
  const overridden = categories.filter((c) => c.overridden).length;

  const choose = (category: CategoryForecast, choice: Choice) =>
    setPlan((current) => {
      const overrides = { ...current.overrides };
      if (choice === "auto") delete overrides[category.label];
      else if (choice === "fixed") {
        overrides[category.label] = {
          mode: "fixed",
          amount: Math.round(category.monthly || category.recentAverage),
        };
      } else overrides[category.label] = { mode: choice };
      return { overrides };
    });

  const setAmount = (category: CategoryForecast, amount: number) =>
    setPlan((current) => ({
      overrides: {
        ...current.overrides,
        [category.label]: { mode: "fixed", amount: Math.max(0, amount) },
      },
    }));

  return (
    <Panel
      title="Recurring costs"
      description={`A category counts as recurring when it had costs in at least ${RECURRING_MIN} of the last ${RECURRING_WINDOW} complete months, and is forecast at its average over the last ${RECENT_MONTHS}. Change how any category is treated; it saves with the rest of the plan.`}
      actions={
        overridden > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPlan({ overrides: {} })}
          >
            Reset {overridden === 1 ? "1 change" : `${overridden} changes`}
          </Button>
        )
      }
    >
      {categories.length === 0 ? (
        <p className="caption-style text-subtle">
          No costs posted in Sage in the last 12 months.
        </p>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4">
          <table className="caption-style w-full min-w-[46em] text-left tabular-nums">
            <thead>
              <tr className="text-subtle">
                <th className="py-1.5 pr-3 font-normal">Category</th>
                <th className="px-2 py-1.5 text-right font-normal">
                  Months with costs
                </th>
                <th className="px-2 py-1.5 text-right font-normal">
                  Last {RECENT_MONTHS} months avg
                </th>
                <th className="px-2 py-1.5 font-normal">Treat as</th>
                <th className="py-1.5 pl-2 text-right font-normal">
                  Forecast a month
                </th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => {
                const choice: Choice = category.overridden
                  ? category.mode
                  : "auto";
                return (
                  <tr
                    key={category.label}
                    className="border-line-strong border-t"
                  >
                    <td className="py-1.5 pr-3">
                      <span className="flex flex-col gap-0.5">
                        <span className="text-foreground">
                          {category.label}
                        </span>
                        <span className="text-faint">
                          {category.group === "direct"
                            ? "Direct cost"
                            : "Overhead"}
                        </span>
                      </span>
                    </td>
                    <td className="text-soft px-2 py-1.5 text-right">
                      {category.activeMonths} of {category.completeMonths}
                    </td>
                    <td className="text-soft px-2 py-1.5 text-right">
                      {gbp(category.recentAverage)}
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-2">
                        <Select
                          value={choice}
                          onValueChange={(value) =>
                            choose(category, value as Choice)
                          }
                        >
                          <SelectTrigger
                            aria-label={`Treat ${category.label} as`}
                            className="w-[11em]"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="auto">
                              Automatic ·{" "}
                              {category.detected === "recurring"
                                ? "recurring"
                                : "one-off"}
                            </SelectItem>
                            <SelectItem value="recurring">
                              {CHOICE_LABEL.recurring}
                            </SelectItem>
                            <SelectItem value="oneoff">
                              {CHOICE_LABEL.oneoff}
                            </SelectItem>
                            <SelectItem value="fixed">
                              {CHOICE_LABEL.fixed}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        {category.mode === "fixed" && (
                          <Input
                            type="number"
                            min={0}
                            step={10}
                            aria-label={`${category.label} a month`}
                            className={cn(numberInputClass, "w-[7em]")}
                            value={category.monthly}
                            onChange={(event) =>
                              setAmount(category, num(event.target.value))
                            }
                          />
                        )}
                      </div>
                    </td>
                    <td
                      className={cn(
                        "py-1.5 pl-2 text-right",
                        category.monthly ? "text-foreground" : "text-faint",
                      )}
                    >
                      {category.monthly ? gbp(category.monthly) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Footnote>
        Forecast running costs: {gbp(total)} a month, {gbp(total * 12)} a year.
      </Footnote>
    </Panel>
  );
}
