import { describe, expect, it } from "vitest";

import { HTTP_STATUS } from "~/api/http-status";
import { applyResponsePolicy, prepareRequest, validateMutationOrigin } from "./security.server";

describe("prepareRequest", () => {
  it("preserves a safe incoming request ID", () => {
    const prepared = prepareRequest(
      new Request("https://hyre.example/", {
        headers: { "x-request-id": "request-123" },
      }),
    );

    expect(prepared.requestId).toBe("request-123");
    expect(prepared.request.headers.get("x-request-id")).toBe("request-123");
  });

  it("replaces missing or unsafe request IDs", () => {
    const missing = prepareRequest(new Request("https://hyre.example/"));
    const unsafe = prepareRequest(
      new Request("https://hyre.example/", {
        headers: { "x-request-id": "short" },
      }),
    );

    expect(missing.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(unsafe.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(unsafe.requestId).not.toBe("short");
  });
});

describe("validateMutationOrigin", () => {
  it("allows safe methods without origin headers", () => {
    expect(validateMutationOrigin(new Request("https://hyre.example/"))).toBeUndefined();
  });

  it("allows same-origin browser mutations", () => {
    const response = validateMutationOrigin(
      new Request("https://hyre.example/bookings", {
        method: "POST",
        headers: {
          origin: "https://hyre.example",
          "sec-fetch-site": "same-origin",
        },
      }),
    );

    expect(response).toBeUndefined();
  });

  it("rejects cross-origin and unverifiable mutations", async () => {
    const crossOrigin = validateMutationOrigin(
      new Request("https://hyre.example/bookings", {
        method: "POST",
        headers: {
          origin: "https://attacker.example",
          "sec-fetch-site": "cross-site",
        },
      }),
    );
    const missingOrigin = validateMutationOrigin(
      new Request("https://hyre.example/bookings", {
        method: "POST",
      }),
    );

    expect(crossOrigin?.status).toBe(HTTP_STATUS.FORBIDDEN);
    expect(await crossOrigin?.json()).toMatchObject({
      type: "INVALID_REQUEST_ORIGIN",
      status: HTTP_STATUS.FORBIDDEN,
      instance: "/bookings",
    });
    expect(missingOrigin?.status).toBe(HTTP_STATUS.FORBIDDEN);
  });
});

describe("applyResponsePolicy", () => {
  it("adds security, request ID, timing, and preview noindex headers", () => {
    const response = applyResponsePolicy(
      new Request("https://preview.example/"),
      new Response("<html></html>", {
        headers: { "content-type": "text/html" },
      }),
      {
        environment: "preview",
        requestId: "request-123",
        durationMs: 12.34,
      },
    );

    expect(response.headers.get("x-request-id")).toBe("request-123");
    expect(response.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(response.headers.get("content-security-policy")).toContain(
      "img-src 'self' data: blob: https://*.s3.eu-west-1.amazonaws.com https://*.s3.eu-west-2.amazonaws.com",
    );
    expect(response.headers.get("strict-transport-security")).toContain("max-age=31536000");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow, noarchive");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("server-timing")).toBe("app;dur=12.3");
  });

  it("overrides public cache headers on preview", () => {
    const response = applyResponsePolicy(
      new Request("https://preview.example/"),
      new Response("<html></html>", {
        headers: { "cache-control": "public, max-age=300" },
      }),
      {
        environment: "preview",
        requestId: "request-123",
      },
    );

    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow, noarchive");
  });

  it("prevents caching and indexing the development deployment", () => {
    const response = applyResponsePolicy(
      new Request("https://development.example/"),
      new Response("<html></html>", {
        headers: { "cache-control": "public, max-age=300" },
      }),
      {
        environment: "development",
        requestId: "request-123",
      },
    );

    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow, noarchive");
  });

  it("keeps opt-in public cache headers in local", () => {
    const response = applyResponsePolicy(
      new Request("http://localhost:5173/about"),
      new Response("<html></html>", {
        headers: { "cache-control": "public, max-age=300" },
      }),
      {
        environment: "local",
        requestId: "request-123",
      },
    );

    expect(response.headers.get("cache-control")).toBe("public, max-age=300");
  });

  it("keeps public production pages indexable", () => {
    const response = applyResponsePolicy(
      new Request("https://hyre.example/about"),
      new Response(null, {
        headers: { "cache-control": "public, max-age=60" },
      }),
      {
        environment: "production",
        requestId: "request-123",
      },
    );

    expect(response.headers.get("x-robots-tag")).toBeNull();
    expect(response.headers.get("cache-control")).toBe("public, max-age=60");
  });

  it("prevents caching and indexing private or cookie-bearing responses", () => {
    const privateResponse = applyResponsePolicy(
      new Request("https://hyre.example/bookings"),
      new Response(null),
      {
        environment: "production",
        requestId: "request-123",
      },
    );
    const cookieResponse = applyResponsePolicy(
      new Request("https://hyre.example/", {
        headers: { cookie: "session=secret" },
      }),
      new Response(null, {
        headers: { "cache-control": "public, max-age=300" },
      }),
      {
        environment: "production",
        requestId: "request-456",
      },
    );

    expect(privateResponse.headers.get("x-robots-tag")).toBe("noindex, nofollow, noarchive");
    expect(privateResponse.headers.get("cache-control")).toBe("private, no-store");
    expect(cookieResponse.headers.get("cache-control")).toBe("private, no-store");
  });

  it("recognizes React Router data URLs for private routes", () => {
    const response = applyResponsePolicy(
      new Request("https://hyre.example/bookings.data"),
      new Response(null, {
        headers: { "cache-control": "public, max-age=300" },
      }),
      {
        environment: "production",
        requestId: "request-123",
      },
    );

    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow, noarchive");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("prevents caching authorization-bearing requests", () => {
    const response = applyResponsePolicy(
      new Request("https://hyre.example/", {
        headers: { authorization: "Bearer secret" },
      }),
      new Response(null, {
        headers: { "cache-control": "public, max-age=300" },
      }),
      {
        environment: "production",
        requestId: "request-123",
      },
    );

    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("does not emit HSTS over local HTTP", () => {
    const response = applyResponsePolicy(
      new Request("http://localhost:5173/"),
      new Response(null),
      {
        environment: "local",
        requestId: "request-123",
      },
    );

    expect(response.headers.get("strict-transport-security")).toBeNull();
  });

  it("preserves a stricter route-level referrer policy", () => {
    const response = applyResponsePolicy(
      new Request("https://hyre.example/bookings/guest?token=secret"),
      new Response(null, {
        headers: { "referrer-policy": "no-referrer" },
      }),
      {
        environment: "production",
        requestId: "request-123",
      },
    );

    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });
});
