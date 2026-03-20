import { data } from "react-router";
import logger from "~/lib/logger.server";
import { csrf, CSRFError } from "~/utils/csrf.server";

export async function validateCSRF(request: Request) {
  try {
    await csrf.validate(request);
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
