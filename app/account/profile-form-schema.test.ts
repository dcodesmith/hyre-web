import { parseWithZod } from "@conform-to/zod/v4";
import { describe, expect, it } from "vitest";

import { profileFormSchema } from "./profile-form-schema";

describe("profileFormSchema", () => {
  it("treats omitted fields as empty text instead of a type error", () => {
    const submission = parseWithZod(new FormData(), { schema: profileFormSchema });

    expect(submission.status).toBe("success");
    if (submission.status !== "success") {
      return;
    }

    expect(submission.value).toEqual({
      name: "",
      phoneNumber: "",
      city: "",
      address: "",
      marketingConsent: false,
    });
  });
});
