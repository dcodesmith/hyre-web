import { parseWithZod } from "@conform-to/zod/v4";
import { describe, expect, it } from "vitest";

import {
  carOnboardingDocumentsFormSchema,
  carOnboardingImagesFormSchema,
  carOnboardingInsuranceFormSchema,
  carOnboardingPlateFormSchema,
  carOnboardingPricingFormSchema,
} from "./car-onboarding-form-schema";

function documentFile(name = "mot.pdf", type = "application/pdf", size = 1024) {
  return new File([new Uint8Array(size)], name, { type });
}

function imageFile(name = "car.jpg", type = "image/jpeg", size = 1024) {
  return new File([new Uint8Array(size)], name, { type });
}

const validPricing = {
  hourlyRate: "10000",
  dayRate: "80000",
  nightRate: "60000",
  fullDayRate: "150000",
  airportPickupRate: "50000",
  fuelUpgradeRate: "20000",
  vehicleType: "SUV",
  serviceTier: "LUXURY",
};

const validPolicyNumber = "POL-12345";
const validPlateFields = { plateNumber: "ABC123XY", policyNumber: validPolicyNumber };

describe("car onboarding form schemas", () => {
  it.each([
    ["ABC-123XY", "ABC123XY"],
    ["abc123xy", "ABC123XY"],
    ["ABC 123 XY", "ABC123XY"],
    ["ab123xy", "AB123XY"],
  ] as const)("accepts and normalizes Nigerian plate %s with a policy", (input, normalized) => {
    expect(
      carOnboardingPlateFormSchema.parse({ plateNumber: input, policyNumber: validPolicyNumber }),
    ).toEqual({
      plateNumber: normalized,
      policyNumber: validPolicyNumber,
    });
  });

  it("trims the initial-form policy number", () => {
    expect(
      carOnboardingPlateFormSchema.parse({
        plateNumber: "ABC-123XY",
        policyNumber: "  POL-12345  ",
      }),
    ).toEqual({
      plateNumber: "ABC123XY",
      policyNumber: "POL-12345",
    });
  });

  it.each(["ABC123", "AB-123XY", "ABC-12XY", "ABCD123XY", ""] as const)(
    "rejects malformed plate %s even with a valid policy",
    (plateNumber) => {
      expect(
        carOnboardingPlateFormSchema.safeParse({ plateNumber, policyNumber: validPolicyNumber })
          .success,
      ).toBe(false);
    },
  );

  it.each([
    ["empty", ""],
    ["too short", "AB"],
    ["too long", "A".repeat(101)],
    ["whitespace only", "   "],
  ] as const)("rejects a %s policy even with a valid plate", (_label, policyNumber) => {
    expect(
      carOnboardingPlateFormSchema.safeParse({
        plateNumber: validPlateFields.plateNumber,
        policyNumber,
      }).success,
    ).toBe(false);
  });

  it("rejects a missing policy number on the initial form", () => {
    expect(carOnboardingPlateFormSchema.safeParse({ plateNumber: "ABC123XY" }).success).toBe(false);
  });

  it("accepts PDF documents at or under 5MB", () => {
    const motCertificate = documentFile();
    const insuranceCertificate = documentFile("insurance.pdf");

    expect(
      carOnboardingDocumentsFormSchema.parse({ motCertificate, insuranceCertificate }),
    ).toEqual({ motCertificate, insuranceCertificate });
    expect(
      carOnboardingDocumentsFormSchema.parse({
        motCertificate: documentFile("mot.pdf", "application/pdf", 5 * 1024 * 1024),
        insuranceCertificate,
      }).motCertificate.size,
    ).toBe(5 * 1024 * 1024);
  });

  it("reports the required-file messages through Conform for empty document inputs", () => {
    const formData = new FormData();
    formData.set("motCertificate", new File([], ""));
    formData.set("insuranceCertificate", new File([], ""));
    const submission = parseWithZod(formData, { schema: carOnboardingDocumentsFormSchema });

    expect(submission.status).toBe("error");
    if (submission.status !== "error") return;
    expect(submission.error).toEqual({
      motCertificate: ["MOT certificate is required"],
      insuranceCertificate: ["Insurance certificate is required"],
    });
  });

  it("uses field-specific messages when documents are missing", () => {
    const parsed = carOnboardingDocumentsFormSchema.safeParse({});
    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    expect(parsed.error.issues.find((issue) => issue.path[0] === "motCertificate")?.message).toBe(
      "MOT certificate is required",
    );
    expect(
      parsed.error.issues.find((issue) => issue.path[0] === "insuranceCertificate")?.message,
    ).toBe("Insurance certificate is required");
  });

  it("rejects document MIME types other than PDF or files larger than 5MB", () => {
    const insuranceCertificate = documentFile("insurance.pdf");

    expect(
      carOnboardingDocumentsFormSchema.safeParse({
        motCertificate: documentFile("mot.jpg", "image/jpeg"),
        insuranceCertificate,
      }).success,
    ).toBe(false);
    expect(
      carOnboardingDocumentsFormSchema.safeParse({
        motCertificate: documentFile("mot.pdf", "application/pdf", 5 * 1024 * 1024 + 1),
        insuranceCertificate,
      }).success,
    ).toBe(false);
  });

  it("accepts 3-5 images that are JPEG, PNG, or WebP at or under 5MB", () => {
    const three = [
      imageFile("a.jpg", "image/jpeg"),
      imageFile("b.png", "image/png"),
      imageFile("c.webp", "image/webp"),
    ];
    const five = [...three, imageFile("d.jpg"), imageFile("e.png", "image/png")];

    expect(carOnboardingImagesFormSchema.parse({ images: three }).images).toEqual(three);
    expect(carOnboardingImagesFormSchema.parse({ images: five }).images).toHaveLength(5);
  });

  it("reports a useful message when fewer than 3 images are selected", () => {
    const parsed = carOnboardingImagesFormSchema.safeParse({});
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues[0]?.message).toBe("Upload at least 3 images");
    expect(carOnboardingImagesFormSchema.safeParse({ images: [imageFile()] }).success).toBe(false);
    expect(
      carOnboardingImagesFormSchema.safeParse({ images: [imageFile(), imageFile("b.jpg")] })
        .success,
    ).toBe(false);

    const submission = parseWithZod(new FormData(), { schema: carOnboardingImagesFormSchema });
    expect(submission.status).toBe("error");
    if (submission.status !== "error") return;
    expect(submission.error?.images).toEqual(["Upload at least 3 images"]);
  });

  it("rejects image count, MIME, and files larger than 5MB", () => {
    expect(carOnboardingImagesFormSchema.safeParse({ images: [] }).success).toBe(false);
    expect(
      carOnboardingImagesFormSchema.safeParse({
        images: Array.from({ length: 6 }, (_, index) => imageFile(`${index}.jpg`)),
      }).success,
    ).toBe(false);
    expect(
      carOnboardingImagesFormSchema.safeParse({
        images: [
          imageFile("a.gif", "image/gif"),
          imageFile("b.gif", "image/gif"),
          imageFile("c.gif", "image/gif"),
        ],
      }).success,
    ).toBe(false);
    expect(
      carOnboardingImagesFormSchema.safeParse({
        images: [
          imageFile("a.jpg", "image/jpeg", 5 * 1024 * 1024 + 1),
          imageFile("b.jpg"),
          imageFile("c.jpg"),
        ],
      }).success,
    ).toBe(false);
  });

  it("reports an empty named image separately from an oversized image", () => {
    const parsed = carOnboardingImagesFormSchema.safeParse({
      images: [imageFile("empty.jpg", "image/jpeg", 0), imageFile("b.jpg"), imageFile("c.jpg")],
    });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    expect(parsed.error.issues[0]?.message).toBe("The selected image is empty");
  });

  it("coerces positive integer pricing and vehicle/service enums", () => {
    expect(carOnboardingPricingFormSchema.parse(validPricing)).toEqual({
      hourlyRate: 10_000,
      dayRate: 80_000,
      nightRate: 60_000,
      fullDayRate: 150_000,
      airportPickupRate: 50_000,
      fuelUpgradeRate: 20_000,
      pricingIncludesFuel: false,
      vehicleType: "SUV",
      serviceTier: "LUXURY",
    });
    expect(
      carOnboardingPricingFormSchema.safeParse({ ...validPricing, hourlyRate: "0" }).success,
    ).toBe(false);
    expect(
      carOnboardingPricingFormSchema.safeParse({ ...validPricing, vehicleType: "TRUCK" }).success,
    ).toBe(false);
    expect(
      carOnboardingPricingFormSchema.safeParse({ ...validPricing, serviceTier: "PREMIUM" }).success,
    ).toBe(false);
  });

  it.each([
    ["hourlyRate", "Hourly rate"],
    ["dayRate", "Daily rate"],
    ["nightRate", "Nightly rate"],
    ["fullDayRate", "Full day rate"],
    ["airportPickupRate", "Airport pickup rate"],
  ] as const)("keeps the required message when %s is blank", (field, label) => {
    for (const blank of ["", "   ", null] as const) {
      const parsed = carOnboardingPricingFormSchema.safeParse({ ...validPricing, [field]: blank });
      expect(parsed.success).toBe(false);
      if (parsed.success) return;
      expect(parsed.error.issues.find((issue) => issue.path[0] === field)?.message).toBe(
        `${label} is required`,
      );
    }

    const formData = new FormData();
    for (const [name, value] of Object.entries(validPricing)) {
      formData.set(name, name === field ? "" : value);
    }
    const submission = parseWithZod(formData, { schema: carOnboardingPricingFormSchema });
    expect(submission.status).toBe("error");
    if (submission.status !== "error") return;
    expect(submission.error?.[field]).toEqual([`${label} is required`]);
  });

  it("rejects an explicit zero with the greater-than-zero message", () => {
    const parsed = carOnboardingPricingFormSchema.safeParse({ ...validPricing, hourlyRate: "0" });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues.find((issue) => issue.path[0] === "hourlyRate")?.message).toBe(
      "Hourly rate must be greater than 0",
    );
  });

  it("requires fuelUpgradeRate only when pricing does not include fuel", () => {
    expect(
      carOnboardingPricingFormSchema.safeParse({ ...validPricing, fuelUpgradeRate: "" }).success,
    ).toBe(false);
    expect(
      carOnboardingPricingFormSchema.parse({
        ...validPricing,
        fuelUpgradeRate: "",
        pricingIncludesFuel: "on",
      }),
    ).toMatchObject({ pricingIncludesFuel: true, fuelUpgradeRate: null });
  });

  it("accepts a trimmed policy number of 3-100 characters", () => {
    expect(carOnboardingInsuranceFormSchema.parse({ policyNumber: "  ABC  " })).toEqual({
      policyNumber: "ABC",
    });
    expect(
      carOnboardingInsuranceFormSchema.parse({ policyNumber: "A".repeat(100) }).policyNumber,
    ).toHaveLength(100);
    expect(carOnboardingInsuranceFormSchema.safeParse({ policyNumber: "AB" }).success).toBe(false);
    expect(
      carOnboardingInsuranceFormSchema.safeParse({ policyNumber: "A".repeat(101) }).success,
    ).toBe(false);
  });
});
