import { data } from "react-router";
import { ZodError } from "zod";

import { ApiRequestError } from "~/api/api.server";
import { calculateAirportTripDuration } from "~/api/flights/flights.server";
import { HTTP_STATUS } from "~/api/http-status";
import type { Route } from "./+types/api.calculate-trip-duration";

const NO_STORE = { "Cache-Control": "no-store" };

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);

  try {
    const response = await calculateAirportTripDuration({
      request,
      destination: url.searchParams.get("destination") ?? "",
    });

    return data(
      {
        duration: response.data,
        error: null,
      },
      { headers: NO_STORE },
    );
  } catch (error) {
    if (error instanceof ApiRequestError && error.kind === "aborted") {
      throw error;
    }

    const message =
      error instanceof ZodError
        ? (error.issues[0]?.message ?? "Invalid request")
        : error instanceof ApiRequestError && error.status < HTTP_STATUS.INTERNAL_SERVER_ERROR
          ? error.problem.detail
          : "Unable to estimate the drive. Please try again.";
    const status =
      error instanceof ZodError
        ? HTTP_STATUS.BAD_REQUEST
        : error instanceof ApiRequestError
          ? error.status
          : HTTP_STATUS.BAD_GATEWAY;

    return data({ duration: null, error: message }, { status, headers: NO_STORE });
  }
}
