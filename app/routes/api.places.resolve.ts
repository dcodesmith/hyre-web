import { data } from "react-router";
import { ZodError } from "zod";

import { ApiRequestError } from "~/api/api.server";
import { HTTP_STATUS } from "~/api/http-status";
import { resolvePlace } from "~/api/places/places.server";
import type { Route } from "./+types/api.places.resolve";

const NO_STORE = { "Cache-Control": "no-store" };

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();

  try {
    const response = await resolvePlace({
      request,
      placeId: String(form.get("placeId") ?? ""),
      sessionToken: String(form.get("sessionToken") ?? "") || undefined,
    });

    return data(
      {
        placeId: response.data.placeId,
        address: response.data.address,
        error: null,
      },
      { headers: NO_STORE },
    );
  } catch (error) {
    if (error instanceof ApiRequestError && error.kind === "aborted") {
      throw error;
    }

    if (
      error instanceof ZodError ||
      (error instanceof ApiRequestError && error.status < HTTP_STATUS.INTERNAL_SERVER_ERROR)
    ) {
      return data(
        {
          placeId: null,
          address: null,
          error:
            error instanceof ZodError
              ? (error.issues[0]?.message ?? "Invalid request")
              : error.problem.detail,
        },
        {
          status: error instanceof ZodError ? HTTP_STATUS.BAD_REQUEST : error.status,
          headers: NO_STORE,
        },
      );
    }

    throw error;
  }
}
