import { type RefObject, useState } from "react";
import { Link, useNavigation, useSearchParams } from "react-router";

import type { CarSearchResponse, SearchCar } from "~/api/cars/schema";
import { calculateBookingUnits } from "~/booking/dates";
import { type BookingType, DAY_BOOKING_TYPE } from "~/booking/types";
import { CarDomain } from "~/car/car-domain";
import { VehicleCard } from "~/car/vehicle-card";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "~/components/ui/empty";
import { Skeleton } from "~/components/ui/skeleton";
import { useInfiniteScroll } from "~/hooks/use-infinite-scroll";
import { CarSkeleton } from "~/search/car-skeleton";
import { CompactSearchBar } from "~/search/compact-search-bar";
import { PaginationControl } from "~/search/pagination-control";
import { SearchFilters } from "~/search/search-filters";
import { SearchForm } from "~/search/search-form";
import { buildResultsHeading } from "~/search/search-heading";
import { SearchModal } from "~/search/search-modal";
import {
  clearSearchFiltersPath,
  countActiveSearchFilters,
  parseSearchFilters,
  parseSearchUrl,
} from "~/search/search-url";

interface SearchPageProps {
  readonly result: CarSearchResponse | null;
}

const emptyPagination = {
  page: 1,
  limit: 12,
  total: 0,
  totalPages: 0,
  hasNextPage: false,
  hasPreviousPage: false,
};

function SearchCarGrid({
  cars,
  bookingType,
  hasDateFilters,
  totalUnits,
  hasMore,
  sentinelRef,
}: {
  readonly cars: SearchCar[];
  readonly bookingType: BookingType;
  readonly hasDateFilters: boolean;
  readonly totalUnits: number;
  readonly hasMore: boolean;
  readonly sentinelRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {cars.map((car, index) => {
          const view = CarDomain(car, new Date(), bookingType);
          const totalPrice = hasDateFilters ? view.displayRate * totalUnits : undefined;

          return (
            <VehicleCard
              key={car.id}
              car={car}
              bookingType={bookingType}
              priority={index < 6}
              variant="grid"
              showTotal={hasDateFilters}
              totalPrice={totalPrice}
            />
          );
        })}
      </div>
      {hasMore ? <div ref={sentinelRef} className="h-1" aria-hidden="true" /> : null}
    </>
  );
}

