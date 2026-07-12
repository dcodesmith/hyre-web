import { data } from "react-router";
import logger from "~/lib/logger.server";
import { csrf, CSRFError } from "~/utils/csrf.server";

export async function validateCSRF(request: Request) {
  try {
    // Some callers POST with the token in an X-CSRF-Token header and no form
    // body (e.g. fetch-based approve/reject buttons). request.formData() would
    // throw on those, so bridge the header token into remix-utils' FormData +
    // headers validation path (cookie read from headers, token from the field).
    const headerToken = request.headers.get("X-CSRF-Token");
    if (headerToken) {
      const formData = new FormData();
      formData.set("csrf", headerToken);
      await csrf.validate(formData, request.headers);
    } else {
      await csrf.validate(request);
    }
  } catch (error) {
    if (error instanceof CSRFError) {
      logger.error(`CSRF validation failed: ${error.message}`);
      throw data(
        { error: "Invalid CSRF token" },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      );
    }

    throw error;
  }
}
