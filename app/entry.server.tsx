import { PassThrough } from "node:stream";
import type { EntryContext } from "@remix-run/node";
import { createReadableStreamFromReadable } from "@remix-run/node";
import { RemixServer } from "@remix-run/react";
import { isbot } from "isbot";
import { renderToPipeableStream } from "react-dom/server";
import logger from "./lib/logger.server";
import { env } from "./utils/server/env.server";

process.env.TZ = "Africa/Lagos";

const ABORT_DELAY = 5_000;

const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

logger.info(`Server timezone: ${timezone}`);
logger.info(`Current time in ${timezone}: ${new Date().toLocaleString("en-NG")}`);
/**
 * Add comprehensive security headers to prevent various attacks.
 *
 * This is the single source of truth for security headers on dynamic responses
 * (HTML pages, API/data responses). Static assets (CSS, JS, images, fonts) are
 * served directly from Vercel's CDN and receive basic security headers via
 * vercel.json (narrowed to static file extensions only to avoid duplication).
 */
function addSecurityHeaders(headers: Headers) {
  // Construct S3 domain dynamically from environment variables
  const awsBucketName = env.AWS_BUCKET_NAME;
  const awsRegion = env.AWS_REGION;
  const s3Domain =
    awsBucketName && awsRegion ? `https://${awsBucketName}.s3.${awsRegion}.amazonaws.com` : "";

  // Build CSP with conditional S3 domain
  const imgSrcDirectives = [
    "'self'",
    "data:",
    "blob:",
    "https://maps.gstatic.com",
    "https://maps.googleapis.com",
  ];

  // Only add S3 domain if environment variables are available
  if (s3Domain) {
    imgSrcDirectives.push(s3Domain);
  }

  // Add CloudFront domain for optimized images
  if (env.CLOUDFRONT_DOMAIN) {
    imgSrcDirectives.push(`https://${env.CLOUDFRONT_DOMAIN}`);
  }

  const cspDirectives = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' https://maps.googleapis.com https://maps.gstatic.com https://va.vercel-scripts.com https://vercel.live https://static.cloudflareinsights.com`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `font-src 'self' https://fonts.gstatic.com`,
    `img-src ${imgSrcDirectives.join(" ")}`,
    `connect-src 'self' https://api.flutterwave.com https://vercel.live https://vitals.vercel-insights.com https://maps.googleapis.com https://places.googleapis.com wss://ws-us3.pusher.com wss://*.pusher.com`,
    `frame-src 'self' https://vercel.live`,
    `frame-ancestors 'self'`,
    `form-action 'self'`,
  ];

  headers.set("X-Content-Type-Options", "nosniff");
  // SAMEORIGIN aligns with CSP frame-ancestors 'self' for consistent framing policy
  headers.set("X-Frame-Options", "SAMEORIGIN");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Content-Security-Policy", cspDirectives.join("; "));
  headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Cross-Origin-Resource-Policy", "cross-origin");
  headers.set("X-DNS-Prefetch-Control", "off");
  headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
}

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext,
  // loadContext: AppLoadContext
) {
  const prohibitOutOfOrderStreaming =
    isBotRequest(request.headers.get("user-agent")) || remixContext.isSpaMode;

  return prohibitOutOfOrderStreaming
    ? handleBotRequest(request, responseStatusCode, responseHeaders, remixContext)
    : handleBrowserRequest(request, responseStatusCode, responseHeaders, remixContext);
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
  remixContext: EntryContext,
) {
  return new Promise((resolve, reject) => {
    let shellRendered = false;
    const { pipe, abort } = renderToPipeableStream(
      <RemixServer context={remixContext} url={request.url} abortDelay={ABORT_DELAY} />,
      {
        onAllReady() {
          shellRendered = true;
          const body = new PassThrough();
          const stream = createReadableStreamFromReadable(body);

          responseHeaders.set("Content-Type", "text/html");
          addSecurityHeaders(responseHeaders);

          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode,
            }),
          );

          pipe(body);
        },
        onShellError(error: unknown) {
          reject(error);
        },
        onError(error: unknown) {
          // biome-ignore lint/style/noParameterAssign: <framework code>
          responseStatusCode = 500;
          // Log streaming rendering errors from inside the shell.  Don't log
          // errors encountered during initial shell rendering since they'll
          // reject and get logged in handleDocumentRequest.
          if (shellRendered) {
            console.error(error);
          }
        },
      },
    );

    setTimeout(abort, ABORT_DELAY);
  });
}

function handleBrowserRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext,
) {
  return new Promise((resolve, reject) => {
    let shellRendered = false;
    const { pipe, abort } = renderToPipeableStream(
      <RemixServer context={remixContext} url={request.url} abortDelay={ABORT_DELAY} />,
      {
        onShellReady() {
          shellRendered = true;
          const body = new PassThrough();
          const stream = createReadableStreamFromReadable(body);

          responseHeaders.set("Content-Type", "text/html");
          addSecurityHeaders(responseHeaders);

          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode,
            }),
          );

          pipe(body);
        },
        onShellError(error: unknown) {
          reject(error);
        },
        onError(error: unknown) {
          // biome-ignore lint/style/noParameterAssign: <framework code>
          responseStatusCode = 500;
          // Log streaming rendering errors from inside the shell.  Don't log
          // errors encountered during initial shell rendering since they'll
          // reject and get logged in handleDocumentRequest.
          if (shellRendered) {
            console.error(error);
          }
        },
      },
    );

    setTimeout(abort, ABORT_DELAY);
  });
}

/**
 * Handle data requests (JSON responses from loaders/actions)
 * Ensures all responses get security headers
 */
export function handleDataRequest(response: Response, { request }: { request: Request }): Response {
  // Clone response to add headers (Response objects are immutable)
  const headers = new Headers(response.headers);

  // Add security headers to all data responses
  addSecurityHeaders(headers);

  // Return new response with security headers
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
