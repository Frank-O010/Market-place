"use client";

import { startTransition, type FormEvent } from "react";

/**
 * Submits a form to a useActionState action without React's automatic form reset,
 * so a seller who gets a validation error doesn't lose what they typed.
 */
export function submitKeepingValues(action: (form: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(() => action(form));
  };
}
