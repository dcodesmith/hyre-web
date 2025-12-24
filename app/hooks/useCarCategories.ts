import { useMemo } from "react";
import type { SerializedCar } from "~/types";

/** Configuration for category filter patterns */
const CATEGORY_PATTERNS = {
  suvs: [
    "suv",
    "land cruiser",
    "range rover",
    "defender",
    "highlander",
    "pilot",
    "pajero",
    "gx",
    "lx",
    "q7",
    "velar",
  ] as readonly string[],
  executive: ["s-class", "7 series", "a8", "ls", "g-class"] as readonly string[],
  sedans: ["camry", "accord", "corolla", "sedan"] as readonly string[],
  popular: ["toyota", "honda", "lexus"] as readonly string[],
  luxuryBrands: [
    "mercedes-benz",
    "land rover",
    "lexus",
    "audi",
    "bmw",
    "porsche",
  ] as readonly string[],
};

/** Thresholds for price-based categories */
const PRICE_THRESHOLDS = {
  luxuryMinRate: 80000,
  budgetMaxRate: 30000,
} as const;

/** Minimum number of cars needed to show a category */
const MIN_CATEGORY_SIZE = 3;

export interface CarCategories {
  suvs: SerializedCar[];
  luxury: SerializedCar[];
  budget: SerializedCar[];
  sedans: SerializedCar[];
  executive: SerializedCar[];
  popular: SerializedCar[];
  allCars: SerializedCar[];
}

/**
 * Hook to categorize cars into meaningful groups for display
 * Extracts complex categorization logic from the main component to reduce cognitive complexity
 */
export function useCarCategories(
  cars: SerializedCar[],
  getRateForBookingType: (car: SerializedCar) => number,
): CarCategories {
  return useMemo(() => {
    const getMakeModel = (car: SerializedCar) => `${car.make} ${car.model}`.toLowerCase();
    const getMake = (car: SerializedCar) => car.make.toLowerCase();

    // SUVs - Common SUV makes/models
    const suvs = cars.filter((car) => {
      const makeModel = getMakeModel(car);
      return CATEGORY_PATTERNS.suvs.some((pattern) => makeModel.includes(pattern));
    });

    // Create a Set of SUV IDs for O(1) lookup in sedan filter
    const suvIds = new Set(suvs.map((car) => car.id));

    // Luxury - Premium brands and high-end models
    const luxury = cars.filter((car) => {
      const rate = getRateForBookingType(car);
      return (
        rate >= PRICE_THRESHOLDS.luxuryMinRate ||
        CATEGORY_PATTERNS.luxuryBrands.includes(getMake(car))
      );
    });

    // Budget-Friendly - Affordable options
    const budget = cars.filter((car) => {
      const rate = getRateForBookingType(car);
      return rate > 0 && rate < PRICE_THRESHOLDS.budgetMaxRate;
    });

    // Sedans - Car body type (excluding SUVs for better categorization)
    const sedans = cars.filter((car) => {
      const makeModel = getMakeModel(car);
      const matchesSedanPattern = CATEGORY_PATTERNS.sedans.some((pattern) =>
        makeModel.includes(pattern),
      );
      const isNotSuv = !suvIds.has(car.id) && !makeModel.includes("suv");
      return matchesSedanPattern || isNotSuv;
    });

    // Executive - High-end sedans and luxury cars for business
    const executive = cars.filter((car) => {
      const makeModel = getMakeModel(car);
      return CATEGORY_PATTERNS.executive.some((pattern) => makeModel.includes(pattern));
    });

    // Popular - Most common/versatile vehicles
    const popular = cars.filter((car) => CATEGORY_PATTERNS.popular.includes(getMake(car)));

    // Only return categories with enough cars
    return {
      suvs: suvs.length >= MIN_CATEGORY_SIZE ? suvs : [],
      luxury: luxury.length >= MIN_CATEGORY_SIZE ? luxury : [],
      budget: budget.length >= MIN_CATEGORY_SIZE ? budget : [],
      sedans: sedans.length >= MIN_CATEGORY_SIZE ? sedans : [],
      executive: executive.length >= MIN_CATEGORY_SIZE ? executive : [],
      popular: popular.length >= MIN_CATEGORY_SIZE ? popular : [],
      allCars: cars,
    };
  }, [cars, getRateForBookingType]);
}
