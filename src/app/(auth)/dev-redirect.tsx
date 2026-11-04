import { redirect } from "next/navigation";

/** With AUTH_PROVIDER=dev, Clerk's pages are replaced by the local dev sign-in. */
export async function DevAuthRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const target = (await searchParams).redirect_url;
  const redirectUrl = typeof target === "string" ? target : "/";
  redirect(`/dev/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}`);
  return null;
}
