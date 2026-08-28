import { parseWithZod } from "@conform-to/zod/v4";
import {
  data,
  isRouteErrorResponse,
  Link,
  redirect,
  type ShouldRevalidateFunctionArgs,
  useRouteError,
} from "react-router";

import { ApiRequestError } from "~/api/api.server";
import { getFleetCar, updateFleetCar } from "~/api/fleet/cars/cars.server";
import { HTTP_STATUS } from "~/api/http-status";
import { Button } from "~/components/ui/button";
import { FleetCarEditForm } from "~/fleet/cars/fleet-car-edit-form";
import {
  type FleetCarEditActionData,
  fleetCarEditFormSchema,
} from "~/fleet/cars/fleet-car-edit-form-schema";
import { buildPageMetadata } from "~/seo/metadata";
import type { Route } from "./+types/fleet-owner.cars.$carId.edit";

const NO_STORE = { "Cache-Control": "private, no-store" };

export const meta = ({ loaderData }: Route.MetaArgs) =>
  buildPageMetadata({
    title: loaderData?.car
      ? `Edit ${loaderData.car.year} ${loaderData.car.make} ${loaderData.car.model} | Fleet Cars`
      : "Edit Fleet Car | Tripdly",
    description: "Update the pricing and settings for a car in your Tripdly fleet.",
    path: loaderData?.car ? `/fleet-owner/cars/${loaderData.car.id}/edit` : "/fleet-owner/cars",
    index: false,
  });

export function headers() {
  return NO_STORE;
}

function isCarNotFound(error: unknown) {
  return error instanceof ApiRequestError && error.status === HTTP_STATUS.NOT_FOUND;
}

export async function loader({ request, params }: Route.LoaderArgs) {
  try {
    const { data: car } = await getFleetCar({ request, carId: params.carId });
    return {
      car: {
        id: car.id,
        make: car.make,
        model: car.model,
        year: car.year,
        registrationNumber: car.registrationNumber,
        status: car.status,
        hourlyRate: car.hourlyRate,
        dayRate: car.dayRate,
        nightRate: car.nightRate,
        fuelUpgradeRate: car.fuelUpgradeRate,
        fullDayRate: car.fullDayRate,
        airportPickupRate: car.airportPickupRate,
        vehicleType: car.vehicleType,
        serviceTier: car.serviceTier,
        passengerCapacity: car.passengerCapacity,
        pricingIncludesFuel: car.pricingIncludesFuel,
      },
    };
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

export async function action({ request, params }: Route.ActionArgs) {
  const submission = parseWithZod(await request.formData(), {
    schema: fleetCarEditFormSchema,
  });

  if (submission.status !== "success") {
    return data<FleetCarEditActionData>(
      { revalidate: false, submission: submission.reply() },
      { status: HTTP_STATUS.BAD_REQUEST, headers: NO_STORE },
    );
  }

  try {
    await updateFleetCar({
      request,
      carId: params.carId,
      body: submission.value,
    });
    return redirect(`/fleet-owner/cars/${params.carId}`, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof ApiRequestError && error.kind === "aborted") {
      throw error;
    }

    if (isCarNotFound(error)) {
      throw data(null, { status: HTTP_STATUS.NOT_FOUND, headers: NO_STORE });
    }

    const message =
      error instanceof ApiRequestError && error.status < HTTP_STATUS.INTERNAL_SERVER_ERROR
        ? error.problem.detail
        : "Failed to update this car. Please try again.";
    const status = error instanceof ApiRequestError ? error.status : HTTP_STATUS.BAD_GATEWAY;

    return data<FleetCarEditActionData>(
      {
        revalidate: false,
        submission: submission.reply({ formErrors: [message] }),
      },
      { status, headers: NO_STORE },
    );
  }
}

export function shouldRevalidate({
  actionResult,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if ((actionResult as FleetCarEditActionData | undefined)?.revalidate === false) {
    return false;
  }

  return defaultShouldRevalidate;
}

export default function FleetOwnerCarEditRoute({ actionData, loaderData }: Route.ComponentProps) {
  return <FleetCarEditForm actionData={actionData} car={loaderData.car} />;
}

export function ErrorBoundary() {
  const error = useRouteError();
  const isNotFound = isRouteErrorResponse(error) && error.status === HTTP_STATUS.NOT_FOUND;

  return (
    <div className="mx-auto flex min-h-80 max-w-lg flex-col items-center justify-center text-center">
      <h2 className="text-xl font-semibold">
        {isNotFound ? "Car not found" : "Unable to edit this car"}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {isNotFound
          ? "This car is not available in your fleet."
          : "Please return to your cars and try again."}
      </p>
      <Button asChild className="mt-5">
        <Link to="/fleet-owner/cars">Back to cars</Link>
      </Button>
    </div>
  );
}
