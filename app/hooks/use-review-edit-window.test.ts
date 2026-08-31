import { describe, expect, it } from "vitest";

import { isReviewEditable } from "./use-review-edit-window";

describe("isReviewEditable", () => {
  it("closes the edit window after seven days", () => {
    const createdAt = "2026-08-01T12:00:00.000Z";

    expect(isReviewEditable(createdAt, "2026-08-08T12:00:00.000Z")).toBe(true);
    expect(isReviewEditable(createdAt, "2026-08-08T12:00:00.001Z")).toBe(false);
  });
});
