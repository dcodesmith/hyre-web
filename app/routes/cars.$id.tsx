import { ActionFunctionArgs, json, LoaderFunctionArgs } from "@remix-run/node";
import {
  Link,
  redirect,
  useLoaderData,
  useSearchParams,
} from "@remix-run/react";
import { lazy, Suspense } from "react";
import invariant from "tiny-invariant";
import CarCarousel from "~/components/Carousel";
import { requireUser } from "~/modules/auth/auth.server";
import { prisma } from "~/modules/db/db.server";
import { createBooking } from "~/services/bookings.server";
import { isCarAvailable } from "~/services/cars.server";

const BookingCard = lazy(() => import("~/components/BookingCard"));

export async function action({ request, params }: ActionFunctionArgs) {
  const user = await requireUser(request, {
    redirectTo: `/auth?redirectTo=/cars/${params.id}`,
  });

  invariant(params.id, "Car ID is required");

  const url = new URL(request.url);
  const startDate = url.searchParams.get("from");
  const endDate = url.searchParams.get("to");

  invariant(startDate, "From Date is required");
  invariant(endDate, "To Date is required");

  const formData = await request.formData();

  // TODO:for security reasons, we need to do another validation to check that booking is still available
  // because the user might have changed the dates in the form

  // const startDate = new Date(String(formData.get("startDate")));
  // const endDate = new Date(String(formData.get("endDate")));
  const street = String(formData.get("street"));
  const locality = String(formData.get("locality"));
  const sameLocation = formData.get("sameLocation");
  const pickupTime = String(formData.get("pickupTime"));
  const dropStreet = String(formData.get("dropStreet"));
  const dropLocality = String(formData.get("dropLocality"));

  // Parse the time from pickupTime (e.g. "8:00 AM") and set it on startDate
  const [time, period] = pickupTime.split(" ");
  const [hours, minutes] = time.split(":");
  const startDateTime = new Date(startDate);

  // Convert 12-hour format to 24-hour
  let hour = parseInt(hours);

  if (period === "PM" && hour !== 12) {
    hour += 12;
  }

  startDateTime.setHours(hour);
  startDateTime.setMinutes(parseInt(minutes));
  startDateTime.setSeconds(0);
  startDateTime.setMilliseconds(0);

  // Set end date time to 12 hours after start time
  const endDateTime = new Date(endDate);
  endDateTime.setHours(startDateTime.getHours() + 12);
  endDateTime.setMinutes(startDateTime.getMinutes());
  endDateTime.setSeconds(0);
  endDateTime.setMilliseconds(0);

  const pickupLocation = `${street}, ${locality}`;
  const returnLocation = sameLocation
    ? pickupLocation
    : `${dropStreet}, ${dropLocality}`;

  try {
    const booking = await createBooking({
      startDate: startDateTime,
      endDate: endDateTime,
      carId: params.id,
      userId: user.id,
      pickupLocation,
      returnLocation,
    });

    // return redirect(`/dashboard?bookingId=${booking.id}`);
    return json({ booking });
  } catch (error) {
    return json({ success: false, error: "Booking failed" }, { status: 400 });
  }
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
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
    isAvailable = await isCarAvailable(
      carId,
      new Date(fromDate),
      new Date(toDate)
    );
  }

  const car = await prisma.car.findUnique({
    where: { id: carId },
  });

  if (!car) {
    throw redirect("/");
  }

  // console.log(util.inspect(car, { depth: null, colors: true, compact: false }));

  return json({ car, isAvailable });
};

export default function CarDetails() {
  const { car, isAvailable } = useLoaderData<typeof loader>();
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

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6">
        <div className="col-span-1 lg:col-span-2">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">
            {car.make} {car.model}
          </h2>

          <CarCarousel
            images={car.images.length > 0 ? car.images : undefined}
          />
        </div>

        <div className="order-3 lg:order-2">
          <div className="px-0">
            <h3 className="text-base font-semibold leading-7 text-gray-900">
              Car information and features
            </h3>
          </div>

          <div className="mt-4 border-t border-gray-100">
            <dl className="divide-y divide-gray-100">
              <div className="px-4 py-3 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
                <dt className="text-sm font-medium leading-6 text-gray-900">
                  Make & Model
                </dt>
                <dd className="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0">
                  {car.make} {car.model} {car.year}
                </dd>
              </div>

              <div className="px-4 py-3 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
                <dt className="text-sm font-medium leading-6 text-gray-900">
                  Features
                </dt>
                <dd className="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0">
                  Air conditioning, GPS navigation system, Bluetooth
                  connectivity, Cruise control, Rear-view camera, USB ports
                </dd>
              </div>

              <div className="px-4 py-3 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
                <dt className="text-sm font-medium leading-6 text-gray-900">
                  Transmission Type
                </dt>
                <dd className="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0">
                  Automatic
                </dd>
              </div>

              <div className="px-4 py-3 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
                <dt className="text-sm font-medium leading-6 text-gray-900">
                  Fuel Type
                </dt>
                <dd className="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0">
                  Diesel
                </dd>
              </div>

              <div className="px-4 py-3 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
                <dt className="text-sm font-medium leading-6 text-gray-900">
                  Seating Capacity
                </dt>
                <dd className="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0">
                  7-seater
                </dd>
              </div>
              <div className="px-4 py-3 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
                <dt className="text-sm font-medium leading-6 text-gray-900">
                  Fuel Policy
                </dt>
                <dd className="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0">
                  &quot;Full to Full&quot; (return the car with a full tank)
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <Suspense fallback={<div>Loading...</div>}>
          <div className="order-2 lg:order-3">
            <BookingCard car={carWithDates} isAvailable={isAvailable} />
          </div>
        </Suspense>
      </div>
    </div>
  );
}
