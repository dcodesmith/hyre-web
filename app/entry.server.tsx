import { isbot } from "isbot";
import { renderToReadableStream } from "react-dom/server";
import type { EntryContext, RouterContextProvider, ServerInstrumentation } from "react-router";
import { ServerRouter } from "react-router";

export const streamTimeout = 5_000;

type InstrumentedCall = () => Promise<{
  status: "error" | "success";
  error?: unknown;
}>;

type InstrumentedRequestInfo = {
  pattern?: string;
  request: {
    headers: { get(name: string): string | null };
    method: string;
  };
};

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

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  _loadContext: RouterContextProvider,
) {
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
      onError(error: unknown) {
        responseStatusCode = 500;
        // Log streaming rendering errors from inside the shell. Don't log
        // errors encountered during initial shell rendering since they'll
        // reject and get logged in handleDocumentRequest.
        if (shellRendered) {
          console.error(error);
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

  responseHeaders.set("Content-Type", "text/html");
  return new Response(body, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}

async function observeRoute(
  operation: "action" | "loader" | "middleware",
  routeId: string,
  callRoute: InstrumentedCall,
  info: InstrumentedRequestInfo,
) {
  const startedAt = performance.now();
  const result = await callRoute();

  console.info(
    JSON.stringify({
      event: `react-router.${operation}`,
      requestId: info.request.headers.get("x-request-id") ?? "missing",
      method: info.request.method,
      routeId,
      pattern: info.pattern ?? "unknown",
      outcome: result.status,
      durationMs: Math.round(performance.now() - startedAt),
    }),
  );
}
