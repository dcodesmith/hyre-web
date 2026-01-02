/**
 * Custom error classes with HTTP status codes
 * These errors carry semantic meaning and appropriate HTTP status codes
 * for proper API error responses.
 */

/**
 * Base class for HTTP errors
 */
export abstract class HttpError extends Error {
  abstract statusCode: number;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace?.(this, this.constructor);
  }
}

/**
 * 400 Bad Request - Client validation or business rule violation
 * Use for: invalid input, business rule violations, state conflicts
 */
export class BadRequestError extends HttpError {
  statusCode = 400;
}

/**
 * 401 Unauthorized - Authentication required
 * Use for: missing or invalid authentication credentials
 */
export class UnauthorizedError extends HttpError {
  statusCode = 401;
}

/**
 * 403 Forbidden - Authenticated but not authorized
 * Use for: insufficient permissions, ownership violations
 */
export class ForbiddenError extends HttpError {
  statusCode = 403;
}

/**
 * 404 Not Found - Resource doesn't exist
 * Use for: entity not found in database
 */
export class NotFoundError extends HttpError {
  statusCode = 404;
}

/**
 * 409 Conflict - Request conflicts with current state
 * Use for: duplicate resources, race conditions
 */
export class ConflictError extends HttpError {
  statusCode = 409;
}

/**
 * Type guard to check if error is an HttpError
 */
export function isHttpError(error: unknown): error is HttpError {
  return error instanceof HttpError;
}

/**
 * Get HTTP status code from error, defaulting to 500 for unknown errors
 */
export function getErrorStatus(error: unknown): number {
  if (isHttpError(error)) {
    return error.statusCode;
  }
  return 500;
}

/**
 * Get error message safely from any error type
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown error";
}
