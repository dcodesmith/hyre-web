import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import type {
  ClientInstrumentation,
  InstrumentationClientRouterResult,
  InstrumentationHandlerResult,
} from "react-router";
import { HydratedRouter } from "react-router/dom";

const performanceInstrumentation: ClientInstrumentation = {
  router({ instrument }) {
    instrument({
      navigate: (callNavigate) => measureRouterOperation("navigation", callNavigate),
      fetch: (callFetch) => measureRouterOperation("fetcher", callFetch),
    });
  },
  route({ instrument, id }) {
    instrument({
      loader: (callLoader, { pattern }) => measureRouteOperation("loader", id, pattern, callLoader),
      action: (callAction, { pattern }) => measureRouteOperation("action", id, pattern, callAction),
      middleware: (callMiddleware, { pattern }) =>
        measureRouteOperation("middleware", id, pattern, callMiddleware),
    });
  },
};

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter instrumentations={[performanceInstrumentation]} />
    </StrictMode>,
  );
});

async function measureRouterOperation(
  operation: "fetcher" | "navigation",
  call: () => Promise<InstrumentationClientRouterResult>,
) {
  const startedAt = performance.now();
  const result = await call();
  const pattern = result.meta?.pattern ?? "unknown";

  performance.measure(`react-router.${operation}:${pattern}`, {
    start: startedAt,
    duration: performance.now() - startedAt,
  });
}

async function measureRouteOperation(
  operation: "action" | "loader" | "middleware",
  routeId: string,
  pattern: string,
  call: () => Promise<InstrumentationHandlerResult>,
) {
  const startedAt = performance.now();

  await call();
  performance.measure(`react-router.${operation}:${routeId}:${pattern}`, {
    start: startedAt,
    duration: performance.now() - startedAt,
  });
}
