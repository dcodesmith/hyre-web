import { describe, expect, it } from "vitest";

import { placesAutocompleteResponseSchema, resolvePlaceResponseSchema } from "./schema";

describe("placesAutocompleteResponseSchema", () => {
  it("accepts suggestions and optional degraded meta", () => {
    const parsed = placesAutocompleteResponseSchema.safeParse({
      suggestions: [
        {
          placeId: "place_eko_hotel",
          description: "Eko Hotel, Victoria Island",
          types: ["lodging"],
        },
      ],
      meta: { degraded: false },
    });

    expect(parsed.success).toBe(true);
  });

  it("accepts an empty degraded list", () => {
    expect(
      placesAutocompleteResponseSchema.safeParse({
        suggestions: [],
        meta: { degraded: true },
      }).success,
    ).toBe(true);
  });
});

describe("resolvePlaceResponseSchema", () => {
  it("accepts a resolved address and a failed details lookup", () => {
    expect(
      resolvePlaceResponseSchema.safeParse({
        placeId: "place_eko_hotel",
        address: "Eko Hotel, Victoria Island",
        types: ["lodging"],
      }).success,
    ).toBe(true);
    expect(
      resolvePlaceResponseSchema.safeParse({
        placeId: "place_missing",
        address: null,
        types: [],
        meta: { degraded: true },
      }).success,
    ).toBe(true);
  });
});
