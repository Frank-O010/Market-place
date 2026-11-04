import { describe, expect, it } from "vitest";
import { parseListingSearch } from "@/lib/search-params";
import { meiliFilter, meiliSort, quote } from "./meili-filter";

describe("meiliFilter", () => {
  it("builds one clause per filter", () => {
    const search = parseListingSearch({
      category: "phones-tablets",
      min: "1000",
      max: "20000",
      condition: "NEW,GOOD",
      location: "Westlands",
    });
    expect(meiliFilter(search)).toEqual([
      'categorySlugs = "phones-tablets"',
      "priceMinor >= 100000",
      "priceMinor <= 2000000",
      'condition IN ["NEW", "GOOD"]',
      'location = "Westlands"',
    ]);
  });

  it("has no clauses for an empty search", () => {
    expect(meiliFilter(parseListingSearch({}))).toEqual([]);
  });

  it("escapes quotes so a value can't break out of the expression", () => {
    expect(quote('a" OR priceMinor > 0 OR "')).toBe('"a\\" OR priceMinor > 0 OR \\""');
    expect(quote("back\\slash")).toBe('"back\\\\slash"');
  });
});

describe("meiliSort", () => {
  it("maps sort options to index fields", () => {
    expect(meiliSort(parseListingSearch({ q: "tv" }))).toBeUndefined();
    expect(meiliSort(parseListingSearch({}))).toEqual(["publishedAt:desc"]);
    expect(meiliSort(parseListingSearch({ sort: "price_asc" }))).toEqual(["priceMinor:asc"]);
    expect(meiliSort(parseListingSearch({ sort: "price_desc" }))).toEqual(["priceMinor:desc"]);
  });
});
