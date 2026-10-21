"use client";

import { Fragment, useEffect, useState, type ReactNode } from "react";
import Button from "@/components/_ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/_ui/dialog";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/_ui/sheet";
import StageTag from "@/components/leads/stage-tag";
import QrImage, { downloadPng, downloadSvg } from "./qr-image";
import { formatDate, formatDateTime } from "@/lib/leads";
import {
  DEVICE_LABELS,
  REPORT_DAYS,
  countryName,
  qrLink,
  type QrBreakdown,
  type QrCode,
  type QrReport,
  type QrTotals,
} from "@/lib/qr-codes";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import XIcon from "@/public/assets/images/companies/detail/x.svg";

type AttributedLead = {
  id: string;
  name: string;
  organisation: string | null;
  stage: string;
  submitted_at: string;
};

const PLOT_HEIGHT = 120;

const shortDay = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

export default function QrCodeDetail({
  code,
  totals,
  base,
  stageLabels,
  onClose,
  onEdit,
  onDelete,
}: {
  code: QrCode | null;
  totals: QrTotals;
  base: string;
  stageLabels: Record<string, string>;
  onClose: () => void;
  onEdit: (code: QrCode) => void;
  onDelete: (code: QrCode) => Promise<string | null>;
}) {
  return (
    <Sheet open={code !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-[34em]">
        {code && (
          <QrCodeDetailBody
            key={code.id}
            code={code}
            totals={totals}
            base={base}
            stageLabels={stageLabels}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function QrCodeDetailBody({
  code,
  totals,
  base,
  stageLabels,
  onEdit,
  onDelete,
}: {
  code: QrCode;
  totals: QrTotals;
  base: string;
  stageLabels: Record<string, string>;
  onEdit: (code: QrCode) => void;
  onDelete: (code: QrCode) => Promise<string | null>;
}) {
  const [report, setReport] = useState<QrReport | null>(null);
  const [leads, setLeads] = useState<AttributedLead[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const link = qrLink(code.slug, base);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    Promise.all([
      supabase.rpc("qr_code_report", { code: code.id, days: REPORT_DAYS }),
      supabase
        .from("leads")
        .select("id, name, organisation, stage, submitted_at")
        .eq("qr_code_id", code.id)
        .order("submitted_at", { ascending: false }),
    ]).then(([reportResult, leadsResult]) => {
      if (cancelled) return;
      const error = reportResult.error ?? leadsResult.error;
      if (error) setLoadError(error.message);
      setReport((reportResult.data as QrReport | null) ?? null);
      setLeads(leadsResult.data ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [code.id, totals.scans, totals.leads]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  const rate =
    totals.visitors > 0
      ? `${Math.round((totals.leads / totals.visitors) * 1000) / 10}%`
      : "—";

  return (
    <>
      <SheetHeader>
        <div className="flex min-w-0 flex-col gap-0.5">
          <SheetTitle className="truncate">{code.name}</SheetTitle>
          <SheetDescription className="truncate">
            {link.replace(/^https?:\/\//, "")}
          </SheetDescription>
        </div>
        <SheetClose asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="-mr-1"
            aria-label="Close QR code"
          >
            <XIcon aria-hidden className="text-foreground size-4" />
          </Button>
        </SheetClose>
      </SheetHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <QrImage
            text={link}
            label={`QR code for ${code.name}`}
            className="border-line-strong w-full max-w-[12em] shrink-0 border"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => downloadPng(link, code.slug)}
              >
                Download PNG
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => downloadSvg(link, code.slug)}
              >
                Download SVG
              </Button>
              <Button variant="secondary" size="sm" onClick={copyLink}>
                {copied ? "Copied" : "Copy link"}
              </Button>
            </div>
            <p className="caption-style text-subtle leading-[1.4]">
              Use the SVG for print, as it stays sharp at any size. Print it at
              least 2 cm across and test a scan before a big print run.
            </p>
            <dl className="grid grid-cols-[6.5em_1fr] gap-x-3 gap-y-2 text-[14px]">
              <Row label="Sends to">
                <a
                  href={code.destination}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-soft [overflow-wrap:anywhere] underline underline-offset-2"
                >
                  {code.destination
                    .replace(/^https?:\/\/(www\.)?/, "")
                    .split("/")
                    .map((part, index) => (
                      <Fragment key={index}>
                        {index > 0 && (
                          <>
                            /<wbr />
                          </>
                        )}
                        {part}
                      </Fragment>
                    ))}
                </a>
              </Row>
              <Row label="Enquiries">
                {code.tag_links ? "Linked to this code" : "Not tagged"}
              </Row>
              <Row label="Created">{formatDate(code.created_at)}</Row>
            </dl>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Scans" value={totals.scans} />
          <Stat label="People" value={totals.visitors} />
          <Stat label="Enquiries" value={totals.leads} />
          <Stat label="Enquiry rate" value={rate} />
        </section>

        {loadError && (
          <p role="alert" className="caption-style text-danger">
            Couldn&apos;t load the scan report: {loadError}
          </p>
        )}

        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="caption-style text-subtle font-medium">
              Scans over the last {REPORT_DAYS} days
            </h2>
            {totals.last_scan_at && (
              <span className="caption-style text-faint">
                Last scan {formatDateTime(totals.last_scan_at)}
              </span>
            )}
          </div>
          {report === null ? (
            <p className="caption-style text-subtle">Loading…</p>
          ) : (
            <DailyChart daily={report.daily} />
          )}
        </section>

        {report && totals.scans > 0 && (
          <section className="grid gap-4 sm:grid-cols-2">
            <Breakdown
              title="Device"
              items={report.devices.map((item) => ({
                ...item,
                label: DEVICE_LABELS[item.label] ?? item.label,
              }))}
              total={totals.scans}
            />
            <Breakdown
              title="System"
              items={report.systems}
              total={totals.scans}
            />
            {report.countries.length > 0 && (
              <Breakdown
                title="Country"
                items={report.countries.map((item) => ({
                  ...item,
                  label: countryName(item.label),
                }))}
                total={totals.scans}
              />
            )}
          </section>
        )}

        <section className="flex flex-col gap-3">
          <h2 className="caption-style text-subtle font-medium">
            Enquiries from this code
          </h2>
          {leads === null ? (
            <p className="caption-style text-subtle">Loading…</p>
          ) : leads.length === 0 ? (
            <p className="text-soft text-[14px] leading-[1.5]">
              None yet. Website enquiries made after a scan land here on their
              own, and you can link any lead to this code from its sheet in
              Website leads.
            </p>
          ) : (
            <ul className="border-line-strong divide-line-strong flex flex-col divide-y rounded-lg border">
              {leads.map((lead) => (
                <li
                  key={lead.id}
                  className="flex items-center justify-between gap-3 px-3 py-2.5"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="truncate text-[14px] leading-none font-medium">
                      {lead.name}
                    </span>
                    <span className="caption-style text-subtle truncate">
                      {lead.organisation ?? "No organisation"} ·{" "}
                      {formatDate(lead.submitted_at)}
                    </span>
                  </div>
                  <StageTag
                    stage={lead.stage}
                    label={stageLabels[lead.stage] ?? lead.stage}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="secondary" size="sm" onClick={() => onEdit(code)}>
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-danger hover:text-danger -mr-2"
            onClick={() => {
              setDeleteError(null);
              setConfirmingDelete(true);
            }}
          >
            Delete QR code
          </Button>
        </div>
      </div>

      <Dialog
        open={confirmingDelete}
        onOpenChange={(open) => !open && setConfirmingDelete(false)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {code.name}?</DialogTitle>
            <DialogDescription>
              Printed copies will stop working and show a &ldquo;not in
              use&rdquo; page. Its scan history goes too. Leads stay, but lose
              the link to this code. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <p role="alert" className="caption-style text-danger px-6 pt-4">
              {deleteError}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmingDelete(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={deleting}
              onClick={async () => {
                setDeleting(true);
                const message = await onDelete(code);
                setDeleting(false);
                setDeleteError(message);
              }}
            >
              Delete QR code
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="border-line-strong bg-card flex flex-col gap-2 rounded-lg border px-3 py-2.5">
      <span className="caption-style text-subtle">{label}</span>
      <span className="text-[20px] leading-none font-semibold tabular-nums">
        {value}
      </span>
    </div>
  );
}

function DailyChart({ daily }: { daily: QrReport["daily"] }) {
  const max = Math.max(1, ...daily.map((day) => day.scans));
  const total = daily.reduce((sum, day) => sum + day.scans, 0);
  if (total === 0)
    return (
      <p className="text-soft text-[14px] leading-[1.5]">
        No scans in the last {REPORT_DAYS} days.
      </p>
    );
  const first = daily[0];
  const last = daily[daily.length - 1];
  return (
    <div className="flex flex-col gap-1.5">
      <ol
        className="flex items-end gap-px"
        style={{ height: PLOT_HEIGHT }}
        aria-label={`${total} scans over the last ${REPORT_DAYS} days`}
      >
        {daily.map((day) => {
          const label = `${shortDay.format(new Date(`${day.day}T00:00:00Z`))}: ${day.scans} ${day.scans === 1 ? "scan" : "scans"}`;
          return (
            <li
              key={day.day}
              title={label}
              className="flex h-full min-w-0 flex-1 items-end"
            >
              <span className="sr-only">{label}</span>
              <span
                aria-hidden
                className={cn(
                  "w-full rounded-t-[2px]",
                  day.scans > 0 ? "bg-trend" : "bg-overlay/[0.06]",
                )}
                style={{
                  height:
                    day.scans > 0
                      ? Math.max(3, (day.scans / max) * PLOT_HEIGHT)
                      : 2,
                }}
              />
            </li>
          );
        })}
      </ol>
      <div className="caption-style text-faint flex justify-between">
        <span>{shortDay.format(new Date(`${first.day}T00:00:00Z`))}</span>
        <span>Peak {max} a day</span>
        <span>{shortDay.format(new Date(`${last.day}T00:00:00Z`))}</span>
      </div>
    </div>
  );
}

function Breakdown({
  title,
  items,
  total,
}: {
  title: string;
  items: QrBreakdown[];
  total: number;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <h3 className="caption-style text-subtle font-medium">{title}</h3>
      <ul className="flex flex-col gap-2">
        {items.map((item) => {
          const share = Math.round((item.scans / total) * 100);
          return (
            <li key={item.label} className="flex flex-col gap-1">
              <div className="flex justify-between gap-2 text-[14px] leading-none">
                <span className="truncate">{item.label}</span>
                <span className="text-soft tabular-nums">
                  {item.scans} · {share}%
                </span>
              </div>
              <span className="bg-overlay/[0.06] block h-1.5 overflow-hidden rounded-full">
                <span
                  className="bg-trend block h-full rounded-full"
                  style={{ width: `${share}%` }}
                />
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-subtle">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </>
  );
}
