import "server-only";

export type KeyMode = "test" | "live" | "unknown" | "missing";

function keyMode(key: string | undefined, prefix: "pk" | "sk"): KeyMode {
  if (!key) return "missing";
  if (key.startsWith(`${prefix}_test_`)) return "test";
  if (key.startsWith(`${prefix}_live_`)) return "live";
  return "unknown";
}

/** The Clerk Frontend API host encoded in a publishable key (public information). */
export function frontendApiFromPublishableKey(key: string | undefined): string | null {
  const encoded = key?.split("_")[2];
  if (!encoded) return null;
  try {
    const decoded = Buffer.from(encoded, "base64").toString("utf8");
    return decoded.endsWith("$") ? decoded.slice(0, -1) : null;
  } catch {
    return null;
  }
}

async function keyIds(url: string, init?: RequestInit): Promise<Set<string> | null> {
  try {
    const response = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(3000) });
    if (!response.ok) return null;
    const body = (await response.json()) as { keys?: { kid?: string }[] };
    return new Set((body.keys ?? []).map((k) => k.kid).filter((k): k is string => Boolean(k)));
  } catch {
    return null;
  }
}

/**
 * Checks the Clerk keys without revealing them: their modes, the Frontend API host, and
 * whether the publishable and secret keys belong to the same Clerk instance (their signing
 * keys match). `sameInstance` is null when Clerk couldn't be reached.
 */
export async function describeClerkKeys(publishableKey: string | undefined, secretKey: string | undefined) {
  const frontendApi = frontendApiFromPublishableKey(publishableKey);
  let sameInstance: boolean | null = null;
  if (frontendApi && secretKey) {
    const [frontend, backend] = await Promise.all([
      keyIds(`https://${frontendApi}/.well-known/jwks.json`),
      keyIds("https://api.clerk.com/v1/jwks", { headers: { Authorization: `Bearer ${secretKey}` } }),
    ]);
    if (frontend && backend) sameInstance = [...frontend].some((kid) => backend.has(kid));
  }
  const publishableKeyMode = keyMode(publishableKey, "pk");
  const secretKeyMode = keyMode(secretKey, "sk");
  return {
    publishableKeyMode,
    secretKeyMode,
    modesMatch: publishableKeyMode === secretKeyMode,
    frontendApi,
    sameInstance,
  };
}
