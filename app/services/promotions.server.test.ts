import { fromZonedTime } from "date-fns-tz";
import { Decimal } from "decimal.js";
import { describe, expect, it, vi } from "vitest";
import { LAGOS_TIMEZONE } from "~/utils/timezone";
import type { ActivePromotion } from "./promotions.server";
import { resolveBestPromotionForInterval, toPromotionWindowExclusive } from "./promotions.server";

vi.mock("~/modules/db/db.server", () => ({ prisma: {} }));

function buildPromotion(input: {
  id: string;
  discountValue: number;
  startDate: string;
  endDate: string;
  carId?: string | null;
  createdAt?: string;
}): ActivePromotion {
  return {
    id: input.id,
    name: input.id,
    discountValue: new Decimal(input.discountValue),
    startDate: new Date(input.startDate),
    endDate: new Date(input.endDate),
    carId: input.carId ?? null,
    createdAt: new Date(input.createdAt ?? "2026-01-01T00:00:00.000Z"),
  };
}

describe("toPromotionWindowExclusive", () => {
  it("converts inclusive calendar dates into start-inclusive/end-exclusive instants", () => {
    const window = toPromotionWindowExclusive({
      startDate: "2026-04-11",
      endDateInclusive: "2026-04-14",
      timeZone: LAGOS_TIMEZONE,
    });

    expect(window.startDate.toISOString()).toBe(
      fromZonedTime("2026-04-11T00:00:00", LAGOS_TIMEZONE).toISOString(),
    );
    expect(window.endDate.toISOString()).toBe(
      fromZonedTime("2026-04-15T00:00:00", LAGOS_TIMEZONE).toISOString(),
    );
  });
});

describe("resolveBestPromotionForInterval", () => {
  it("prefers car-specific promotions over fleet-wide promotions", () => {
    const promotions = [
      buildPromotion({
        id: "fleet",
        carId: null,
        discountValue: 25,
        startDate: "2026-04-11T00:00:00.000Z",
        endDate: "2026-04-15T00:00:00.000Z",
      }),
      buildPromotion({
        id: "car-specific",
        carId: "car-123",
        discountValue: 10,
        startDate: "2026-04-11T00:00:00.000Z",
        endDate: "2026-04-15T00:00:00.000Z",
      }),
    ];

    const chosen = resolveBestPromotionForInterval({
      promotions,
      carId: "car-123",
      intervalStart: new Date("2026-04-12T00:00:00.000Z"),
      intervalEndExclusive: new Date("2026-04-13T00:00:00.000Z"),
      baseAmount: 50000,
    });

    expect(chosen?.id).toBe("car-specific");
  });

  it("treats touching boundaries as non-overlapping with end-exclusive semantics", () => {
    const promotions = [
      buildPromotion({
        id: "promo",
        carId: "car-123",
        discountValue: 20,
        startDate: "2026-04-11T00:00:00.000Z",
        endDate: "2026-04-14T00:00:00.000Z",
      }),
    ];

    const chosen = resolveBestPromotionForInterval({
      promotions,
      carId: "car-123",
      intervalStart: new Date("2026-04-14T00:00:00.000Z"),
      intervalEndExclusive: new Date("2026-04-15T00:00:00.000Z"),
      baseAmount: 50000,
    });

    expect(chosen).toBeNull();
  });
});