function SearchEmptyState({
  hasActiveFilters,
  searchParams,
}: {
  readonly hasActiveFilters: boolean;
  readonly searchParams: URLSearchParams;
}) {
  const description = hasActiveFilters
    ? "Try removing some filters or adjusting your search criteria."
    : "Try adjusting your dates or search criteria.";

  return (
    <Empty className="border py-16">
      <EmptyHeader>
        <EmptyTitle className="contents">
          <h3>No vehicles found</h3>
        </EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="gap-3 sm:flex-row sm:justify-center">
        {hasActiveFilters ? (
          <Button variant="outline" className="h-10" asChild>
            <Link to={clearSearchFiltersPath(searchParams)}>Clear filters</Link>
          </Button>
        ) : null}
        <Button className="h-10" asChild>
          <Link to="/">Browse all vehicles</Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
}

function SearchResults({ result }: { readonly result: CarSearchResponse }) {
  const [searchParams] = useSearchParams();
  const navigation = useNavigation();
  const query = parseSearchUrl(searchParams);
  const bookingType: BookingType = query.bookingType ?? DAY_BOOKING_TYPE;
  const isUpdatingResults =
    navigation.state === "loading" && navigation.location?.pathname === "/search";
  const {
    allItems: allCars,
    hasMore,
    fetchError,
    isLoading,
    sentinelRef,
    initialItemsCount,
    retry,
  } = useInfiniteScroll({
    initialItems: result.cars,
    initialPagination: result.pagination,
    searchParams,
  });
  const activeFilterCount = countActiveSearchFilters(parseSearchFilters(searchParams));
  const hasActiveFilters = activeFilterCount > 0;
  const hasDateFilters = Boolean(query.from && query.to);
  const totalUnits = calculateBookingUnits(query.from, query.to, bookingType);
  const resultsHeading = buildResultsHeading(result.pagination.total, result.filters.vehicleTypes);

  return (
    <>
      <div className="flex items-center justify-between gap-4 py-4">
        <h1 className="font-semibold">
          {isUpdatingResults ? <Skeleton className="h-5 w-32" /> : resultsHeading}
        </h1>
        <SearchFilters
          facets={result.facets}
          bookingType={bookingType}
          activeFilterCount={activeFilterCount}
        />
      </div>

      <PaginationControl
        currentPage={result.pagination.page}
        totalPages={result.pagination.totalPages}
        hasNextPage={result.pagination.hasNextPage}
        hasPreviousPage={result.pagination.hasPreviousPage}
        searchParams={searchParams}
      />

      {isUpdatingResults ? <CarSkeleton count={6} /> : null}

      {!isUpdatingResults && allCars.length > 0 ? (
        <SearchCarGrid
          cars={allCars}
          bookingType={bookingType}
          hasDateFilters={hasDateFilters}
          totalUnits={totalUnits}
          hasMore={hasMore}
          sentinelRef={sentinelRef}
        />
      ) : null}

      {!isUpdatingResults && allCars.length === 0 ? (
        <SearchEmptyState hasActiveFilters={hasActiveFilters} searchParams={searchParams} />
      ) : null}

      {!isUpdatingResults && hasMore && isLoading ? (
        <div className="mt-6">
          <CarSkeleton count={3} />
        </div>
      ) : null}

      {fetchError ? (
        <Alert variant="destructive" className="mt-6">
          <AlertTitle>Couldn&apos;t load more vehicles</AlertTitle>
          <AlertDescription>{fetchError}</AlertDescription>
          <AlertAction>
            <Button variant="outline" size="sm" onClick={retry}>
              Retry
            </Button>
          </AlertAction>
        </Alert>
      ) : null}

      {!isUpdatingResults && !hasMore && allCars.length > initialItemsCount ? (
        <p className="mt-6 py-8 text-center text-sm text-muted-foreground">
          You&apos;ve reached the end of available vehicles
        </p>
      ) : null}
    </>
  );
}

export function SearchPage({ result }: SearchPageProps) {
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [searchParams] = useSearchParams();
  const resultsKey = new URLSearchParams(searchParams);
  resultsKey.delete("page");
  resultsKey.delete("countOnly");

  return (
    <div className="min-h-screen text-sm">
      <div className="fixed top-0 right-0 left-0 z-30 border-b-0 bg-white shadow-sm md:top-17.25 md:border-b md:border-gray-200">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <div className="mx-auto hidden max-w-4xl md:block">
            <SearchForm isCompact preserveFilterParams />
          </div>
          <div className="md:hidden">
            <CompactSearchBar onClick={() => setIsSearchModalOpen(true)} />
          </div>
        </div>
      </div>

      {isSearchModalOpen ? (
        <SearchModal isOpen onClose={() => setIsSearchModalOpen(false)} preserveFilterParams />
      ) : null}

      <div className="mx-auto my-24 max-w-7xl px-4">
        {result ? (
          <SearchResults key={resultsKey.toString()} result={result} />
        ) : (
          <Empty className="border px-6 py-10">
            <EmptyHeader>
              <EmptyTitle className="contents">
                <h1>Vehicles are temporarily unavailable</h1>
              </EmptyTitle>
              <EmptyDescription>
                Please try again shortly or contact Tripdly support for help with a booking.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </div>
    </div>
  );
}

export function createEmptySearchResult(): CarSearchResponse {
  return {
    cars: [],
    filters: { serviceTiers: [], vehicleTypes: [], bookingType: null },
    facets: null,
    pagination: emptyPagination,
  };
}
