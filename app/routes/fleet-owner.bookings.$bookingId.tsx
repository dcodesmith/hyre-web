import {
  data,
  isRouteErrorResponse,
  Link,
  type ShouldRevalidateFunctionArgs,
  useNavigation,
  useRevalidator,
  useRouteError,
} from "react-router";
import { z } from "zod";
import { ApiRequestError } from "~/api/api.server";
import { assignFleetBookingChauffeur, getFleetBooking } from "~/api/fleet/bookings/bookings.server";
import { HTTP_STATUS } from "~/api/http-status";
import { Button } from "~/components/ui/button";
import {
  type FleetBookingAssignmentActionData,
  FleetOwnerBookingDetail,
} from "~/fleet/fleet-owner-booking-detail";
import { fleetOwnerContext } from "~/fleet/fleet-owner-context";
import { buildPageMetadata } from "~/seo/metadata";
import type { Route } from "./+types/fleet-owner.bookings.$bookingId";

const NO_STORE = { "Cache-Control": "private, no-store" };
const assignmentSchema = z.object({ chauffeurId: z.uuid() });

export const meta = ({ loaderData }: Route.MetaArgs) =>
  buildPageMetadata({
    title: loaderData
      ? `${loaderData.booking.bookingReference} | Fleet Booking | Tripdly`
      : "Fleet Booking | Tripdly",
    description: "Review a fleet booking and assign its chauffeur.",
    path: loaderData ? `/fleet-owner/bookings/${loaderData.booking.id}` : "/fleet-owner/bookings",
    index: false,
  });

export function headers() {
  return NO_STORE;
}

function bookingId(params: Route.LoaderArgs["params"] | Route.ActionArgs["params"]) {
  const parsed = z.uuid().safeParse(params.bookingId);
  if (!parsed.success) {
    throw data(null, { status: HTTP_STATUS.NOT_FOUND, headers: NO_STORE });
  }
  return parsed.data;
}

export async function loader({ context, params, request }: Route.LoaderArgs) {
  try {
    const response = await getFleetBooking({ request, bookingId: bookingId(params) });
    return {
      ...response.data,
      isOwnerDriver: context.get(fleetOwnerContext).onboarding.isOwnerDriver === true,
    };
  } catch (error) {
    if (
      error instanceof ApiRequestError &&
      (error.status === HTTP_STATUS.BAD_REQUEST || error.status === HTTP_STATUS.NOT_FOUND)
    ) {
      throw data(null, { status: HTTP_STATUS.NOT_FOUND, headers: NO_STORE });
    }
    throw error;
  }
}

export async function action({ params, request }: Route.ActionArgs) {
  const id = bookingId(params);
  const parsed = assignmentSchema.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success) {
    return data<FleetBookingAssignmentActionData>(
      { error: "Select a chauffeur before continuing." },
      { status: HTTP_STATUS.BAD_REQUEST, headers: NO_STORE },
    );
  }

  try {
    await assignFleetBookingChauffeur({
      request,
      bookingId: id,
      chauffeurId: parsed.data.chauffeurId,
    });
    return data<FleetBookingAssignmentActionData>({ success: true }, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof ApiRequestError && error.kind === "aborted") {
      throw error;
    }
    return data<FleetBookingAssignmentActionData>(
      {
        error:
          error instanceof ApiRequestError && error.status < HTTP_STATUS.INTERNAL_SERVER_ERROR
            ? error.problem.detail
            : "Unable to assign this chauffeur. Please try again.",
      },
      {
        status: error instanceof ApiRequestError ? error.status : HTTP_STATUS.BAD_GATEWAY,
        headers: NO_STORE,
      },
    );
  }
}

export function shouldRevalidate({
  actionResult,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  return actionResult && typeof actionResult === "object" && "error" in actionResult
    ? true
    : defaultShouldRevalidate;
}

export default function FleetOwnerBookingRoute({ actionData, loaderData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const isSubmitting =
    navigation.formMethod === "POST" && navigation.formData?.has("chauffeurId") === true;

  return (
    <FleetOwnerBookingDetail
      actionData={actionData}
      detail={loaderData}
      isSubmitting={isSubmitting}
    />
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const revalidator = useRevalidator();
  const isNotFound = isRouteErrorResponse(error) && error.status === HTTP_STATUS.NOT_FOUND;

  return (
    <div className="mx-auto flex min-h-80 max-w-lg flex-col items-center justify-center text-center">
      <h2 className="text-xl font-semibold">
        {isNotFound ? "Booking not found" : "Unable to load this booking"}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {isNotFound ? "It may not exist or may not belong to your fleet." : "Please try again."}
      </p>
      {isNotFound ? (
        <Button asChild className="mt-5">
          <Link to="/fleet-owner/bookings">Back to bookings</Link>
        </Button>
      ) : (
        <Button
          type="button"
          className="mt-5"
          disabled={revalidator.state !== "idle"}
          onClick={() => revalidator.revalidate()}
        >
          {revalidator.state === "idle" ? "Retry" : "Retrying…"}
        </Button>
      )}
    </div>
  );
}
