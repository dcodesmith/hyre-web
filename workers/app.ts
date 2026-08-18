import { createRequestHandler } from "react-router";

import {
  applyResponsePolicy,
  prepareRequest,
  validateMutationOrigin,
} from "../app/middleware/security.server";

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

export default {
  async fetch(request, env) {
    const startedAt = performance.now();
    const { request: preparedRequest, requestId } = prepareRequest(request);
    const originError = validateMutationOrigin(preparedRequest);
    const response = originError ?? (await requestHandler(preparedRequest));

    const hardenedResponse = applyResponsePolicy(preparedRequest, response, {
      environment: env.APP_ENV,
      requestId,
      durationMs: performance.now() - startedAt,
    });

    console.info(
      JSON.stringify({
        event: "worker.request",
        requestId,
        method: preparedRequest.method,
        status: hardenedResponse.status,
        durationMs: Math.round(performance.now() - startedAt),
      }),
    );

    return hardenedResponse;
  },
} satisfies ExportedHandler<Env>;
