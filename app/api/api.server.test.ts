import { describe, expect, it } from "vitest";
import { z } from "zod";

import { ApiRequestError, createApiClient } from "./api.server";
import { carCategoriesResponseSchema } from "./cars/schema";
import { HTTP_STATUS, type HttpStatus } from "./http-status";
import { toPublicProblemDetails } from "./problem-details";

const okSchema = z.object({ ok: z.boolean() });

describe("createApiClient", () => {
  it("uses root-relative URLs and forwards tracing headers", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;
    const fetchImpl: typeof fetch = async (input, init) => {
      capturedUrl = String(input);
      capturedInit = init;
      return jsonResponse({ ok: true }, HTTP_STATUS.OK, {
        "cache-control": "public, max-age=300",
      });
    };
    const incoming = new Request("https://hyre.example/", {
      headers: {
        cookie: "session=secret",
        origin: "https://hyre.example",
        traceparent: "00-trace-parent",
        "x-request-id": "request-123",
        "cf-connecting-ip": "203.0.113.10",
        "x-forwarded-for": "198.51.100.1",
      },
    });
    const client = createApiClient({
      apiOrigin: "https://api.example/",
      fetchImpl,
    });

    const response = await client.request({
      path: "/api/cars/categories?limit=50",
      request: incoming,
      schema: okSchema,
    });

    expect(capturedUrl).toBe("https://api.example/api/cars/categories?limit=50");
    const headers = new Headers(capturedInit?.headers);
    expect(headers.get("accept")).toBe("application/json");
    expect(headers.get("content-type")).toBeNull();
    expect(headers.get("x-request-id")).toBe("request-123");
    expect(headers.get("traceparent")).toBe("00-trace-parent");
    expect(headers.get("cookie")).toBeNull();
    expect(headers.get("origin")).toBeNull();
    expect(headers.get("cf-connecting-ip")).toBe("203.0.113.10");
    expect(headers.get("x-forwarded-for")).toBe("203.0.113.10");
    expect(headers.get("x-forwarded-for")).not.toBe("198.51.100.1");
    expect(response).toMatchObject({
      data: { ok: true },
      status: HTTP_STATUS.OK,
    });
    expect(response.headers.get("cache-control")).toBe("public, max-age=300");
  });

  it("does not forward a spoofed x-forwarded-for without CF-Connecting-IP", async () => {
    let capturedInit: RequestInit | undefined;
    const fetchImpl: typeof fetch = async (_input, init) => {
      capturedInit = init;
      return jsonResponse({ ok: true });
    };
    const client = createApiClient({
      apiOrigin: "https://api.example",
      fetchImpl,
    });

    await client.request({
      path: "/api/example",
      request: new Request("https://hyre.example/", {
        headers: { "x-forwarded-for": "198.51.100.1" },
      }),
      schema: okSchema,
    });

    const headers = new Headers(capturedInit?.headers);
    expect(headers.get("cf-connecting-ip")).toBeNull();
    expect(headers.get("x-forwarded-for")).toBeNull();
  });

  it("forwards cookies and origins only when explicitly enabled", async () => {
    let capturedInit: RequestInit | undefined;
    const fetchImpl: typeof fetch = async (_input, init) => {
      capturedInit = init;
      return jsonResponse({ ok: true });
    };
    const request = new Request("https://hyre.example/", {
      headers: {
        cookie: "session=secret",
        origin: "https://hyre.example",
      },
    });
    const client = createApiClient({
      apiOrigin: "https://api.example",
      fetchImpl,
    });

    await client.request({
      path: "/api/example",
      method: "POST",
      request,
      schema: okSchema,
      json: { value: 1 },
      forwardCookie: true,
      forwardOrigin: true,
    });

    const headers = new Headers(capturedInit?.headers);
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("cookie")).toBe("session=secret");
    expect(headers.get("origin")).toBe("https://hyre.example");
    expect(capturedInit?.body).toBe('{"value":1}');
  });

  it("forwards multipart bodies without setting the content type boundary", async () => {
    let capturedInit: RequestInit | undefined;
    const fetchImpl: typeof fetch = async (_input, init) => {
      capturedInit = init;
      return jsonResponse({ ok: true });
    };
    const client = createApiClient({
      apiOrigin: "https://api.example",
      fetchImpl,
    });
    const formData = new FormData();
    formData.set("file", new File(["replacement"], "car.jpg", { type: "image/jpeg" }));

    await client.request({
      path: "/api/fleet-owner/cars/car-1/images/image-1/file",
      method: "PUT",
      schema: okSchema,
      formData,
    });

    const headers = new Headers(capturedInit?.headers);
    expect(headers.get("content-type")).toBeNull();
    expect(capturedInit?.body).toBe(formData);
  });

  it("rejects requests with both JSON and multipart bodies", async () => {
    const client = createApiClient({
      apiOrigin: "https://api.example",
      fetchImpl: async () => jsonResponse({ ok: true }),
    });

    await expect(
      client.request({
        path: "/api/example",
        schema: okSchema,
        formData: new FormData(),
        json: { value: 1 },
      }),
    ).rejects.toThrow("cannot include both JSON and multipart bodies");
  });

  it("does not classify JSON serialization errors as network failures", async () => {
    let fetchCalled = false;
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const client = createApiClient({
      apiOrigin: "https://api.example",
      fetchImpl: async () => {
        fetchCalled = true;
        return jsonResponse({ ok: true });
      },
    });

    await expect(
      client.request({
        path: "/api/example",
        method: "POST",
        schema: okSchema,
        json: circular,
      }),
    ).rejects.toThrow(TypeError);
    expect(fetchCalled).toBe(false);
  });

  it("rejects absolute and protocol-relative caller paths", async () => {
    const client = createApiClient({
      apiOrigin: "https://api.example",
      fetchImpl: async () => jsonResponse({ ok: true }),
    });

    await expect(
      client.request({
        path: "https://attacker.example/api",
        schema: okSchema,
      }),
    ).rejects.toThrow("root-relative");

    await expect(
      client.request({
        path: "//attacker.example/api",
        schema: okSchema,
      }),
    ).rejects.toThrow("root-relative");

    await expect(
      client.request({
        path: "/\\attacker.example/api",
        schema: okSchema,
      }),
    ).rejects.toThrow("must stay within API_ORIGIN");
  });

  it("rejects API origins that include paths or credentials", () => {
    expect(() => createApiClient({ apiOrigin: "" })).toThrow("API_ORIGIN is required");
    expect(() => createApiClient({ apiOrigin: "   " })).toThrow("API_ORIGIN is required");
    expect(() => createApiClient({ apiOrigin: "not-a-url" })).toThrow("valid absolute URL");
    expect(() => createApiClient({ apiOrigin: "https://api.example/base" })).toThrow(
      "must not include",
    );
    expect(() => createApiClient({ apiOrigin: "https://user:secret@api.example" })).toThrow(
      "must not include",
    );
  });

  it("preserves upstream Problem Details and status", async () => {
    const client = createApiClient({
      apiOrigin: "https://api.example",
      fetchImpl: async () =>
        jsonResponse(
          {
            type: "VALIDATION_ERROR",
            title: "Validation Failed",
            status: HTTP_STATUS.BAD_REQUEST,
            detail: "One or more validation errors occurred",
            instance: "/api/cars/categories",
            errors: [{ field: "limit", message: "Too large" }],
          },
          HTTP_STATUS.BAD_REQUEST,
          { "x-request-id": "upstream-request" },
        ),
    });

    const error = await client
      .request({
        path: "/api/cars/categories?limit=101",
        schema: okSchema,
      })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({
      kind: "http",
      status: HTTP_STATUS.BAD_REQUEST,
      problem: {
        type: "VALIDATION_ERROR",
        title: "Validation Failed",
        status: HTTP_STATUS.BAD_REQUEST,
        instance: "/api/cars/categories",
      },
    });
    expect((error as ApiRequestError).headers.get("x-request-id")).toBe("upstream-request");
  });

  it("normalizes non-JSON upstream failures", async () => {
    const client = createApiClient({
      apiOrigin: "https://api.example",
      fetchImpl: async () =>
        new Response("Service unavailable", {
          status: HTTP_STATUS.SERVICE_UNAVAILABLE,
          statusText: "Service Unavailable",
          headers: { "content-type": "text/plain" },
        }),
    });

    const error = await client
      .request({
        path: "/api/cars/categories",
        schema: okSchema,
      })
      .catch((caught: unknown) => caught);

    expect(error).toMatchObject({
      kind: "http",
      status: HTTP_STATUS.SERVICE_UNAVAILABLE,
      problem: {
        type: "UPSTREAM_HTTP_ERROR",
        title: "Upstream API error",
        status: HTTP_STATUS.SERVICE_UNAVAILABLE,
        detail: "The upstream API returned an error.",
        instance: "/api/cars/categories",
      },
    });
  });

  it("does not expose upstream diagnostics from server errors", async () => {
    const client = createApiClient({
      apiOrigin: "https://api.example",
      fetchImpl: async () =>
        jsonResponse(
          {
            type: "DATABASE_ERROR",
            title: "Query failed",
            status: HTTP_STATUS.SERVICE_UNAVAILABLE,
            detail: "select * from private_users",
            instance: "/internal/database",
            errorCode: "DB_CONNECTION_FAILED",
            errors: [{ userId: "private-user-id" }],
            details: { query: "select * from private_users" },
          },
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          { "x-request-id": "upstream-request" },
        ),
    });

    const error = await client
      .request({
        path: "/api/cars/categories",
        schema: okSchema,
      })
      .catch((caught: unknown) => caught);

    expect(error).toMatchObject({
      kind: "http",
      status: HTTP_STATUS.SERVICE_UNAVAILABLE,
      problem: {
        type: "UPSTREAM_HTTP_ERROR",
        title: "Upstream API error",
        status: HTTP_STATUS.SERVICE_UNAVAILABLE,
        detail: "The upstream API returned an error.",
        instance: "/api/cars/categories",
      },
    });
    expect((error as ApiRequestError).problem).not.toHaveProperty("errors");
    expect((error as ApiRequestError).problem).not.toHaveProperty("details");
    expect((error as ApiRequestError).problem).not.toHaveProperty("errorCode");
  });

  it("preserves the upstream 5xx status while sanitizing its details", async () => {
    const client = createApiClient({
      apiOrigin: "https://api.example",
      fetchImpl: async () =>
        jsonResponse(
          {
            type: "INTERNAL_SERVER_ERROR",
            title: "Internal Server Error",
            status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
            detail: "prisma query failed",
          },
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
        ),
    });

    const error = await client
      .request({
        path: "/api/cars/categories",
        schema: okSchema,
      })
      .catch((caught: unknown) => caught);

    expect(error).toMatchObject({
      kind: "http",
      status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      problem: {
        type: "UPSTREAM_HTTP_ERROR",
        title: "Upstream API error",
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        detail: "The upstream API returned an error.",
        instance: "/api/cars/categories",
      },
    });
  });

  it("reports invalid successful responses as contract failures", async () => {
    const client = createApiClient({
      apiOrigin: "https://api.example",
      fetchImpl: async () => jsonResponse({ unexpected: true }),
    });

    const error = await client
      .request({
        path: "/api/cars/categories",
        schema: okSchema,
      })
      .catch((caught: unknown) => caught);

    expect(error).toMatchObject({
      kind: "contract",
      status: HTTP_STATUS.BAD_GATEWAY,
      problem: {
        type: "UPSTREAM_INVALID_RESPONSE",
        status: HTTP_STATUS.BAD_GATEWAY,
      },
    });
    expect(toPublicProblemDetails((error as ApiRequestError).problem)).toMatchObject({
      type: "UPSTREAM_HTTP_ERROR",
      title: "Upstream API error",
      status: HTTP_STATUS.BAD_GATEWAY,
      detail: "The upstream API returned an error.",
    });
    expect(toPublicProblemDetails((error as ApiRequestError).problem)).not.toHaveProperty(
      "details",
    );
  });

  it("classifies an upstream timeout", async () => {
    const fetchImpl: typeof fetch = async (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        const rejectWithReason = () => reject(signal?.reason);

        if (signal?.aborted) {
          rejectWithReason();
        } else {
          signal?.addEventListener("abort", rejectWithReason, { once: true });
        }
      });
    const client = createApiClient({
      apiOrigin: "https://api.example",
      fetchImpl,
    });

    const error = await client
      .request({
        path: "/api/cars/categories",
        schema: okSchema,
        timeoutMs: 5,
      })
      .catch((caught: unknown) => caught);

    expect(error).toMatchObject({
      kind: "timeout",
      status: HTTP_STATUS.GATEWAY_TIMEOUT,
      problem: { type: "UPSTREAM_TIMEOUT" },
    });
    expect((error as ApiRequestError).cause).toBeInstanceOf(DOMException);
  });

  it("keeps the timeout active while reading the response body", async () => {
    const client = createApiClient({
      apiOrigin: "https://api.example",
      fetchImpl: async (_input, init) => {
        const signal = init?.signal;
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            const failOnAbort = () => controller.error(signal?.reason);

            if (signal?.aborted) {
              failOnAbort();
            } else {
              signal?.addEventListener("abort", failOnAbort, { once: true });
            }
          },
        });

        return new Response(stream, {
          headers: { "content-type": "application/json" },
        });
      },
    });

    const error = await client
      .request({
        path: "/api/cars/categories",
        schema: okSchema,
        timeoutMs: 5,
      })
      .catch((caught: unknown) => caught);

    expect(error).toMatchObject({
      kind: "timeout",
      status: HTTP_STATUS.GATEWAY_TIMEOUT,
    });
  });

  it("classifies caller cancellation as aborted", async () => {
    const controller = new AbortController();
    const abortReason = new DOMException("Caller cancelled", "AbortError");
    const client = createApiClient({
      apiOrigin: "https://api.example",
      fetchImpl: async (_input, init) => {
        init?.signal?.throwIfAborted();
        return jsonResponse({ ok: true });
      },
    });
    controller.abort(abortReason);

    const error = await client
      .request({
        path: "/api/cars/categories",
        schema: okSchema,
        request: new Request("https://hyre.example/", {
          signal: controller.signal,
        }),
      })
      .catch((caught: unknown) => caught);

    expect(error).toMatchObject({
      kind: "aborted",
      status: HTTP_STATUS.CLIENT_CLOSED_REQUEST,
    });
    expect((error as ApiRequestError).cause).toBe(abortReason);
  });

  it("classifies transport failures as network errors", async () => {
    const failure = new TypeError("fetch failed");
    const client = createApiClient({
      apiOrigin: "https://api.example",
      fetchImpl: async () => {
        throw failure;
      },
    });

    const error = await client
      .request({
        path: "/api/cars/categories",
        schema: okSchema,
      })
      .catch((caught: unknown) => caught);

    expect(error).toMatchObject({
      kind: "network",
      status: HTTP_STATUS.SERVICE_UNAVAILABLE,
    });
    expect((error as ApiRequestError).cause).toBe(failure);
  });
});

