import { ServiceTiers, VehicleTypes } from "~/types";
import type { ServiceTier, VehicleType } from "~/types";

/** Minimum number of cars needed to show a category */
const MIN_CATEGORY_SIZE = 3;

/** Popular car makes for the "Popular" category */
const POPULAR_MAKES = new Set(["toyota", "honda", "lexus"]);

/**
 * Lightweight car type for homepage display (server-serialization optimization)
 * Only includes fields actually used by listing cards.
 */
export interface HomePageCar {
  id: string;
  make: string;
  model: string;
  year: number;
  createdAt: string;
  dayRate: number;
  passengerCapacity: number;
  pricingIncludesFuel: boolean;
  vehicleType: VehicleType;
  serviceTier: ServiceTier;
  images: { url: string }[];
}

export interface CarCategories {
  suvs: HomePageCar[];
  luxury: HomePageCar[];
  budget: HomePageCar[];
  sedans: HomePageCar[];
  executive: HomePageCar[];
  popular: HomePageCar[];
  allCars: HomePageCar[];
}

export const emptyCarCategories = (): CarCategories => ({
  suvs: [],
  luxury: [],
  budget: [],
  sedans: [],
  executive: [],
  popular: [],
  allCars: [],
});

export const faqData = {
  questions: [
    {
      question: "How do I book a chauffeur service in Lagos?",
      answer:
        "Simply visit our website, select your bookingn type, date, and time, choose your preferred vehicle, and complete the booking. You'll receive instant confirmation.",
    },
    {
      question: "What types of vehicles are available?",
      answer:
        "We offer a wide range of vehicles including standard, economy, budget-friendly, luxury sedans, SUVs, executive cars, and premium vehicles from brands like Toyota, Lexus and Mercedes-Benz.",
    },
    {
      question: "Are your chauffeurs professional and vetted?",
      answer:
        "Yes, all our chauffeurs are professionally trained, background-checked via the fleet owners, and experienced in providing premium transportation services.",
    },
    {
      question: "Do you offer airport pickup services?",
      answer:
        "Yes, we specialize in airport pickups from Murtala Muhammed International Airport (Lagos).",
    },
  ],
};

/**
 * Categorizes cars into meaningful groups for display.
 */
export function categorizeCars(cars: HomePageCar[]): CarCategories {
  const suvs: HomePageCar[] = [];
  const luxury: HomePageCar[] = [];
  const budget: HomePageCar[] = [];
  const sedans: HomePageCar[] = [];
  const executive: HomePageCar[] = [];
  const popular: HomePageCar[] = [];

  for (const car of cars) {
    if (car.vehicleType === VehicleTypes.SUV || car.vehicleType === VehicleTypes.LUXURY_SUV) {
      suvs.push(car);
    }
    if (car.serviceTier === ServiceTiers.LUXURY || car.serviceTier === ServiceTiers.ULTRA_LUXURY) {
      luxury.push(car);
    }
    if (car.serviceTier === ServiceTiers.STANDARD) {
      budget.push(car);
    }
    if (car.vehicleType === VehicleTypes.SEDAN || car.vehicleType === VehicleTypes.LUXURY_SEDAN) {
      sedans.push(car);
    }
    if (car.serviceTier === ServiceTiers.EXECUTIVE) {
      executive.push(car);
    }
    if (POPULAR_MAKES.has(car.make.toLowerCase())) {
      popular.push(car);
    }
  }

  return {
    suvs: suvs.length >= MIN_CATEGORY_SIZE ? suvs : [],
    luxury: luxury.length >= MIN_CATEGORY_SIZE ? luxury : [],
    budget: budget.length >= MIN_CATEGORY_SIZE ? budget : [],
    sedans: sedans.length >= MIN_CATEGORY_SIZE ? sedans : [],
    executive: executive.length >= MIN_CATEGORY_SIZE ? executive : [],
    popular: popular.length >= MIN_CATEGORY_SIZE ? popular : [],
    allCars: cars,
  };
}
