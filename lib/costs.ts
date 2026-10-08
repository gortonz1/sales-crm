import {
  readSageConfig,
  sageGetAll,
  SageAuthError,
  type SageConfig,
} from "@/lib/sage";
import {
  costAccounts,
  monthKeys,
  monthRange,
  summariseCosts,
  type CostTally,
  type MonthCosts,
  type SageLedgerAccount,
  type SageLedgerEntry,
} from "@/lib/sage-costs";
import {
  getSageAccess,
  SageUnreadableError,
  type SageConnection,
} from "@/lib/sage-connection";

export type CostStats =
  | { status: "unconfigured" }
  | { status: "disconnected"; reason?: string }
  | { status: "error"; message: string; connection: SageConnection }
  | {
      status: "ok";
      connection: SageConnection;
      months: MonthCosts[];
      byAccount: CostTally[];
      total: number;
      monthlyAverage: number;
      lastMonth: { month: string; total: number; changePct: number | null };
      truncated: boolean;
      generatedAt: string;
    };

const MONTHS = 12;
const CACHE_MS = 60 * 60 * 1000;

let cache: { key: string; at: number; value: CostStats } | null = null;

export function clearCostsCache() {
  cache = null;
}

export async function getCostStats(
  session: string,
  {
    now = new Date(),
    config = readSageConfig(),
  }: { now?: Date; config?: SageConfig | null } = {},
): Promise<CostStats> {
  if (!config) return { status: "unconfigured" };

  let access: Awaited<ReturnType<typeof getSageAccess>>;
  try {
    access = await getSageAccess(session, config);
  } catch (err) {
    if (err instanceof SageAuthError) {
      return {
        status: "disconnected",
        reason:
          "Sage ended the connection, which happens after a month without use. Reconnect to carry on.",
      };
    }
    if (err instanceof SageUnreadableError) {
      return {
        status: "disconnected",
        reason:
          "The saved Sage login can't be read, usually because SAGE_CLIENT_SECRET changed. Reconnect to carry on.",
      };
    }
    return {
      status: "disconnected",
      reason: err instanceof Error ? err.message : String(err),
    };
  }
  if (access.status !== "connected") return { status: "disconnected" };

  const { connection, accessToken } = access;
  const { fromDate, toDate } = monthRange(now, MONTHS);
  const key = `${connection.businessId}:${connection.connectedAt}:${fromDate}:${toDate}`;
  if (cache && cache.key === key && Date.now() - cache.at < CACHE_MS) {
    return cache.value;
  }

  try {
    const opts = { businessId: connection.businessId };
    const [accounts, entries] = await Promise.all([
      sageGetAll<SageLedgerAccount>(
        accessToken,
        "ledger_accounts",
        { attributes: "displayed_as,name,ledger_account_type" },
        opts,
      ),
      sageGetAll<SageLedgerEntry>(
        accessToken,
        "ledger_entries",
        {
          from_date: fromDate,
          to_date: toDate,
          attributes: "date,debit,credit,ledger_account",
        },
        opts,
      ),
    ]);

    const months = monthKeys(now, MONTHS);
    const summary = summariseCosts(
      entries.items,
      costAccounts(accounts.items),
      months,
    );

    const complete = summary.months.slice(0, -1);
    const monthlyAverage = complete.length
      ? Math.round(
          (complete.reduce((s, m) => s + m.total, 0) / complete.length) * 100,
        ) / 100
      : 0;
    const last = complete[complete.length - 1];
    const prior = complete[complete.length - 2];
    const changePct =
      last && prior && prior.total > 0
        ? Math.round(((last.total - prior.total) / prior.total) * 100)
        : null;

    const value: CostStats = {
      status: "ok",
      connection,
      months: summary.months,
      byAccount: summary.byAccount,
      total: summary.total,
      monthlyAverage,
      lastMonth: {
        month: last?.month ?? months[0],
        total: last?.total ?? 0,
        changePct,
      },
      truncated: accounts.truncated || entries.truncated,
      generatedAt: new Date().toISOString(),
    };
    cache = { key, at: Date.now(), value };
    return value;
  } catch (err) {
    console.error("Sage costs failed", err);
    return {
      status: "error",
      message: err instanceof Error ? err.message : String(err),
      connection,
    };
  }
}
