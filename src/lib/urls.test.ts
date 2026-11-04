import { describe, expect, it } from "vitest";
import { listingPath, parseListingParam } from "./urls";

describe("listing URLs", () => {
  const id = "cmh7x2k9a0001abcdxyz12345";

  it("round-trips slug and id", () => {
    const path = listingPath({ slug: "samsung-galaxy-a54", id });
    expect(path).toBe(`/l/samsung-galaxy-a54-${id}`);
    expect(parseListingParam(path.slice(3))).toEqual({ slug: "samsung-galaxy-a54", id });
  });

  it("accepts an id on its own and rejects junk", () => {
    expect(parseListingParam(id)).toEqual({ slug: "", id });
    expect(parseListingParam("not-a-listing")).toBeNull();
    expect(parseListingParam(`../../etc-${id}`)).toBeNull();
    expect(parseListingParam(`UPPER-${id}`)).toBeNull();
  });
});