describe("carCategoriesResponseSchema", () => {
  it("validates the current public categories API contract", () => {
    const car = {
      id: "car_123",
      make: "Toyota",
      model: "Camry",
      year: 2024,
      dayRate: 50_000,
      passengerCapacity: 4,
      pricingIncludesFuel: true,
      vehicleType: "SEDAN",
      serviceTier: "STANDARD",
      images: [{ url: "https://images.example/car.jpg" }],
      promotion: null,
      averageRating: 4.5,
      totalReviews: 10,
    };

    expect(
      carCategoriesResponseSchema.parse({
        categories: [
          {
            name: "sedan",
            title: "Sedan",
            type: "vehicleType",
            cars: [car],
          },
        ],
        allCars: [car],
        total: 1,
      }),
    ).toMatchObject({ total: 1 });
  });

  it("accepts optional createdAt ISO timestamps from the API", () => {
    const car = {
      id: "car_123",
      make: "Toyota",
      model: "Camry",
      year: 2024,
      dayRate: 50_000,
      passengerCapacity: 4,
      pricingIncludesFuel: true,
      vehicleType: "SEDAN",
      serviceTier: "STANDARD",
      images: [{ url: "https://images.example/car.jpg" }],
      createdAt: "2026-08-11T09:00:00.000Z",
      promotion: null,
      averageRating: 4.5,
      totalReviews: 10,
    };

    expect(
      carCategoriesResponseSchema.parse({
        categories: [],
        allCars: [car],
        total: 1,
      }).allCars[0]?.createdAt,
    ).toBe("2026-08-11T09:00:00.000Z");
  });
});

function jsonResponse(
  body: unknown,
  status: HttpStatus = HTTP_STATUS.OK,
  headers: HeadersInit = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      ...Object.fromEntries(new Headers(headers)),
    },
  });
}
