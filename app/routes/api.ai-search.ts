import { data, redirect } from "react-router";
import { ZodError } from "zod";

import { searchWithAi } from "~/api/ai-search/ai-search.server";
import { ApiRequestError } from "~/api/api.server";
import { HTTP_STATUS } from "~/api/http-status";
import { buildSearchPath, parseSearchUrl, serializeSearchUrl } from "~/search/search-url";
import type { Route } from "./+types/api.ai-search";

const NO_STORE = { "Cache-Control": "no-store" };

export async function action({ request }: Route.ActionArgs) {
  try {
    const form = await request.formData();
    const response = await searchWithAi({
      request,
      query: String(form.get("query") ?? ""),
    });

    return redirect(
      buildSearchPath(
        serializeSearchUrl(parseSearchUrl(new URLSearchParams(response.data.params))),
      ),
      { headers: NO_STORE },
    );
  } catch (error) {
    if (error instanceof ApiRequestError && error.kind === "aborted") {
      throw error;
    }

    if (error instanceof ZodError) {
      return data(
        { error: error.issues[0]?.message ?? "Invalid request" },
        { status: HTTP_STATUS.BAD_REQUEST, headers: NO_STORE },
      );
    }

    if (error instanceof ApiRequestError) {
      return data({ error: error.problem.detail }, { status: error.status, headers: NO_STORE });
    }

    throw error;
  }
}
