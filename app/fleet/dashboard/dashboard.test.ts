import { describe, expect, it } from "vitest";

import { formatEarningsBucket } from "./dashboard";

describe("fleet dashboard display", () => {
  it("formats API earnings buckets by grouping", () => {
    const bucketStart = "2026-08-24T00:00:00.000Z";

    expect(formatEarningsBucket(bucketStart, "day")).toBe("24 Aug");
    expect(formatEarningsBucket(bucketStart, "week")).toBe("Week of 24 Aug");
    expect(formatEarningsBucket(bucketStart, "month")).toBe("August 2026");
  });
});
