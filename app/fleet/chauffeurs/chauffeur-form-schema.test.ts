import { describe, expect, it } from "vitest";

import { inviteChauffeurFormSchema, updateChauffeurFormSchema } from "./chauffeur-form-schema";

const IDEMPOTENCY_KEY = "18aa029c-4bb1-4ca7-b25e-cfc802c4bf8c";

const validInvite = {
  name: "Bola Adebayo",
  email: "bola@example.com",
  phoneNumber: "+2348012345678",
  idempotencyKey: IDEMPOTENCY_KEY,
};

describe("fleet chauffeur form schemas", () => {
  it("trims the invite name, lowercases email, and accepts E.164 phones", () => {
    expect(
      inviteChauffeurFormSchema.parse({
        name: "  Bola Adebayo  ",
        email: " Bola@Example.com ",
        phoneNumber: " +2348012345678 ",
        idempotencyKey: IDEMPOTENCY_KEY,
      }),
    ).toEqual(validInvite);
  });

  it("rejects a short name, invalid email, or local phone number", () => {
    const parsed = inviteChauffeurFormSchema.safeParse({
      name: "A",
      email: "not-an-email",
      phoneNumber: "08012345678",
      idempotencyKey: IDEMPOTENCY_KEY,
    });

    expect(parsed.success).toBe(false);
    if (parsed.success) {
      return;
    }
    expect(parsed.error.flatten().fieldErrors).toMatchObject({
      name: expect.any(Array),
      email: ["Enter a valid email address"],
      phoneNumber: ["Use international format, for example +2348012345678"],
    });
  });

  it("transforms chauffeur activation flags", () => {
    expect(
      updateChauffeurFormSchema.parse({ chauffeurId: "chauffeur-1", isActive: "true" }),
    ).toEqual({ chauffeurId: "chauffeur-1", isActive: true });
    expect(
      updateChauffeurFormSchema.parse({ chauffeurId: "chauffeur-1", isActive: "false" }),
    ).toEqual({ chauffeurId: "chauffeur-1", isActive: false });
    expect(updateChauffeurFormSchema.safeParse({ chauffeurId: "", isActive: "true" }).success).toBe(
      false,
    );
  });
});
