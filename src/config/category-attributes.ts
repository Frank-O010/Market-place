/**
 * Optional item details shown in the listing editor, by top-level category slug.
 * Values are free text (max 60 characters) and appear in a "Details" table on the product page.
 * Admins will be able to edit these per category in Phase 5 (Category.attributeSchema).
 */
export type AttributeField = { key: string; label: string; placeholder?: string };

const brand: AttributeField = { key: "brand", label: "Brand", placeholder: "e.g. Samsung" };

export const categoryAttributes: Record<string, AttributeField[]> = {
  "phones-tablets": [
    brand,
    { key: "model", label: "Model", placeholder: "e.g. Galaxy A54" },
    { key: "storage", label: "Storage", placeholder: "e.g. 128GB" },
    { key: "colour", label: "Colour" },
  ],
  electronics: [brand, { key: "model", label: "Model" }, { key: "warranty", label: "Warranty", placeholder: "e.g. 6 months" }],
  "home-furniture": [{ key: "material", label: "Material" }, { key: "dimensions", label: "Size", placeholder: "e.g. 3-seater, 200cm" }, { key: "colour", label: "Colour" }],
  fashion: [brand, { key: "size", label: "Size", placeholder: "e.g. M, 42" }, { key: "colour", label: "Colour" }],
  "baby-kids": [brand, { key: "age", label: "Age range", placeholder: "e.g. 0–3 years" }],
  "sports-outdoors": [brand, { key: "size", label: "Size" }],
  "health-beauty": [brand, { key: "volume", label: "Size or volume", placeholder: "e.g. 100ml" }],
  "books-stationery": [{ key: "author", label: "Author" }, { key: "edition", label: "Edition" }],
};

export const attributeLabel = (key: string) =>
  Object.values(categoryAttributes)
    .flat()
    .find((f) => f.key === key)?.label ?? key;
