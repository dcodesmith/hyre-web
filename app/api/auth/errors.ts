import { ApiRequestError } from "../api.server";
import { HTTP_STATUS } from "../http-status";

export function authClientErrorStatus(error: unknown) {
  if (error instanceof ApiRequestError && error.status === 429) {
    return 429;
  }

  if (error instanceof ApiRequestError && error.status >= HTTP_STATUS.INTERNAL_SERVER_ERROR) {
    return HTTP_STATUS.BAD_GATEWAY;
  }

  return HTTP_STATUS.BAD_REQUEST;
}

export function authClientErrorMessage(error: unknown) {
  if (!(error instanceof ApiRequestError) || error.status >= 500) {
    return "Something went wrong. Please try again.";
  }

  if (error.status === 403) {
    return "We couldn't start the login process. Please check your details and try again.";
  }

  if (error.status === 429) {
    const retryAfter = error.headers.get("x-retry-after") ?? error.headers.get("retry-after");

    return retryAfter
      ? `Too many attempts. Try again in ${retryAfter} seconds.`
      : "Too many attempts. Please try again shortly.";
  }

  return error.problem.detail;
}
