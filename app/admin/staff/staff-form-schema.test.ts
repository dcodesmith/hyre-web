import { describe, expect, it } from "vitest";

import { EMAIL_INVALID_ERROR } from "~/auth/auth-form-schema";
import { STAFF_NAME_ERROR, STAFF_PHONE_ERROR, staffFormSchema } from "./staff-form-schema";

const validStaff = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  phoneNumber: "08012345678",
};

describe("staff form schema", () => {
  it("trims name and phone and lowercases email", () => {
    const parsed = staffFormSchema.safeParse({
      name: "  Ada Lovelace  ",
      email: " Ada@Example.com ",
      phoneNumber: "  08012345678  ",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toEqual(validStaff);
    }
  });

  it("rejects short name, invalid email, and short phone", () => {
    const parsed = staffFormSchema.safeParse({
      name: "A",
      email: "not-an-email",
      phoneNumber: "123456789",
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.flatten().fieldErrors).toMatchObject({
        name: [STAFF_NAME_ERROR],
        email: [EMAIL_INVALID_ERROR],
        phoneNumber: [STAFF_PHONE_ERROR],
      });
    }
  });

  it("rejects name and phone over the API limits", () => {
    expect(staffFormSchema.safeParse({ ...validStaff, name: "A".repeat(201) }).success).toBe(false);
    expect(staffFormSchema.safeParse({ ...validStaff, phoneNumber: "1".repeat(33) }).success).toBe(
      false,
    );
  });

  it("rejects a phone that meets the length but does not contain 10 digits", () => {
    expect(staffFormSchema.safeParse({ ...validStaff, phoneNumber: "abcdefghij" }).success).toBe(
      false,
    );
  });

  it("accepts a formatted phone with at least 10 digits", () => {
    const parsed = staffFormSchema.safeParse({
      ...validStaff,
      phoneNumber: "+234 801 234 5678",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.phoneNumber).toBe("+234 801 234 5678");
    }
  });
});
