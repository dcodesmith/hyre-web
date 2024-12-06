import { json, LoaderFunction } from "@remix-run/node";
import { useLoaderData, Link, useSearchParams } from "@remix-run/react";
import { useState, useMemo } from "react";
import MultiselectFilter from "~/components/MultiselectFilter";
import CarCarousel from "~/components/Carousel";
import { vehicles } from "~/vehicles";
import { AdjustmentsVerticalIcon } from "@heroicons/react/24/outline";
import { DateRangePicker } from "~/components/DateRangePicker";
import { addDays } from "date-fns";
import { DateRange } from "react-day-picker";
import { Button } from "~/components/ui/button";
import { prisma } from "~/modules/db/db.server";

interface Car {
  id: number;
  make: string;
  model: string;
  price: number;
  color: string;
  images: string[];
  availability: {
    startDate: Date;
    endDate: Date;
  }[];
}

interface FilterOptions {
  makes: string[];
  models: string[];
  colors: string[];
}

const ITEMS_PER_PAGE = 9;

const carMakes = [...new Set(vehicles.map(({ make }) => make))];
const carModels = [...new Set(vehicles.map(({ model }) => model))];

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const make = url.searchParams.get("make");
  const model = url.searchParams.get("model");

  console.log({ make, model });
  // const page = parseInt(url.searchParams.get("page") || "1", 10);

  const cars = (
    await prisma.car.findMany({ where: { status: "AVAILABLE" } })
  ).map((car, index) => ({
    ...car,
    images: [
      `https://picsum.photos/seed/${index + 1}-1/400/300`,
      `https://picsum.photos/seed/${index + 1}-2/400/300`,
      `https://picsum.photos/seed/${index + 1}-3/400/300`,
    ],
  }));

  // Mock data for cars and filter options
  // const cars = vehicles.map((vehicle, index) => ({
  //   ...vehicle,
  //   id: index + 1,
  //   price: Math.floor(Math.random() * 50000) + 10000,
  //   color: ["Red", "Blue", "Green", "Black", "White"][
  //     Math.floor(Math.random() * 5)
  //   ],
  // }));

  const filterOptions: FilterOptions = {
    makes: carMakes,
    models: carModels,
    colors: ["Red", "Blue", "Green", "Black", "White"],
  };

  return json({ cars, filterOptions });
};

const DEFAULT_FILTERS = {
  makes: [],
  models: [],
  colors: [],
};

export default function Index() {
  const { cars, filterOptions } = useLoaderData<{
    cars: Car[];
    filterOptions: FilterOptions;
  }>();

  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedFilters, setSelectedFilters] =
    useState<Record<string, string[]>>(DEFAULT_FILTERS);

  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(),
    to: addDays(new Date(), 7),
  });

  const currentPage = parseInt(searchParams.get("page") || "1", 10);

  const filteredModels = useMemo(() => {
    if (selectedFilters.makes.length === 0) {
      return filterOptions.models;
    }
    return [
      ...new Set(
        cars
          .filter((car) => selectedFilters.makes.includes(car.make))
          .map((car) => car.model)
      ),
    ];
  }, [cars, filterOptions.models, selectedFilters.makes]);

  const handleFilterChange = (
    category: "makes" | "models" | "colors",
    selected: string[]
  ) => {
    setSelectedFilters((prev) => {
      const newFilters = { ...prev, [category]: selected };
      // Reset models when makes change
      if (category === "makes") {
        newFilters.models = [];
      }
      return newFilters;
    });
    setSearchParams({ page: "1" }); // Reset to first page when filters change
  };

  const filteredCars = useMemo(() => {
    return cars.filter(
      (car) =>
        (selectedFilters.makes.length === 0 ||
          selectedFilters.makes.includes(car.make)) &&
        (selectedFilters.models.length === 0 ||
          selectedFilters.models.includes(car.model)) &&
        (selectedFilters.colors.length === 0 ||
          selectedFilters.colors.includes(car.color))
    );
  }, [cars, selectedFilters]);

  const totalPages = Math.ceil(filteredCars.length / ITEMS_PER_PAGE);
  const paginatedCars = filteredCars.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handlePageChange = (newPage: number) =>
    setSearchParams({ page: newPage.toString() });

  const handleDateRangeChange = (dateRange: DateRange) => {
    setDateRange(dateRange);
    // You can add logic here to filter cars based on the date range if needed
  };

  const resetFilters = () => setSelectedFilters(DEFAULT_FILTERS);

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="content-center hidden sm:block">
          <AdjustmentsVerticalIcon className="h-5 w-5" />
        </div>

        <MultiselectFilter
          options={filterOptions.makes}
          selectedOptions={selectedFilters.makes}
          onChange={(selected: string[]) =>
            handleFilterChange("makes", selected)
          }
          label="Make"
        />

        <MultiselectFilter
          options={filteredModels}
          selectedOptions={selectedFilters.models}
          onChange={(selected: string[]) =>
            handleFilterChange("models", selected)
          }
          label="Model"
          disabled={selectedFilters.makes.length === 0}
        />

        {/* <MultiselectFilter
            options={filterOptions.colors}
            selectedOptions={selectedFilters.colors}
            onChange={(selected: string[]) =>
              handleFilterChange("colors", selected)
            }
            label="Color"
          /> */}

        <DateRangePicker
          className="sm:w-[300px]"
          date={dateRange}
          onDateChange={handleDateRangeChange}
        />

        <Button
          variant="secondary"
          disabled={selectedFilters.makes.length === 0}
          onClick={resetFilters}
        >
          Clear filters
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {paginatedCars.map((car) => (
          <Link key={car.id} to={`/cars/${car.id}`} className="block">
            <div className="border rounded overflow-hidden shadow-md hover:shadow-lg transition-shadow">
              <CarCarousel images={car.images} />
              <div className="p-4">
                <h2 className="font-semibold mb-2">
                  {car.make} {car.model}
                </h2>
                <p className="font-bold">
                  {new Intl.NumberFormat("en-NG", {
                    style: "currency",
                    currency: "NGN",
                  }).format(car.price)}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Pagination */}
      {filteredCars.length > ITEMS_PER_PAGE && (
        <div className="mt-8 flex justify-center">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => handlePageChange(page)}
              className={`mx-1 px-3 py-1 rounded ${
                page === currentPage
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              {page}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
