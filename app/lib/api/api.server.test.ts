import { z } from "zod";
import { describe, expect, it } from "vitest";

import { ApiRequestError, createApiClient } from "./api.server";
import { carCategoriesResponseSchema } from "./contracts/car-categories";
import { apiEndpoints } from "./endpoints";

const okSchema = z.object({ ok: z.boolean() });

describe("createApiClient", () => {
  it("uses root-relative URLs and forwards tracing headers", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;
    const fetchImpl: typeof fetch = async (input, init) => {
      capturedUrl = String(input);
      capturedInit = init;
      return jsonResponse({ ok: true }, 200, { "cache-control": "public, max-age=300" });
    };
    const incoming = new Request("https://hyre.example/", {
      headers: {
        cookie: "session=secret",
        origin: "https://hyre.example",
        "traceparent": "00-trace-parent",
        "x-request-id": "request-123",
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
    expect(response).toMatchObject({ data: { ok: true }, status: 200 });
    expect(response.headers.get("cache-control")).toBe("public, max-age=300");
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
  });

  it("rejects API origins that include paths or credentials", () => {
    expect(() =>
      createApiClient({ apiOrigin: "https://api.example/base" }),
    ).toThrow("must not include");
    expect(() =>
      createApiClient({ apiOrigin: "https://user:secret@api.example" }),
    ).toThrow("must not include");
  });

  it("preserves upstream Problem Details and status", async () => {
    const client = createApiClient({
      apiOrigin: "https://api.example",
      fetchImpl: async () =>
        jsonResponse(
          {
            type: "VALIDATION_ERROR",
            title: "Validation Failed",
            status: 400,
            detail: "One or more validation errors occurred",
            instance: "/api/cars/categories",
            errors: [{ field: "limit", message: "Too large" }],
          },
          400,
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
      status: 400,
      problem: {
        type: "VALIDATION_ERROR",
        title: "Validation Failed",
        status: 400,
        instance: "/api/cars/categories",
      },
    });
    expect((error as ApiRequestError).headers.get("x-request-id")).toBe(
      "upstream-request",
    );
  });

  it("normalizes non-JSON upstream failures", async () => {
    const client = createApiClient({
      apiOrigin: "https://api.example",
      fetchImpl: async () =>
        new Response("Service unavailable", {
          status: 503,
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
      status: 503,
      problem: {
        type: "UPSTREAM_HTTP_ERROR",
        title: "Service Unavailable",
        status: 503,
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
      status: 502,
      problem: {
        type: "UPSTREAM_INVALID_RESPONSE",
        status: 502,
      },
    });
  });

  it("distinguishes upstream timeouts from network failures", async () => {
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
      status: 504,
      problem: { type: "UPSTREAM_TIMEOUT" },
    });
  });
});

describe("carCategoriesResponseSchema", () => {
  it("validates the current Nest public categories contract", () => {
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
});

describe("apiEndpoints", () => {
  it("serializes validated category query values", () => {
    expect(
      apiEndpoints.cars.categories({
        limit: 25,
        from: new Date("2026-08-17T12:00:00.000Z"),
      }),
    ).toBe(
      "/api/cars/categories?limit=25&from=2026-08-17T12%3A00%3A00.000Z",
    );
  });
});

function jsonResponse(
  body: unknown,
  status = 200,
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
