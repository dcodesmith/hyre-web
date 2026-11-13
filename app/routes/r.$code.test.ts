import { describe, expect, it } from "vitest";
import { loader } from "./r.$code";

function runLoader(code: string) {
  return loader({
    request: new Request(`https://tripdly.com/r/${encodeURIComponent(code)}`),
    params: { code },
  } as Parameters<typeof loader>[0]);
}

describe("referral share redirect", () => {
  it("normalizes and redirects a valid code to the existing attribution flow", async () => {
    const response = await Promise.resolve()
      .then(() => runLoader("abcd1234"))
      .catch((error: unknown) => error);

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(302);
    expect((response as Response).headers.get("location")).toBe("/auth?ref=ABCD1234");
    expect((response as Response).headers.get("cache-control")).toBe("no-store");
  });

  it("returns not found for malformed codes", async () => {
    const response = await Promise.resolve()
      .then(() => runLoader("../bad"))
      .catch((error: unknown) => error);

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(404);
  });
});
