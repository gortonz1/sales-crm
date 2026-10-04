"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/_ui/button";
import Field from "@/components/_ui/field";
import { Input } from "@/components/_ui/input";
import { createClient } from "@/lib/supabase/client";
import Logo from "@/public/assets/images/_common/logo.svg";

type Mode = "sign-in" | "sign-up";

export default function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setNotice(null);
    const supabase = createClient();

    if (mode === "sign-in") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(error.message);
        setPending(false);
        return;
      }
      router.replace("/leads");
      router.refresh();
      return;
    }

    const { data, error } = await supabase.auth.signUp({ email, password });
    setPending(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (data.session) {
      router.replace("/leads");
      router.refresh();
      return;
    }
    setNotice(
      "Check your inbox and click the confirmation link, then come back and sign in.",
    );
    setMode("sign-in");
  }

  return (
    <div className="border-line-strong bg-card flex w-full max-w-[24em] flex-col gap-6 rounded-xl border p-6">
      <div className="flex items-center gap-2">
        <Logo aria-hidden className="size-8 shrink-0 overflow-visible" />
        <div className="flex flex-col gap-1">
          <h1 className="lead-style font-medium">Sales CRM</h1>
          <p className="caption-style text-subtle">
            {mode === "sign-in" ? "Sign in to continue" : "Create your account"}
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Field
          label="Password"
          htmlFor="password"
          hint={mode === "sign-up" ? "At least 8 characters" : undefined}
        >
          <Input
            id="password"
            type="password"
            autoComplete={
              mode === "sign-in" ? "current-password" : "new-password"
            }
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>

        {error && (
          <p role="alert" className="caption-style text-danger">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="caption-style text-soft">
            {notice}
          </p>
        )}

        <Button
          variant="primary"
          size="md"
          type="submit"
          disabled={pending || !email || password.length < 8}
          className="w-full"
        >
          {mode === "sign-in" ? "Sign in" : "Create account"}
        </Button>
      </form>

      <Button
        variant="link"
        size="none"
        className="caption-style self-center"
        onClick={() => {
          setMode(mode === "sign-in" ? "sign-up" : "sign-in");
          setError(null);
        }}
      >
        {mode === "sign-in"
          ? "First time here? Create an account"
          : "Already have an account? Sign in"}
      </Button>
    </div>
  );
}
