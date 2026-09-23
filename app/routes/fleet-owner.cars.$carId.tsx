import {
  data,
  isRouteErrorResponse,
  Link,
  type ShouldRevalidateFunctionArgs,
  useRouteError,
  useRouteLoaderData,
} from "react-router";

import { ApiRequestError } from "~/api/api.server";
import {
  getFleetCar,
  replaceFleetCarDocument,
  replaceFleetCarImage,
} from "~/api/fleet/cars/cars.server";
import { HTTP_STATUS } from "~/api/http-status";
import { Button } from "~/components/ui/button";
import { FleetCarDetail } from "~/fleet/cars/fleet-car-detail";
import {
  type FleetCarFileReplacementActionData,
  fleetCarFileReplacementFormSchema,
} from "~/fleet/cars/fleet-car-file-replacement-form-schema";
import { fleetOwnerContext } from "~/fleet/fleet-owner-context";
import { buildPageMetadata } from "~/seo/metadata";
import type { Route } from "./+types/fleet-owner.cars.$carId";
import type { FleetOwnerOutletContext } from "./fleet-owner";

const NO_STORE = { "Cache-Control": "private, no-store" };

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
  return NO_STORE;
}

export async function loader({ context, params, request }: Route.LoaderArgs) {
  try {
    const { data: car } = await getFleetCar({ request, carId: params.carId });
    return {
      car,
      isOwnerDriver: context.get(fleetOwnerContext).onboarding.isOwnerDriver === true,
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
  const formData = await request.formData();
  const submission = fleetCarFileReplacementFormSchema.safeParse({
    intent: formData.get("intent"),
    assetId: formData.get("assetId"),
    file: formData.get("file"),
  });

  if (!submission.success) {
    return data<FleetCarFileReplacementActionData>(
      {
        error: submission.error.issues[0]?.message ?? "Invalid replacement file",
        revalidate: false,
      },
      { status: HTTP_STATUS.BAD_REQUEST, headers: NO_STORE },
    );
  }

  try {
    if (submission.data.intent === "replace-image") {
      await replaceFleetCarImage({
        request,
        carId: params.carId,
        imageId: submission.data.assetId,
        file: submission.data.file,
      });
    } else {
      await replaceFleetCarDocument({
        request,
        carId: params.carId,
        documentId: submission.data.assetId,
        file: submission.data.file,
      });
    }

    return data<FleetCarFileReplacementActionData>({ success: true }, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof ApiRequestError && error.kind === "aborted") {
      throw error;
    }

    const message =
      error instanceof ApiRequestError && error.status < HTTP_STATUS.INTERNAL_SERVER_ERROR
        ? error.problem.detail
        : "Failed to upload the replacement file. Please try again.";
    const status = error instanceof ApiRequestError ? error.status : HTTP_STATUS.BAD_GATEWAY;

    return data<FleetCarFileReplacementActionData>(
      { error: message },
      { status, headers: NO_STORE },
    );
  }
}

export function shouldRevalidate({
  actionResult,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if ((actionResult as FleetCarFileReplacementActionData | undefined)?.revalidate === false) {
    return false;
  }

  return defaultShouldRevalidate;
}

export default function FleetOwnerCarRoute({ loaderData }: Route.ComponentProps) {
  return (
    <FleetCarDetail
      backHref={loaderData.isOwnerDriver ? null : "/fleet-owner/cars"}
      car={loaderData.car}
    />
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const parent = useRouteLoaderData<FleetOwnerOutletContext>("routes/fleet-owner");
  const notFound = isRouteErrorResponse(error) && error.status === HTTP_STATUS.NOT_FOUND;
  const backTo = parent?.onboarding.isOwnerDriver ? "/fleet-owner" : "/fleet-owner/cars";

  return (
    <div className="mx-auto flex min-h-80 max-w-lg flex-col items-center justify-center text-center">
      <h2 className="text-xl font-semibold">
        {notFound ? "Car not found" : "Unable to load this car"}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {notFound
          ? "This car is not available in your fleet."
          : parent?.onboarding.isOwnerDriver
            ? "Please return to your dashboard and try again."
            : "Please return to your cars and try again."}
      </p>
      <Button asChild className="mt-5">
        <Link to={backTo}>
          {parent?.onboarding.isOwnerDriver ? "Back to dashboard" : "Back to cars"}
        </Link>
      </Button>
    </div>
  );
}
