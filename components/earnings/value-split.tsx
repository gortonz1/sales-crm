import { gbp, seriesColor, type Adjusted } from "@/lib/earnings";
import { Footnote, Meter, Panel, Swatch } from "./panel";

export function ContractedValue({
  year,
  remaining,
  earned,
  completionElement,
  pulledEpa,
  waiting,
  waitingValue,
}: {
  year: string;
  remaining: number;
  earned: number;
  completionElement: number;
  pulledEpa: number;
  waiting: number;
  waitingValue: number;
}) {
  const beyond = Math.max(0, remaining - earned);
  const base = remaining || 1;
  return (
    <Panel
      title="Where the contracted value sits"
      description={`${gbp(remaining)} of negotiated price is unearned at the start of the year.`}
    >
      <div className="flex flex-col gap-3">
        <Meter
          label={`Earned in ${year}`}
          value={gbp(earned)}
          share={earned / base}
          color={seriesColor("onp")}
        />
        <Meter
          label="Falls into later years"
          value={gbp(beyond)}
          share={beyond / base}
          color={seriesColor("comp")}
        />
      </div>
      <p className="caption-style text-subtle leading-[1.4]">
        {gbp(completionElement)} of that remaining value is completion element —
        held back until each apprentice passes EPA.
        {pulledEpa > 0 &&
          ` ${gbp(pulledEpa)} of it is scheduled to land this year.`}
      </p>
      {waiting > 0 && (
        <Footnote>
          {waiting} apprentices with an open price episode earn nothing in the
          forecast, worth{" "}
          <span className="text-foreground font-medium">
            {gbp(waitingValue)}
          </span>{" "}
          between them. They have come off programme or paused, so nothing is
          modelled until an achievement date or a restart is recorded.
        </Footnote>
      )}
    </Panel>
  );
}

export function AgeBands({
  rows,
  provider,
  learningSupport,
  englishMaths,
  employer,
}: {
  rows: Adjusted[];
  provider: number;
  learningSupport: number;
  englishMaths: number;
  employer: number;
}) {
  const bands = [
    { label: "19+ apprenticeship", band: "19+", color: seriesColor("onp") },
    { label: "16-18 apprenticeship", band: "16-18", color: seriesColor("inc") },
  ].map((band) => {
    const inBand = rows.filter((row) => row.band === band.band);
    return {
      ...band,
      count: inBand.length,
      value: inBand.reduce((total, row) => total + row.total, 0),
    };
  });

  return (
    <Panel
      title="Age band split"
      description="Funding line drives both the incentive and the funding band."
    >
      <div className="flex flex-col gap-3">
        {bands.map((band) => (
          <Meter
            key={band.band}
            label={band.label}
            detail={`${band.count} apprentices`}
            value={gbp(band.value)}
            share={band.value / (provider || 1)}
            color={band.color}
          />
        ))}
      </div>
      {(learningSupport > 0 || englishMaths > 0) && (
        <p className="caption-style text-subtle leading-[1.4]">
          Includes {gbp(learningSupport)} learning support and{" "}
          {gbp(englishMaths)} English and maths earnings.
        </p>
      )}
      <Footnote>
        <div className="flex items-start gap-2">
          <Swatch color="var(--faint)" className="mt-0.5" />
          <span>
            A further{" "}
            <span className="text-foreground font-medium">{gbp(employer)}</span>{" "}
            of 16-18 incentive is payable to employers. It appears on this
            report but is not provider income, so it is excluded from every
            figure above.
          </span>
        </div>
      </Footnote>
    </Panel>
  );
}
