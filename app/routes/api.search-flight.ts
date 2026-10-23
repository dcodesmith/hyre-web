import { data } from "react-router";
import { ZodError } from "zod";

import { ApiRequestError } from "~/api/api.server";
import { searchAirportPickupFlight } from "~/api/flights/flights.server";
import { HTTP_STATUS } from "~/api/http-status";
import type { Route } from "./+types/api.search-flight";

const NO_STORE = { "Cache-Control": "no-store" };

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);

  try {
    const response = await searchAirportPickupFlight({
      request,
      flightNumber: url.searchParams.get("flightNumber") ?? "",
      date: url.searchParams.get("date") ?? "",
    });

    return data(
      {
        flight: response.data.flight,
        warning: response.data.warning ?? null,
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
          : "Unable to look up that flight. Please try again.";
    const status =
      error instanceof ZodError
        ? HTTP_STATUS.BAD_REQUEST
        : error instanceof ApiRequestError
          ? error.status
          : HTTP_STATUS.BAD_GATEWAY;

    return data({ flight: null, warning: null, error: message }, { status, headers: NO_STORE });
  }
}
