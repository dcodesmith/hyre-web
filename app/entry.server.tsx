import { PassThrough } from "stream";
import type { EntryContext } from "@remix-run/node";
import { createReadableStreamFromReadable } from "@remix-run/node";
import { RemixServer } from "@remix-run/react";
import { isbot } from "isbot";
import { renderToPipeableStream } from "react-dom/server";
import { initEnvs } from "./utils/env.server";
import {
  scheduleConfirmedToActiveUpdates,
  scheduleActiveToCompletedUpdates,
} from "./queues/bookingStatus.server";
import { scheduleBookingReminderEmails } from "./queues/bookingReminder.server";
// import express from "express";

// import { serverAdapter } from "./queues/config.server";

// const app = express();

const ABORT_DELAY = 5_000;

initEnvs();

// app.use("/admin/queues", serverAdapter.getRouter());

scheduleConfirmedToActiveUpdates()
  .then((job) => console.log(`Booking status for job ${job.name} scheduled`))
  .catch((error) =>
    console.error(
      "Failed to schedule booking status update from confirmed to active",
      error
    )
  );

scheduleActiveToCompletedUpdates()
  .then((job) => console.log(`Booking status for job ${job.name} scheduled`))
  .catch((error) =>
    console.error(
      "Failed to schedule booking status update from active to completed",
      error
    )
  );

scheduleBookingReminderEmails()
  .then((job) => console.log(`Booking reminder for job ${job.name} scheduled`))
  .catch((error) =>
    console.error("Failed to schedule booking reminder emails", error)
  );

// app.once("listening", () => {
//   console.log("Server is running on port 3000");
// });

// app.listen(3000);

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
  // loadContext: AppLoadContext
) {
  const prohibitOutOfOrderStreaming =
    isBotRequest(request.headers.get("user-agent")) || remixContext.isSpaMode;

  return prohibitOutOfOrderStreaming
    ? handleBotRequest(
        request,
        responseStatusCode,
        responseHeaders,
        remixContext
      )
    : handleBrowserRequest(
        request,
        responseStatusCode,
        responseHeaders,
        remixContext
      );
}

// We have some Remix apps in the wild already running with isbot@3 so we need
// to maintain backwards compatibility even though we want new apps to use
// isbot@4.  That way, we can ship this as a minor Semver update to @remix-run/dev.
function isBotRequest(userAgent: string | null) {
  if (!userAgent) {
    return false;
  }

  // isbot >= 3.8.0, >4
  if ("isbot" in isbot && typeof isbot.isbot === "function") {
    return isbot.isbot(userAgent);
  }

  // isbot < 3.8.0
  if ("default" in isbot && typeof isbot.default === "function") {
    return isbot.default(userAgent);
  }

  return false;
}

function handleBotRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) {
  return new Promise((resolve, reject) => {
    let shellRendered = false;
    const { pipe, abort } = renderToPipeableStream(
      <RemixServer
        context={remixContext}
        url={request.url}
        abortDelay={ABORT_DELAY}
      />,
      {
        onAllReady() {
          shellRendered = true;
          const body = new PassThrough();
          const stream = createReadableStreamFromReadable(body);

          responseHeaders.set("Content-Type", "text/html");

          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode,
            })
          );

          pipe(body);
        },
        onShellError(error: unknown) {
          reject(error);
        },
        onError(error: unknown) {
          responseStatusCode = 500;
          // Log streaming rendering errors from inside the shell.  Don't log
          // errors encountered during initial shell rendering since they'll
          // reject and get logged in handleDocumentRequest.
          if (shellRendered) {
            console.error(error);
          }
        },
      }
    );

    setTimeout(abort, ABORT_DELAY);
  });
}

function handleBrowserRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) {
  return new Promise((resolve, reject) => {
    let shellRendered = false;
    const { pipe, abort } = renderToPipeableStream(
      <RemixServer
        context={remixContext}
        url={request.url}
        abortDelay={ABORT_DELAY}
      />,
      {
        onShellReady() {
          shellRendered = true;
          const body = new PassThrough();
          const stream = createReadableStreamFromReadable(body);

          responseHeaders.set("Content-Type", "text/html");

          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode,
            })
          );

          pipe(body);
        },
        onShellError(error: unknown) {
          reject(error);
        },
        onError(error: unknown) {
          responseStatusCode = 500;
          // Log streaming rendering errors from inside the shell.  Don't log
          // errors encountered during initial shell rendering since they'll
          // reject and get logged in handleDocumentRequest.
          if (shellRendered) {
            console.error(error);
          }
        },
      }
    );

    setTimeout(abort, ABORT_DELAY);
  });
}
