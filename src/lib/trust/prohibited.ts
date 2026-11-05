/**
 * Words that suggest a listing may be a prohibited item. A match doesn't block the seller (too
 * many innocent uses, like "glue gun"); it sends the listing to the moderation queue instead.
 */
export const defaultProhibitedKeywords = [
  "gun",
  "pistol",
  "rifle",
  "ammunition",
  "bullets",
  "pepper spray",
  "taser",
  "bhang",
  "weed",
  "marijuana",
  "cannabis",
  "cocaine",
  "heroin",
  "miraa",
  "codeine",
  "tramadol",
  "prescription",
  "counterfeit",
  "replica",
  "fake id",
  "passport",
  "national id",
  "ivory",
  "rhino horn",
  "pangolin",
  "puppies",
  "cigarettes",
  "vape",
  "shisha",
  "alcohol",
  "whisky",
  "vodka",
];

/** Returns the keywords found as whole words (case-insensitive). */
export function findProhibitedKeywords(text: string, keywords: readonly string[]): string[] {
  const lower = text.toLowerCase();
  return keywords.filter((k) => {
    const escaped = k
      .toLowerCase()
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\s+/g, "\\s+");
    return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:s|es)?(?=$|[^a-z0-9])`, "i").test(lower);
  });
}
