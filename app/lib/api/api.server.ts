import type { z } from "zod";

import {
  normalizeProblemDetails,
  type ProblemDetails,
} from "./problem-details";
import { HTTP_STATUS } from "./http-status";

const DEFAULT_TIMEOUT_MS = 10_000;
const TRACE_HEADERS = [
  "x-request-id",
  "traceparent",
  "tracestate",
  "baggage",
] as const;

export type ApiRequestErrorKind =
  | "aborted"
  | "contract"
  | "http"
  | "network"
  | "timeout";

export class ApiRequestError extends Error {
  readonly name = "ApiRequestError";

  constructor(
    readonly kind: ApiRequestErrorKind,
    readonly status: number,
    readonly problem: ProblemDetails,
    readonly headers = new Headers(),
  ) {
    super(problem.detail);
  }
}

export type ApiResponse<T> = {
  data: T;
  status: number;
  headers: Headers;
};

export type ApiClientOptions = {
  apiOrigin: string;
  defaultTimeoutMs?: number;
  fetchImpl?: typeof fetch;
};

export type ApiRequestOptions<TSchema extends z.ZodType> = {
  path: string;
  schema: TSchema;
  method?: "DELETE" | "GET" | "PATCH" | "POST" | "PUT";
  request?: Request;
  headers?: HeadersInit;
  json?: unknown;
  timeoutMs?: number;
  forwardCookie?: boolean;
  forwardOrigin?: boolean;
};

export function createApiClient({
  apiOrigin,
  defaultTimeoutMs = DEFAULT_TIMEOUT_MS,
  fetchImpl = fetch,
}: ApiClientOptions) {
  const origin = normalizeApiOrigin(apiOrigin);

  return {
    async request<TSchema extends z.ZodType>(
      options: ApiRequestOptions<TSchema>,
    ): Promise<ApiResponse<z.output<TSchema>>> {
      const url = buildApiUrl(origin, options.path);
      const hasJsonBody = options.json !== undefined;
      const method = options.method ?? (hasJsonBody ? "POST" : "GET");

      if (hasJsonBody && (method === "GET" || method === "DELETE")) {
        throw new TypeError(`${method} requests cannot include a JSON body`);
      }

      const timeoutMs = options.timeoutMs ?? defaultTimeoutMs;
      const abort = createAbortContext(options.request?.signal, timeoutMs);
      const headers = buildHeaders(options, hasJsonBody);

      let response: Response;

      try {
        response = await fetchImpl(url, {
          method,
          headers,
          body: hasJsonBody ? JSON.stringify(options.json) : undefined,
          signal: abort.signal,
          redirect: "manual",
        });
      } catch {
        abort.cleanup();

        if (abort.didTimeout()) {
          throw localApiError(
            "timeout",
            HTTP_STATUS.GATEWAY_TIMEOUT,
            "UPSTREAM_TIMEOUT",
            "Upstream API timeout",
            "The upstream API did not respond before the request timed out.",
            options.path,
          );
        }

        if (options.request?.signal.aborted) {
          throw localApiError(
            "aborted",
            HTTP_STATUS.CLIENT_CLOSED_REQUEST,
            "REQUEST_ABORTED",
            "Request aborted",
            "The request was cancelled before the upstream API responded.",
            options.path,
          );
        }

        throw localApiError(
          "network",
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          "UPSTREAM_UNAVAILABLE",
          "Upstream API unavailable",
          "The upstream API could not be reached.",
          options.path,
        );
      }

      abort.cleanup();

      const body = await readResponseBody(response);
      const responseHeaders = new Headers(response.headers);

      if (!response.ok) {
        const title = response.statusText || "Upstream request failed";
        const problem = normalizeProblemDetails(body, {
          status: response.status,
          title,
          detail: title,
          instance: options.path,
        });

        throw new ApiRequestError(
          "http",
          response.status,
          problem,
          responseHeaders,
        );
      }

      const parsed = await options.schema.safeParseAsync(body);

      if (!parsed.success) {
        throw new ApiRequestError(
          "contract",
          HTTP_STATUS.BAD_GATEWAY,
          {
            type: "UPSTREAM_INVALID_RESPONSE",
            title: "Invalid upstream response",
            status: HTTP_STATUS.BAD_GATEWAY,
            detail: "The upstream API returned an unexpected response shape.",
            instance: options.path,
            details: {
              issues: parsed.error.issues.map((issue) => ({
                code: issue.code,
                path: issue.path.join("."),
                message: issue.message,
              })),
            },
          },
          responseHeaders,
        );
      }

      return {
        data: parsed.data,
        status: response.status,
        headers: responseHeaders,
      };
    },
  };
}

function normalizeApiOrigin(value: string) {
  const url = new URL(value);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new TypeError("API_ORIGIN must use http or https");
  }

  if (
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new TypeError(
      "API_ORIGIN must not include credentials, path, query, or hash",
    );
  }

  return url.origin;
}

function buildApiUrl(origin: string, path: string) {
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new TypeError("API paths must be root-relative");
  }

  const url = new URL(path, origin);

  if (url.origin !== origin || url.hash) {
    throw new TypeError("API paths must stay within API_ORIGIN");
  }

  return url;
}

function buildHeaders<TSchema extends z.ZodType>(
  options: ApiRequestOptions<TSchema>,
  hasJsonBody: boolean,
) {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");

  if (hasJsonBody) {
    headers.set("Content-Type", "application/json");
  } else {
    headers.delete("Content-Type");
  }

  const incomingHeaders = options.request?.headers;

  if (!incomingHeaders) {
    return headers;
  }

  for (const name of TRACE_HEADERS) {
    copyHeader(incomingHeaders, headers, name);
  }

  if (options.forwardCookie) {
    copyHeader(incomingHeaders, headers, "cookie");
  }

  if (options.forwardOrigin) {
    copyHeader(incomingHeaders, headers, "origin");
  }

  return headers;
}

function copyHeader(source: Headers, destination: Headers, name: string) {
  const value = source.get(name);

  if (value) {
    destination.set(name, value);
  }
}

function createAbortContext(requestSignal: AbortSignal | undefined, timeoutMs: number) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError("API timeout must be a positive finite number");
  }

  const controller = new AbortController();
  let timedOut = false;

  const forwardAbort = () => {
    controller.abort(requestSignal?.reason);
  };

  if (requestSignal?.aborted) {
    forwardAbort();
  } else {
    requestSignal?.addEventListener("abort", forwardAbort, { once: true });
  }

  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort(new DOMException("Upstream API timeout", "TimeoutError"));
  }, timeoutMs);

  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    cleanup() {
      clearTimeout(timeout);
      requestSignal?.removeEventListener("abort", forwardAbort);
    },
  };
}

async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return undefined;
  }

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  const isJson = contentType.includes("application/json") || contentType.includes("+json");

  if (!isJson) {
    return text;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function localApiError(
  kind: ApiRequestErrorKind,
  status: number,
  type: string,
  title: string,
  detail: string,
  instance: string,
) {
  return new ApiRequestError(kind, status, {
    type,
    title,
    status,
    detail,
    instance,
  });
}
