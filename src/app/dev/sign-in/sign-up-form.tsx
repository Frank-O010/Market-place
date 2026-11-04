"use client";

import { useActionState } from "react";
import { devSignUp, type SignUpState } from "@/server/actions/dev-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";

export function DevSignUpForm({ redirectTo }: { redirectTo: string }) {
  const [state, action, pending] = useActionState<SignUpState, FormData>(devSignUp, {});
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <Field id="name" label="Full name" error={state.errors?.name}>
        <Input name="name" autoComplete="name" required />
      </Field>
      <Field id="email" label="Email" error={state.errors?.email}>
        <Input name="email" type="email" autoComplete="email" inputMode="email" required />
      </Field>
      {state.errors?.form && (
        <p role="alert" className="text-danger text-sm">
          {state.errors.form}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
