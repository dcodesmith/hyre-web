import { describe, expect, it } from "vitest";
import { verificationInterventionsSchema } from "./schema";

const interventionId = "018f47a2-7b3c-7d4e-8f90-1234567894c1";
const documentId = "018f47a2-7b3c-7d4e-8f90-1234567894c2";
const userId = "018f47a2-7b3c-7d4e-8f90-1234567894c3";

const queue = {
  items: [
    {
      id: interventionId,
      kind: "CHAUFFEUR_DRIVERS_LICENSE",
      status: "OPEN",
      applicantName: "Ada Lovelace",
      licenseLast4: "DE67",
      hasSelfie: false,
      hasNinPortrait: false,
      document: null,
      retryAttempt: 1,
      createdAt: "2026-09-26T12:00:00.000Z",
      licenseNumber: "ABC12345DE67",
      encryptedPayload: "secret",
    },
    {
      id: "018f47a2-7b3c-7d4e-8f90-1234567894c4",
      kind: "CHAUFFEUR_FACE",
      status: "OPEN",
      applicantName: "Ada Lovelace",
      licenseLast4: null,
      hasSelfie: true,
      hasNinPortrait: true,
      document: null,
      retryAttempt: 0,
      createdAt: "2026-09-26T12:00:00.000Z",
    },
    {
      id: "018f47a2-7b3c-7d4e-8f90-1234567894c5",
      kind: "OWNER_DRIVER_LICENSE",
      status: "OPEN",
      applicantName: "Ada Lovelace",
      licenseLast4: "DE67",
      hasSelfie: false,
      hasNinPortrait: false,
      document: { id: documentId, userId, status: "PENDING" },
      retryAttempt: 0,
      createdAt: "2026-09-26T12:00:00.000Z",
    },
    {
      id: "018f47a2-7b3c-7d4e-8f90-1234567894c6",
      kind: "OWNER_DRIVER_FACE",
      status: "OPEN",
      applicantName: "Grace Hopper",
      licenseLast4: null,
      hasSelfie: true,
      hasNinPortrait: false,
      document: null,
      retryAttempt: 2,
      createdAt: "2026-09-26T12:00:00.000Z",
    },
  ],
  meta: { page: 1, limit: 100, total: 4, totalPages: 1 },
};

describe("verification intervention schema", () => {
  it("accepts the staff queue and drops sensitive fields", () => {
    const parsed = verificationInterventionsSchema.parse(queue);

    expect(parsed.items[0]).not.toHaveProperty("licenseNumber");
    expect(parsed.items[0]).not.toHaveProperty("encryptedPayload");
    expect(parsed.items[0]).not.toHaveProperty("retryAttempt");
    expect(parsed.items[0]?.licenseLast4).toBe("DE67");
    expect(parsed.items[1]).toMatchObject({ hasSelfie: true, hasNinPortrait: true });
    expect(parsed.items[2]?.document).toEqual({ id: documentId, userId, status: "PENDING" });
    expect(parsed.items[3]).toMatchObject({
      kind: "OWNER_DRIVER_FACE",
      hasSelfie: true,
      hasNinPortrait: false,
    });
    expect(parsed.items[3]).not.toHaveProperty("retryAttempt");
  });

  it("rejects a queue item that is missing the public contract", () => {
    const { licenseLast4: _licenseLast4, ...incomplete } = queue.items[0] ?? {};

    expect(
      verificationInterventionsSchema.safeParse({ ...queue, items: [incomplete] }).success,
    ).toBe(false);
  });
});
