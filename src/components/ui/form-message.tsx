/** The error or success line at the top of a form. */
export function FormMessage({ state }: { state: { ok: boolean; error?: string } | null | undefined }) {
  if (!state || state.ok || !state.error) return null;
  return (
    <p role="alert" className="border-danger bg-danger-subtle rounded-md border p-3 text-sm">
      {state.error}
    </p>
  );
}
