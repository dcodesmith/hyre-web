import { z } from "zod";

const placeSuggestionSchema = z.object({
  placeId: z.string(),
  description: z.string(),
  types: z.array(z.string()).optional(),
});

const placesMetaSchema = z
  .object({
    degraded: z.boolean(),
  })
  .optional();

export const placesAutocompleteResponseSchema = z.object({
  suggestions: z.array(placeSuggestionSchema),
  meta: placesMetaSchema,
});

export const resolvePlaceResponseSchema = z.object({
  placeId: z.string(),
  address: z.string().nullable(),
  types: z.array(z.string()),
  meta: placesMetaSchema,
});

export type PlaceSuggestion = z.infer<typeof placeSuggestionSchema>;
export type PlacesAutocompleteResponse = z.infer<typeof placesAutocompleteResponseSchema>;
export type ResolvePlaceResponse = z.infer<typeof resolvePlaceResponseSchema>;
