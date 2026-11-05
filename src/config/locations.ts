/** Areas a seller can pick as their location. Launch city first; grows as we expand. */
export const nairobiAreas = [
  "Nairobi CBD",
  "Westlands",
  "Kilimani",
  "Kileleshwa",
  "Lavington",
  "Parklands",
  "Upper Hill",
  "South B",
  "South C",
  "Industrial Area",
  "Eastleigh",
  "Embakasi",
  "Donholm",
  "Kasarani",
  "Roysambu",
  "Ruaka",
  "Karen",
  "Langata",
  "Rongai",
  "Kitengela",
  "Thika Road",
  "Ngong Road",
] as const;

export type NairobiArea = (typeof nairobiAreas)[number];
