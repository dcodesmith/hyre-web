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

describe("car onboarding form schemas", () => {
  it.each([
    ["ABC-123XY", "ABC123XY"],
    ["abc123xy", "ABC123XY"],
    ["ABC 123 XY", "ABC123XY"],
    ["ab123xy", "AB123XY"],
  ] as const)("accepts and normalizes Nigerian plate %s", (input, normalized) => {
    expect(carOnboardingPlateFormSchema.parse({ plateNumber: input })).toEqual({
      plateNumber: normalized,
    });
  });

  it.each(["ABC123", "AB-123XY", "ABC-12XY", "ABCD123XY", ""] as const)(
    "rejects malformed plate %s",
    (plateNumber) => {
      expect(carOnboardingPlateFormSchema.safeParse({ plateNumber }).success).toBe(false);
    },
  );

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

  it("accepts 1-5 images that are JPEG, PNG, or WebP at or under 5MB", () => {
    const one = [imageFile()];
    const five = [
      imageFile("a.jpg", "image/jpeg"),
      imageFile("b.png", "image/png"),
      imageFile("c.webp", "image/webp"),
      imageFile("d.jpg"),
      imageFile("e.png", "image/png"),
    ];

    expect(carOnboardingImagesFormSchema.parse({ images: one }).images).toEqual(one);
    expect(carOnboardingImagesFormSchema.parse({ images: five }).images).toHaveLength(5);
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
        images: [imageFile("car.gif", "image/gif")],
      }).success,
    ).toBe(false);
    expect(
      carOnboardingImagesFormSchema.safeParse({
        images: [imageFile("car.jpg", "image/jpeg", 5 * 1024 * 1024 + 1)],
      }).success,
    ).toBe(false);
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
