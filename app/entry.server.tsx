import { isbot } from "isbot";
import { renderToReadableStream } from "react-dom/server";
import type {
  EntryContext,
  HandleErrorFunction,
  InstrumentationHandlerResult,
  RouterContextProvider,
  ServerInstrumentation,
} from "react-router";
import { ServerRouter } from "react-router";

import { HTTP_STATUS } from "~/api/http-status";

export const streamTimeout = 5_000;

type InstrumentedServerRoute = Parameters<NonNullable<ServerInstrumentation["route"]>>[0];
type ServerRouteInstrumentations = Parameters<InstrumentedServerRoute["instrument"]>[0];
type ServerRouteInfo = Parameters<NonNullable<ServerRouteInstrumentations["loader"]>>[1];

const loggingInstrumentation: ServerInstrumentation = {
  handler({ instrument }) {
    instrument({
      async request(callRequest, { request }) {
        const startedAt = performance.now();
        const result = await callRequest();

        console.info(
          JSON.stringify({
            event: "react-router.request",
            requestId: request.headers.get("x-request-id") ?? "missing",
            method: request.method,
            pattern: result.meta?.pattern ?? "unmatched",
            status: result.statusCode,
            outcome: result.status,
            durationMs: Math.round(performance.now() - startedAt),
          }),
        );
      },
    });
  },
  route({ instrument, id }) {
    instrument({
      loader: (callLoader, info) => observeRoute("loader", id, callLoader, info),
      action: (callAction, info) => observeRoute("action", id, callAction, info),
      middleware: (callMiddleware, info) => observeRoute("middleware", id, callMiddleware, info),
    });
  },
};

export const instrumentations = [loggingInstrumentation];

export const handleError: HandleErrorFunction = (_error, { request }) => {
  if (!request.signal.aborted) {
    logRenderingError("react-router.request-error", request);
  }
};

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  _loadContext: RouterContextProvider,
) {
  responseHeaders.set("Content-Type", "text/html");

  // https://httpwg.org/specs/rfc9110.html#HEAD
  if (request.method.toUpperCase() === "HEAD") {
    return new Response(null, {
      status: responseStatusCode,
      headers: responseHeaders,
    });
  }

  let shellRendered = false;
  const userAgent = request.headers.get("user-agent");

  const body = await renderToReadableStream(
    <ServerRouter context={routerContext} url={request.url} />,
    {
      signal: AbortSignal.timeout(streamTimeout + 1000),
      onError() {
        responseStatusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR;
        // Log streaming rendering errors from inside the shell. Don't log
        // errors encountered during initial shell rendering since they'll
        // reject and get logged in handleDocumentRequest.
        if (shellRendered) {
          logRenderingError("react-router.stream-error", request);
        }
      },
    },
  );
  shellRendered = true;

  // Ensure requests from bots and SPA Mode renders wait for all content to load before responding
  // https://react.dev/reference/react-dom/server/renderToPipeableStream#waiting-for-all-content-to-load-for-crawlers-and-static-generation
  if ((userAgent && isbot(userAgent)) || routerContext.isSpaMode) {
    await body.allReady;
  }

  return new Response(body, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}

async function observeRoute(
  operation: "action" | "loader" | "middleware",
  routeId: string,
  callRoute: () => Promise<InstrumentationHandlerResult>,
  info: ServerRouteInfo,
) {
  const startedAt = performance.now();
  const result = await callRoute();

  console.info(
    JSON.stringify({
      event: `react-router.${operation}`,
      requestId: info.request.headers.get("x-request-id") ?? "missing",
      method: info.request.method,
      routeId,
      pattern: info.pattern,
      outcome: result.status,
      durationMs: Math.round(performance.now() - startedAt),
    }),
  );
}

function logRenderingError(
  event: "react-router.request-error" | "react-router.stream-error",
  request: Request,
) {
  console.error(
    JSON.stringify({
      event,
      requestId: request.headers.get("x-request-id") ?? "missing",
    }),
  );
}
