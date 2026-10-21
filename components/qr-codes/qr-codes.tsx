"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Button from "@/components/_ui/button";
import QrCodeDetail from "./qr-code-detail";
import QrCodeDialog, { type QrCodeFields } from "./qr-code-dialog";
import QrImage from "./qr-image";
import { formatDate } from "@/lib/leads";
import {
  EMPTY_TOTALS,
  QR_DOMAIN_PINNED,
  qrBaseUrl,
  qrLink,
  totalsById,
  type QrCode,
  type QrTotals,
} from "@/lib/qr-codes";
import { createClient } from "@/lib/supabase/client";
import { useCompaniesStore } from "@/stores/companies-store";
import MenuIcon from "@/public/assets/images/_common/menu.svg";
import PlusIcon from "@/public/assets/images/_common/plus.svg";

const subscribeNever = () => () => {};

export default function QrCodes({
  initialCodes,
  initialTotals,
  stageLabels,
}: {
  initialCodes: QrCode[];
  initialTotals: Record<string, QrTotals>;
  stageLabels: Record<string, string>;
}) {
  const setSidebarOpen = useCompaniesStore((state) => state.setSidebarOpen);
  const base = useSyncExternalStore(subscribeNever, qrBaseUrl, () =>
    (process.env.NEXT_PUBLIC_QR_BASE_URL ?? "").replace(/\/+$/, ""),
  );
  const [codes, setCodes] = useState(initialCodes);
  const [totals, setTotals] = useState(initialTotals);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<QrCode | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = codes.find((code) => code.id === selectedId) ?? null;
  const takenSlugs = useMemo(
    () => new Set(codes.map((code) => code.slug)),
    [codes],
  );
  const scanTotal = codes.reduce(
    (sum, code) => sum + (totals[code.id]?.scans ?? 0),
    0,
  );

  async function refreshTotals() {
    const { data, error } = await createClient().rpc("qr_code_totals");
    if (error) {
      setError(`Couldn't refresh the scan counts: ${error.message}`);
      return;
    }
    setTotals(totalsById(data ?? []));
  }

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(code: QrCode) {
    setEditing(code);
    setDialogOpen(true);
  }

  async function save(fields: QrCodeFields) {
    const supabase = createClient();
    setError(null);
    if (editing) {
      const { data, error } = await supabase
        .from("qr_codes")
        .update({
          name: fields.name,
          destination: fields.destination,
          tag_links: fields.tag_links,
        })
        .eq("id", editing.id)
        .select()
        .single();
      if (error || !data)
        return `Couldn't save the changes: ${error?.message ?? "no response"}`;
      setCodes((current) =>
        current.map((code) => (code.id === data.id ? data : code)),
      );
      return null;
    }
    const { data, error } = await supabase
      .from("qr_codes")
      .insert(fields)
      .select()
      .single();
    if (error?.code === "23505")
      return "Another QR code already uses this short link. Pick a different one.";
    if (error || !data)
      return `Couldn't create the QR code: ${error?.message ?? "no response"}`;
    setCodes((current) => [data, ...current]);
    setSelectedId(data.id);
    return null;
  }

  async function remove(code: QrCode) {
    const { data, error } = await createClient()
      .from("qr_codes")
      .delete()
      .eq("id", code.id)
      .select("id");
    if (error) return `Couldn't delete ${code.name}: ${error.message}`;
    if (!data?.length) return "This QR code has already been deleted.";
    setSelectedId(null);
    setCodes((current) => current.filter((item) => item.id !== code.id));
    return null;
  }

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="border-border shrink-0 border-b">
        <div className="flex items-center justify-between gap-2 px-4 py-[14px]">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              variant="secondary"
              size="icon"
              className="lg:hidden"
              aria-label="Open navigation"
              onClick={() => setSidebarOpen(true)}
            >
              <MenuIcon aria-hidden className="size-3.5" />
            </Button>
            <h1 className="truncate">QR codes</h1>
            {codes.length > 0 && (
              <span className="caption-style bg-muted border-pill hidden shrink-0 rounded-full border px-2 py-[3px] sm:inline">
                {codes.length} {codes.length === 1 ? "code" : "codes"} ·{" "}
                {scanTotal} {scanTotal === 1 ? "scan" : "scans"}
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {codes.length > 0 && (
              <Button variant="ghost" size="sm" onClick={refreshTotals}>
                Refresh
              </Button>
            )}
            <Button variant="primary" size="sm" onClick={openCreate}>
              <PlusIcon aria-hidden className="size-3" />
              New QR code
            </Button>
          </div>
        </div>
      </header>

      {error && (
        <p
          role="alert"
          className="caption-style text-danger border-border shrink-0 border-b px-4 py-2"
        >
          {error}
        </p>
      )}

      {!QR_DOMAIN_PINNED && (
        <p className="caption-style text-soft border-border shrink-0 border-b px-4 py-2 leading-[1.4]">
          Codes point at{" "}
          <span className="text-foreground">
            {base.replace(/^https?:\/\//, "") || "this site's current address"}
          </span>
          , which changes if the CRM moves host. Before printing, point a domain
          you own at the CRM and set NEXT_PUBLIC_QR_BASE_URL to it.
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-auto p-4">
        {codes.length === 0 ? (
          <div className="flex h-full items-center justify-center py-16">
            <div className="flex max-w-[30em] flex-col items-center gap-3 text-center">
              <p className="lead-style font-medium">No QR codes yet</p>
              <p className="text-soft">
                Make one for a flyer, a stand or a slide. Every scan is counted,
                and website enquiries from people who scanned it are linked to
                the code in Website leads.
              </p>
              <Button variant="primary" size="sm" onClick={openCreate}>
                <PlusIcon aria-hidden className="size-3" />
                New QR code
              </Button>
            </div>
          </div>
        ) : (
          <ul className="mx-auto grid max-w-[72em] gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {codes.map((code) => {
              const stats = totals[code.id] ?? EMPTY_TOTALS;
              return (
                <li key={code.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(code.id)}
                    className="border-line-strong bg-card hover:bg-overlay/4 focus-visible:ring-ring/60 flex w-full cursor-pointer gap-3 rounded-xl border p-3 text-left transition-colors duration-150 outline-none focus-visible:ring-2"
                  >
                    <QrImage
                      text={qrLink(code.slug, base)}
                      label={`QR code for ${code.name}`}
                      className="w-[5.5em] shrink-0"
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-2 py-0.5">
                      <div className="flex min-w-0 flex-col gap-1">
                        <span className="truncate font-medium">
                          {code.name}
                        </span>
                        <span className="caption-style text-subtle truncate">
                          {code.destination.replace(/^https?:\/\/(www\.)?/, "")}
                        </span>
                      </div>
                      <dl className="mt-auto grid grid-cols-3 gap-2">
                        <Count label="Scans" value={stats.scans} />
                        <Count label="People" value={stats.visitors} />
                        <Count label="Enquiries" value={stats.leads} />
                      </dl>
                      <span className="caption-style text-faint truncate">
                        {stats.last_scan_at
                          ? `Last scan ${formatDate(stats.last_scan_at)}`
                          : `Created ${formatDate(code.created_at)}, not scanned yet`}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <QrCodeDetail
        code={selected}
        totals={(selected && totals[selected.id]) || EMPTY_TOTALS}
        base={base}
        stageLabels={stageLabels}
        onClose={() => setSelectedId(null)}
        onEdit={openEdit}
        onDelete={remove}
      />
      <QrCodeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        code={editing}
        takenSlugs={takenSlugs}
        onSave={save}
      />
    </section>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="caption-style text-subtle">{label}</dt>
      <dd className="text-[16px] leading-none font-semibold tabular-nums">
        {value}
      </dd>
    </div>
  );
}
