import { type LoaderFunctionArgs, Outlet, useLoaderData } from "react-router";
import invariant from "tiny-invariant";
import CarCarousel from "~/components/Carousel";
import { formatCurrency } from "~/lib/utils";
import { prisma } from "~/modules/db/db.server";
import { serviceTierLabels, vehicleTypeLabels } from "~/types";
import type { ServiceTier, VehicleType } from "~/types";

export const loader = async ({ params }: LoaderFunctionArgs) => {
  invariant(params.id, "id is required");

  const car = await prisma.car.findUnique({
    where: { id: params.id },
    include: {
      images: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
    },
  });

  return { car };
};

const statusLabels: Record<string, string> = {
  AVAILABLE: "Available",
  BOOKED: "Booked",
  HOLD: "On Hold",
  IN_SERVICE: "In Service",
};

function DetailRow({ label, value }: Readonly<{ label: string; value: React.ReactNode }>) {
  return (
    <div className="px-4 py-3 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
      <dt className="text-sm font-medium leading-6 text-gray-900">{label}</dt>
      <dd className="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0">{value}</dd>
    </div>
  );
}

export default function CarDetails() {
  const { car } = useLoaderData<typeof loader>();

  if (!car) {
    return <p className="text-center text-gray-500 py-12">Car not found.</p>;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold mb-4">
        {car.make} {car.model}
      </h2>

      <CarCarousel images={car.images.map((image) => image.url)} />

      <div className="mt-6 space-y-8">
        <section>
          <h3 className="px-4 sm:px-0 text-base font-semibold leading-7 text-gray-900">
            Vehicle Details
          </h3>
          <dl className="mt-4 divide-y divide-gray-200 border-t border-gray-100">
            <DetailRow label="Make & Model" value={`${car.make} ${car.model}`} />
            <DetailRow label="Year" value={car.year} />
            <DetailRow label="Registration Number" value={car.registrationNumber} />
            <DetailRow
              label="Vehicle Type"
              value={vehicleTypeLabels[car.vehicleType as VehicleType] ?? car.vehicleType}
            />
            <DetailRow
              label="Service Tier"
              value={serviceTierLabels[car.serviceTier as ServiceTier] ?? car.serviceTier}
            />
            <DetailRow
              label="Passenger Capacity"
              value={`${car.passengerCapacity} passenger${car.passengerCapacity > 1 ? "s" : ""}`}
            />
            <DetailRow label="Status" value={statusLabels[car.status] ?? car.status} />
          </dl>
        </section>

        <section>
          <h3 className="px-4 sm:px-0 text-base font-semibold leading-7 text-gray-900">Pricing</h3>
          <dl className="mt-4 divide-y divide-gray-200 border-t border-gray-100">
            <DetailRow label="Hourly Rate" value={formatCurrency(car.hourlyRate)} />
            <DetailRow label="Daily Rate (12 hours)" value={formatCurrency(car.dayRate)} />
            <DetailRow label="Nightly Rate (11pm to 5am)" value={formatCurrency(car.nightRate)} />
            <DetailRow label="Full Day Rate (24 hours)" value={formatCurrency(car.fullDayRate)} />
            <DetailRow label="Airport Pickup Rate" value={formatCurrency(car.airportPickupRate)} />
            <DetailRow
              label="Pricing Includes Fuel"
              value={car.pricingIncludesFuel ? "Yes" : "No"}
            />
            {!car.pricingIncludesFuel && car.fuelUpgradeRate && (
              <DetailRow label="Fuel Upgrade Rate" value={formatCurrency(car.fuelUpgradeRate)} />
            )}
          </dl>
        </section>
      </div>

      <Outlet />
    </div>
  );
}
