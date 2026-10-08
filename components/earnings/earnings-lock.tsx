"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { unlockEarnings } from "@/app/(app)/earnings/actions";
import Button from "@/components/_ui/button";
import { Input } from "@/components/_ui/input";
import EarningsShell from "./shell";

export default function EarningsLock() {
  const router = useRouter();
  const [attempt, setAttempt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await unlockEarnings(attempt);
      if (result.error) {
        setError(result.error);
        setAttempt("");
        return;
      }
      router.refresh();
    });
  }

  return (
    <EarningsShell>
      <div className="flex flex-1 items-center justify-center py-10">
        <form
          onSubmit={submit}
          className="border-line-strong bg-card flex w-full max-w-[24em] flex-col gap-4 rounded-xl border p-5"
        >
          <div className="flex flex-col gap-2">
            <h2>Earnings are password protected</h2>
            <p className="caption-style text-subtle leading-[1.4]">
              Enter the earnings password to open the dashboard. It stays
              unlocked on this device for 12 hours, or until you lock it.
            </p>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="caption-style text-subtle">Password</span>
            <Input
              type="password"
              autoComplete="current-password"
              autoFocus
              value={attempt}
              onChange={(event) => setAttempt(event.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "earnings-lock-error" : undefined}
            />
          </label>
          {error && (
            <p
              id="earnings-lock-error"
              role="alert"
              className="caption-style leading-[1.4] text-(--tag-red-text)"
            >
              {error}
            </p>
          )}
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={pending || !attempt}
            className="text-[14px]"
          >
            {pending ? "Checking…" : "Unlock"}
          </Button>
        </form>
      </div>
    </EarningsShell>
  );
}
