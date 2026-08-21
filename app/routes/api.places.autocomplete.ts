import { data } from "react-router";
import { ZodError } from "zod";

import { ApiRequestError } from "~/api/api.server";
import { autocompletePlaces } from "~/api/places/places.server";
import type { Route } from "./+types/api.places.autocomplete";

const NO_STORE = { "Cache-Control": "no-store" };

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);

  try {
    const response = await autocompletePlaces({
      request,
      input: url.searchParams.get("input") ?? "",
      sessionToken: url.searchParams.get("sessionToken") || undefined,
    });

    return data(
      {
        suggestions: response.data.suggestions,
        degraded: response.data.meta?.degraded === true,
        error: null,
      },
      { headers: NO_STORE },
    );
  } catch (error) {
    if (error instanceof ApiRequestError && error.kind === "aborted") {
      throw error;
    }

    if (error instanceof ZodError || (error instanceof ApiRequestError && error.status < 500)) {
      return data(
        { suggestions: [], degraded: false, error: resourceErrorMessage(error) },
        { status: error instanceof ZodError ? 400 : error.status, headers: NO_STORE },
      );
    }

    throw error;
  }
}

function resourceErrorMessage(error: ZodError | ApiRequestError) {
  return error instanceof ZodError
    ? (error.issues[0]?.message ?? "Invalid request")
    : error.problem.detail;
}
