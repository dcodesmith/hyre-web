import type { LoaderFunctionArgs } from "@remix-run/node";
import { Outlet, useLoaderData } from "@remix-run/react";
import invariant from "tiny-invariant";
import CarCarousel from "~/components/Carousel";
import { formatCurrency } from "~/lib/utils";
import { prisma } from "~/modules/db/db.server";

export const loader = async ({ params }: LoaderFunctionArgs) => {
  invariant(params.id, "id is required");
  const carId = params.id;

  const car = await prisma.car.findUnique({
    where: { id: carId },
    include: {
      images: true,
    },
  });

  return { car };
};

export default function CarDetails() {
  const { car } = useLoaderData<typeof loader>();

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold mb-4">
        {car?.make} {car?.model}
      </h2>

      <CarCarousel images={car?.images.map((image) => image.url) ?? []} />

      <div className="mt-6">
        <div className="px-4 sm:px-0">
          <h3 className="text-base font-semibold leading-7 text-gray-900">
            Car information and features
          </h3>
        </div>
        <div className="mt-4 border-t border-gray-100">
          <dl className="divide-y divide-gray-300">
            <div className="px-4 py-3 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt className="text-sm font-medium leading-6 text-gray-900">Make & Model</dt>
              <dd className="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0">
                {car?.make} {car?.model}
              </dd>
            </div>
            <div className="px-4 py-3 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt className="text-sm font-medium leading-6 text-gray-900">Price per Day</dt>
              <dd className="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0">
                {formatCurrency(car?.dayRate ?? 0)}
              </dd>
            </div>
            <div className="px-4 py-3 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt className="text-sm font-medium leading-6 text-gray-900">Features</dt>
              <dd className="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0">
                Air conditioning, GPS navigation system, Bluetooth connectivity, Cruise control,
                Rear-view camera, USB ports
              </dd>
            </div>
            <div className="px-4 py-3 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt className="text-sm font-medium leading-6 text-gray-900">Transmission Type</dt>
              <dd className="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0">
                Automatic
              </dd>
            </div>
            <div className="px-4 py-3 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt className="text-sm font-medium leading-6 text-gray-900">Fuel Type</dt>
              <dd className="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0">Diesel</dd>
            </div>
            <div className="px-4 py-3 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt className="text-sm font-medium leading-6 text-gray-900">Seating Capacity</dt>
              <dd className="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0">
                7-seater
              </dd>
            </div>
            <div className="px-4 py-3 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
              <dt className="text-sm font-medium leading-6 text-gray-900">Fuel Policy</dt>
              <dd className="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0">
                &quot;Full to Full&quot; (return the car with a full tank)
              </dd>
            </div>
          </dl>
        </div>
      </div>
      <Outlet />
    </div>
  );
}
