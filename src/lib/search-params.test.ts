import { describe, expect, it } from "vitest";
import { parseListingSearch, searchHref } from "./search-params";

describe("parseListingSearch", () => {
  it("defaults to newest first without a query and best match with one", () => {
    expect(parseListingSearch({})).toMatchObject({ q: "", sort: "newest", page: 1, conditions: [] });
    expect(parseListingSearch({ q: "  samsung   phone " })).toMatchObject({ q: "samsung phone", sort: "relevance" });
  });

  it("converts shilling prices to minor units and swaps a reversed range", () => {
    expect(parseListingSearch({ min: "5000", max: "1000" })).toMatchObject({ minPrice: 100_000, maxPrice: 500_000 });
  });

  it("drops invalid values instead of failing", () => {
    const parsed = parseListingSearch({
      min: "-5",
      max: "abc",
      condition: ["NEW", "BROKEN", "NEW"],
      location: "Atlantis",
      sort: "drop table",
      page: "9999",
      category: "../etc",
    });
    expect(parsed).toEqual({
      q: "",
      category: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      conditions: ["NEW"],
      location: undefined,
      sort: "newest",
      page: 1,
    });
  });

  it("accepts comma-separated conditions and a known location", () => {
    expect(parseListingSearch({ condition: "NEW,GOOD", location: "Westlands" })).toMatchObject({
      conditions: ["NEW", "GOOD"],
      location: "Westlands",
    });
  });

  it("caps very long queries", () => {
    expect(parseListingSearch({ q: "a".repeat(500) }).q).toHaveLength(100);
  });

  it("uses the category from the page path over the query string", () => {
    expect(parseListingSearch({ category: "fashion" }, { category: "electronics" }).category).toBe("electronics");
  });
});

describe("searchHref", () => {
  it("round-trips filters and leaves defaults out of the URL", () => {
    const search = parseListingSearch({ q: "sofa", min: "1000", condition: "NEW", location: "Karen", page: "3" });
    const href = searchHref("/search", search);
    expect(href).toBe("/search?q=sofa&min=1000&condition=NEW&location=Karen");
    const params = Object.fromEntries(new URL(href, "http://x").searchParams);
    expect(parseListingSearch(params)).toMatchObject({ ...search, page: 1 });
  });

  it("keeps the page when asked", () => {
    expect(searchHref("/c/fashion", parseListingSearch({}), { page: 2 })).toBe("/c/fashion?page=2");
  });
});
