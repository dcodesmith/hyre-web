import type { CarCategory, PublicCar } from "~/api/cars/schema";

const categoryQueries: Readonly<
  Partial<Record<CarCategory["name"], Readonly<Record<string, string>>>>
> = {
  suv: { vehicleType: "SUV" },
  sedan: { vehicleType: "SEDAN" },
  luxury: { serviceTier: "LUXURY" },
  executive: { serviceTier: "EXECUTIVE" },
  budget: { serviceTier: "STANDARD" },
};

const categorySectionIds: Readonly<Record<CarCategory["name"], string>> = {
  suv: "suvs",
  luxury: "luxury",
  budget: "budget",
  sedan: "sedans",
  executive: "executive",
  popular: "popular",
};

export function buildCategorySearchPath(category: CarCategory) {
  const query = categoryQueries[category.name];

  if (!query) {
    return "/search";
  }

  return `/search?${new URLSearchParams(query).toString()}`;
}

export function getCategorySectionId(category: CarCategory) {
  return categorySectionIds[category.name];
}

export function buildCarDetailPath(car: Pick<PublicCar, "id" | "make" | "model" | "year">) {
  const shortId = car.id.slice(0, 13);
  let slug = `${car.year}-${car.make}-${car.model}`
    .toLowerCase()
    .replaceAll(/[^\w\s-]/g, "")
    .replaceAll(/[\s_]+/g, "-")
    .replaceAll(/-+/g, "-")
    .replaceAll(/^-+/g, "");

  while (slug.endsWith("-")) {
    slug = slug.slice(0, -1);
  }

  return `/cars/${slug}-${shortId}?bookingType=DAY`;
}
