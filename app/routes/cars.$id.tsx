import { ActionFunctionArgs, LoaderFunctionArgs, json } from "@remix-run/node";
import { Link, redirect, useLoaderData, useSearchParams } from "@remix-run/react";
import invariant from "tiny-invariant";
import BookingCard from "~/components/BookingCard";
import CarCarousel from "~/components/Carousel";
import { getSessionUser, requireUser } from "~/modules/auth/auth.server";
import { prisma } from "~/modules/db/db.server";
import { isCarAvailable } from "~/services/cars.server";

export async function action({ request, params }: ActionFunctionArgs) {
  await requireUser(request, {
    redirectTo: `/auth?redirectTo=/cars/${params.id}`,
  });
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const user = await getSessionUser(request);

  invariant(params.id, "Car ID is required");
  const carId = params.id;
  const url = new URL(request.url);

  const fromDate = url.searchParams.get("from");
  const toDate = url.searchParams.get("to");

  // If no fromDate is provided and current time is after 12pm,
  // set default fromDate to tomorrow
  // if (!fromDate) {
  //   const now = new Date();
  //   if (now.getHours() >= 12) {
  //     const tomorrow = new Date();
  //     tomorrow.setDate(tomorrow.getDate() + 1);
  //     fromDate = tomorrow.toISOString().split("T")[0];
  //     // Update the URL with the new fromDate
  //     url.searchParams.set("from", fromDate);
  //     throw redirect(`${url.pathname}${url.search}`);
  //   }
  // }

  let isAvailable = true;

  if (fromDate && toDate) {
    isAvailable = await isCarAvailable(carId, new Date(fromDate), new Date(toDate));
  }

  const car = await prisma.car.findUnique({
    where: { id: carId },
  });

  if (!car) {
    throw redirect("/");
  }

  return json({ car, isAvailable, user });
};

export default function CarDetails() {
  const { car, isAvailable, user } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();

  const carWithDates = {
    ...car,
    createdAt: new Date(car.createdAt),
    updatedAt: new Date(car.updatedAt),
  };

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      <Link
        to={`/?${searchParams.toString()}`}
        className="text-blue-500 hover:underline mb-1 inline-block"
      >
        &larr; Back to search results
      </Link>

      <h2 className="text-2xl sm:text-3xl font-bold mb-4">
        {car.make} {car.model}
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-[70%,30%] gap-4 p-4">
        <div className="flex flex-col gap-4">
          <CarCarousel images={car.images.length > 0 ? car.images : undefined} />

          <div>
            <div className="px-0">
              <h3 className="text-base font-semibold leading-7 text-gray-900">
                Car information and features
              </h3>
            </div>

            <div className="mt-4 border-t border-gray-100">
              <dl className="divide-y divide-gray-100">
                <div className="px-4 py-3 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
                  <dt className="text-sm font-medium leading-6 text-gray-900">Make & Model</dt>
                  <dd className="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0">
                    {car.make} {car.model} {car.year}
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
                  <dd className="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0">
                    Diesel
                  </dd>
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
        </div>

        <div className="lg:sticky lg:top-4">
          <BookingCard car={carWithDates} isAvailable={isAvailable} user={user} />
        </div>
      </div>
    </div>
  );
}
