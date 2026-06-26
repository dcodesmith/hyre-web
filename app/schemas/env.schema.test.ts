import { describe, expect, it } from "vitest";
import { normalizeSiteOrigin } from "./env.schema";

describe("normalizeSiteOrigin", () => {
  it("preserves http/https origins and strips trailing slashes", () => {
    expect(normalizeSiteOrigin("https://www.tripdly.com/")).toBe("https://www.tripdly.com");
    expect(normalizeSiteOrigin("http://localhost:5173")).toBe("http://localhost:5173");
  });

  it("adds https when protocol is missing", () => {
    expect(normalizeSiteOrigin("tripdly.com")).toBe("https://tripdly.com");
    expect(normalizeSiteOrigin("www.tripdly.com")).toBe("https://www.tripdly.com");
  });

  it("strips paths down to the origin", () => {
    expect(normalizeSiteOrigin("example.com/foo")).toBe("https://example.com");
    expect(normalizeSiteOrigin("https://tripdly.com/a/b")).toBe("https://tripdly.com");
  });

  it("leaves unparseable input for .pipe(z.url()) to reject", () => {
    expect(normalizeSiteOrigin("   ")).toBe("https://");
  });
});
