import type { z } from "zod";
import { HTTP_STATUS } from "./http-status";
import { normalizeProblemDetails, type ProblemDetails } from "./problem-details";

const DEFAULT_TIMEOUT_MS = 10_000;
const TRACE_HEADERS = ["x-request-id", "traceparent", "tracestate", "baggage"] as const;

export type ApiRequestErrorKind = "aborted" | "contract" | "http" | "network" | "timeout";

export class ApiRequestError extends Error {
  readonly name = "ApiRequestError";

  constructor(
    readonly kind: ApiRequestErrorKind,
    readonly status: number,
    readonly problem: ProblemDetails,
    readonly headers = new Headers(),
    cause?: unknown,
  ) {
    super(problem.detail, { cause });
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

type ApiFetchOptions = {
  path: string;
  method?: "DELETE" | "GET" | "PATCH" | "POST" | "PUT";
  request?: Request;
  headers?: HeadersInit;
  formData?: FormData;
  json?: unknown;
  timeoutMs?: number;
  forwardCookie?: boolean;
  forwardOrigin?: boolean;
};

export type ApiRequestOptions<TSchema extends z.ZodType> = ApiFetchOptions & {
  schema: TSchema;
};

export function createApiClient({
  apiOrigin,
  defaultTimeoutMs = DEFAULT_TIMEOUT_MS,
  fetchImpl = fetch,
}: ApiClientOptions) {
  const origin = normalizeApiOrigin(apiOrigin);

  async function send(options: ApiFetchOptions, readBody: boolean) {
    const url = buildApiUrl(origin, options.path);
    const hasFormDataBody = options.formData !== undefined;
    const hasJsonBody = options.json !== undefined;
    const hasRequestBody = hasFormDataBody || hasJsonBody;
    const method = options.method ?? (hasRequestBody ? "POST" : "GET");

    if (hasFormDataBody && hasJsonBody) {
      throw new TypeError("API requests cannot include both JSON and multipart bodies");
    }

    if (hasRequestBody && (method === "GET" || method === "DELETE")) {
      throw new TypeError(`${method} requests cannot include a body`);
    }

    const timeoutMs = options.timeoutMs ?? defaultTimeoutMs;
    const headers = buildHeaders(options, hasJsonBody);
    const requestBody = hasJsonBody ? JSON.stringify(options.json) : options.formData;
    const abort = createAbortContext(options.request?.signal, timeoutMs);

    let response: Response;
    let responseBody: unknown;
    let keepAbortAlive = false;

    try {
      response = await fetchImpl(url, {
        method,
        headers,
        body: requestBody,
        signal: abort.signal,
        redirect: "manual",
      });
      if (readBody || !response.ok) {
        responseBody = await readResponseBody(response);
      } else {
        keepAbortAlive = true;
      }
    } catch (cause) {
      if (abort.didTimeout()) {
        throw localApiError(
          "timeout",
          HTTP_STATUS.GATEWAY_TIMEOUT,
          "UPSTREAM_TIMEOUT",
          "Upstream API timeout",
          "The upstream API response did not complete before the request timed out.",
          options.path,
          cause,
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
          cause,
        );
      }

      throw localApiError(
        "network",
        HTTP_STATUS.SERVICE_UNAVAILABLE,
        "UPSTREAM_UNAVAILABLE",
        "Upstream API unavailable",
        "The upstream API response could not be completed.",
        options.path,
        cause,
      );
    } finally {
      if (!keepAbortAlive) {
        abort.cleanup();
      }
    }

    if (!response.ok) {
      const title = response.statusText || "Upstream request failed";
      const problem = normalizeProblemDetails(responseBody, {
        status: response.status,
        title,
        detail: title,
        instance: options.path,
      });

      throw new ApiRequestError("http", response.status, problem, new Headers(response.headers));
    }

    return { response, responseBody, cleanup: abort.cleanup };
  }

  return {
    async request<TSchema extends z.ZodType>(
      options: ApiRequestOptions<TSchema>,
    ): Promise<ApiResponse<z.output<TSchema>>> {
      const { response, responseBody } = await send(options, true);
      const responseHeaders = new Headers(response.headers);

      const parsed = await options.schema.safeParseAsync(responseBody);

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
                path: issue.path.map(String).join("."),
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
    async requestRaw(options: ApiFetchOptions) {
      const { response, cleanup } = await send(options, false);
      return manageResponseBody(response, cleanup);
    },
  };
}

function manageResponseBody(response: Response, cleanup: () => void) {
  if (!response.body) {
    cleanup();
    return response;
  }

  const reader = response.body.getReader();
  let settled = false;
  const settle = () => {
    if (!settled) {
      settled = true;
      cleanup();
    }
  };

  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          settle();
          controller.close();
          return;
        }
        controller.enqueue(value);
      } catch (cause) {
        settle();
        controller.error(cause);
      }
    },
    async cancel(reason) {
      try {
        await reader.cancel(reason);
      } finally {
        settle();
      }
    },
  });

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

function normalizeApiOrigin(value: string) {
  if (value.trim() === "") {
    throw new TypeError("API_ORIGIN is required");
  }

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new TypeError("API_ORIGIN must be a valid absolute URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new TypeError("API_ORIGIN must use http or https");
  }

  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new TypeError("API_ORIGIN must not include credentials, path, query, or hash");
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

function buildHeaders(options: ApiFetchOptions, hasJsonBody: boolean) {
  const headers = new Headers(options.headers);
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

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

  const clientIp = incomingHeaders.get("cf-connecting-ip");

  if (clientIp) {
    headers.set("cf-connecting-ip", clientIp);
    headers.set("x-forwarded-for", clientIp);
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
    didTimeout: () => timedOut && !requestSignal?.aborted,
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
  cause: unknown,
) {
  return new ApiRequestError(
    kind,
    status,
    {
      type,
      title,
      status,
      detail,
      instance,
    },
    undefined,
    cause,
  );
}
