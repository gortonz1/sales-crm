"use client";

import { useState, type FormEvent } from "react";
import Button from "@/components/_ui/button";
import { Checkbox } from "@/components/_ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/_ui/dialog";
import Field from "@/components/_ui/field";
import { Input } from "@/components/_ui/input";
import { ALLOWED_EMAIL_DOMAIN, isAllowedEmail } from "@/lib/auth";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/client";
import { useCompaniesStore } from "@/stores/companies-store";
import MenuIcon from "@/public/assets/images/_common/menu.svg";

type Member = Database["public"]["Functions"]["crm_team"]["Returns"][number];

const addedFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default function Team({ initialMembers }: { initialMembers: Member[] }) {
  const setSidebarOpen = useCompaniesStore((state) => state.setSidebarOpen);
  const [members, setMembers] = useState(initialMembers);
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Member | null>(null);

  async function reload() {
    const { data, error } = await createClient().rpc("crm_team");
    if (error) setError(`Couldn't load the team: ${error.message}`);
    else setMembers(data ?? []);
  }

  async function run(
    key: string,
    action: () => PromiseLike<{ error: { message: string } | null }>,
  ) {
    setError(null);
    setBusy(key);
    const { error } = await action();
    setBusy(null);
    if (error) {
      setError(error.message);
      return false;
    }
    await reload();
    return true;
  }

  async function add(event: FormEvent) {
    event.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      setFieldError("Enter a valid email address.");
      return;
    }
    if (!isAllowedEmail(clean)) {
      setFieldError(`Only @${ALLOWED_EMAIL_DOMAIN} addresses can sign in.`);
      return;
    }
    if (members.some((member) => member.email === clean)) {
      setFieldError("They're already on the team.");
      return;
    }
    setFieldError(null);
    const ok = await run("add", () =>
      createClient().rpc("crm_team_add", { member_email: clean }),
    );
    if (ok) setEmail("");
  }

  const admins = members.filter((member) => member.is_admin).length;

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="border-border shrink-0 border-b">
        <div className="flex items-center gap-2 px-4 py-[14px]">
          <Button
            variant="secondary"
            size="icon"
            className="lg:hidden"
            aria-label="Open navigation"
            onClick={() => setSidebarOpen(true)}
          >
            <MenuIcon aria-hidden className="size-3.5" />
          </Button>
          <h1 className="truncate">Team</h1>
          <span className="caption-style bg-muted border-pill shrink-0 rounded-full border px-2 py-[3px]">
            {members.length} {members.length === 1 ? "person" : "people"} ·{" "}
            {admins} {admins === 1 ? "admin" : "admins"}
          </span>
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

      <div className="min-h-0 flex-1 overflow-auto p-4">
        <div className="mx-auto flex max-w-[44em] flex-col gap-4">
          <form
            onSubmit={add}
            noValidate
            className="border-line-strong bg-card flex flex-col gap-3 rounded-xl border p-4"
          >
            <h2>Add someone</h2>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
              <Field
                label="Work email"
                htmlFor="team-email"
                error={fieldError ?? undefined}
                hint="Once added, they create an account on the sign-in page with this address."
                className="min-w-0 flex-1"
              >
                <Input
                  id="team-email"
                  type="email"
                  autoComplete="off"
                  placeholder={`name@${ALLOWED_EMAIL_DOMAIN}`}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </Field>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                className="sm:mt-[26px]"
                disabled={busy !== null || !email.trim()}
              >
                {busy === "add" ? "Adding…" : "Add to team"}
              </Button>
            </div>
          </form>

          <ul className="border-line-strong bg-card divide-line-strong flex flex-col divide-y rounded-xl border">
            {members.map((member) => (
              <li
                key={member.email}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-medium">{member.email}</span>
                    {member.is_you && (
                      <span className="caption-style bg-muted text-soft shrink-0 rounded-[4px] px-1.5 py-[3px]">
                        You
                      </span>
                    )}
                  </span>
                  <span className="caption-style text-subtle">
                    {member.signed_up
                      ? `Added ${addedFormat.format(new Date(member.added_at))}`
                      : "Hasn't created an account yet"}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <label
                    className="caption-style text-soft flex items-center gap-2"
                    title={
                      member.is_you
                        ? "You can't change your own admin access"
                        : undefined
                    }
                  >
                    <Checkbox
                      checked={member.is_admin}
                      disabled={member.is_you || busy !== null}
                      onCheckedChange={(checked) =>
                        run(member.email, () =>
                          createClient().rpc("crm_team_set_admin", {
                            member_email: member.email,
                            make_admin: checked === true,
                          }),
                        )
                      }
                    />
                    Admin
                  </label>
                  {!member.is_you && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy !== null}
                      onClick={() => setRemoving(member)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <Dialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {removing?.email}?</DialogTitle>
            <DialogDescription>
              They&apos;ll lose access to the CRM straight away. Anything
              they&apos;ve added stays. You can add them back at any time.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setRemoving(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                const member = removing;
                setRemoving(null);
                if (member)
                  run(member.email, () =>
                    createClient().rpc("crm_team_remove", {
                      member_email: member.email,
                    }),
                  );
              }}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
