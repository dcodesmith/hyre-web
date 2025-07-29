import logger from "~/lib/logger.server";
import { csrf, CSRFError } from "~/utils/csrf.server";

export async function validateCSRF(request: Request) {
  try {
    await csrf.validate(request);
  } catch (error) {
    if (error instanceof CSRFError) {
      logger.error(`CSRF validation failed: ${error.message}`);
      throw new Response("Invalid CSRF token", { status: 403 });
    }
    throw error;
  }
}
