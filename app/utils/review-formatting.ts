export function formatRating(rating: unknown): string {
  const numericRating = typeof rating === "number" && Number.isFinite(rating) ? rating : 0;
  const clamped = Math.max(0, Math.min(5, numericRating));
  return clamped.toFixed(1);
}
