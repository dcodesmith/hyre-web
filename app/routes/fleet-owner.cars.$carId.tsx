import { data, isRouteErrorResponse, Link, useRouteError } from "react-router";

import { ApiRequestError } from "~/api/api.server";
import { getFleetCar } from "~/api/fleet/cars/cars.server";
import { HTTP_STATUS } from "~/api/http-status";
import { Button } from "~/components/ui/button";
import { FleetCarDetail } from "~/fleet/cars/fleet-car-detail";
import { buildPageMetadata } from "~/seo/metadata";
import type { Route } from "./+types/fleet-owner.cars.$carId";

export const meta = ({ loaderData }: Route.MetaArgs) =>
  buildPageMetadata({
    title: loaderData?.car
      ? `${loaderData.car.year} ${loaderData.car.make} ${loaderData.car.model} | Fleet Cars`
      : "Fleet Car | Tripdly",
    description: "View a car in your Tripdly fleet.",
    path: loaderData?.car ? `/fleet-owner/cars/${loaderData.car.id}` : "/fleet-owner/cars",
    index: false,
  });

export function headers() {
  return { "Cache-Control": "private, no-store" };
}

export async function loader({ request, params }: Route.LoaderArgs) {
  try {
    const { data: car } = await getFleetCar({ request, carId: params.carId });
    return { car };
  } catch (error) {
    if (
      error instanceof ApiRequestError &&
      (error.status === HTTP_STATUS.BAD_REQUEST || error.status === HTTP_STATUS.NOT_FOUND)
    ) {
      throw data(null, { status: HTTP_STATUS.NOT_FOUND });
    }

    throw error;
  }
}

export default function FleetOwnerCarRoute({ loaderData }: Route.ComponentProps) {
  return <FleetCarDetail car={loaderData.car} />;
}

export function ErrorBoundary() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === HTTP_STATUS.NOT_FOUND;

  return (
    <div className="mx-auto flex min-h-80 max-w-lg flex-col items-center justify-center text-center">
      <h2 className="text-xl font-semibold">
        {notFound ? "Car not found" : "Unable to load this car"}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {notFound
          ? "This car is not available in your fleet."
          : "Please return to your cars and try again."}
      </p>
      <Button asChild className="mt-5">
        <Link to="/fleet-owner/cars">Back to cars</Link>
      </Button>
    </div>
  );
}
