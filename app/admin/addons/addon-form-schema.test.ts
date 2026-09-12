import { parseWithZod } from "@conform-to/zod/v4";
import { describe, expect, it } from "vitest";

import {
  createAddonFormSchema,
  createAddonPriceFormSchema,
  endAddonPriceFormSchema,
  toUtcIso,
  updateAddonFormSchema,
} from "./addon-form-schema";

const validCreate = {
  name: "Protocol service",
  code: "PROTOCOL_SERVICE",
  bookingTypes: ["DAY"],
  pricingUnit: "PER_BOOKING",
  financialTreatment: "PLATFORM",
};

const validPrice = {
  addonId: "cmaddonprotocol0000000001",
  amount: "15000",
  effectiveSince: "2026-09-01T09:00",
};

describe("createAddonFormSchema", () => {
  it("accepts a new add-on and treats a blank description as omitted", () => {
    expect(createAddonFormSchema.parse({ ...validCreate, description: "" })).toEqual(validCreate);
    expect(createAddonFormSchema.parse({ ...validCreate, description: "  Officer  " })).toEqual({
      ...validCreate,
      description: "Officer",
    });
  });

  it("requires UPPER_SNAKE_CASE code and at least one unique booking type", () => {
    expect(createAddonFormSchema.safeParse({ ...validCreate, code: "protocol" }).success).toBe(
      false,
    );
    expect(createAddonFormSchema.safeParse({ ...validCreate, bookingTypes: [] }).success).toBe(
      false,
    );
    expect(
      createAddonFormSchema.safeParse({ ...validCreate, bookingTypes: ["DAY", "DAY"] }).success,
    ).toBe(false);

    const formData = new FormData();
    formData.set("name", "Protocol service");
    formData.set("code", "PROTOCOL_SERVICE");
    formData.append("bookingTypes", "DAY");
    formData.append("bookingTypes", "FULL_DAY");
    formData.set("pricingUnit", "PER_BOOKING");
    formData.set("financialTreatment", "PLATFORM");

    const submission = parseWithZod(formData, { schema: createAddonFormSchema });
    expect(submission.status).toBe("success");
    if (submission.status === "success") {
      expect(submission.value.bookingTypes).toEqual(["DAY", "FULL_DAY"]);
    }

    const oneType = new FormData();
    oneType.set("name", "Protocol service");
    oneType.set("code", "PROTOCOL_SERVICE");
    oneType.append("bookingTypes", "DAY");
    oneType.set("pricingUnit", "PER_BOOKING");
    oneType.set("financialTreatment", "PLATFORM");
    expect(parseWithZod(oneType, { schema: createAddonFormSchema }).status).toBe("success");
  });
});

describe("updateAddonFormSchema", () => {
  it("coerces isActive from the form string", () => {
    expect(
      updateAddonFormSchema.parse({
        addonId: "cmaddonprotocol0000000001",
        name: "Protocol service",
        bookingTypes: ["DAY"],
        isActive: "false",
      }),
    ).toMatchObject({ isActive: false });
  });
});

describe("createAddonPriceFormSchema", () => {
  it("parses a price window and serializes it as UTC", () => {
    expect(createAddonPriceFormSchema.parse(validPrice)).toEqual({
      addonId: "cmaddonprotocol0000000001",
      amount: 15_000,
      effectiveSince: "2026-09-01T09:00",
    });
    expect(toUtcIso("2026-09-01T09:00")).toBe("2026-09-01T09:00:00.000Z");
  });

  it("rejects a non-positive amount or reversed window", () => {
    expect(createAddonPriceFormSchema.safeParse({ ...validPrice, amount: "0" }).success).toBe(
      false,
    );
    expect(
      createAddonPriceFormSchema.safeParse({
        ...validPrice,
        effectiveUntil: "2026-08-01T09:00",
      }).success,
    ).toBe(false);
  });
});

describe("endAddonPriceFormSchema", () => {
  it("requires both add-on and price ids", () => {
    expect(
      endAddonPriceFormSchema.parse({
        addonId: "cmaddonprotocol0000000001",
        priceId: "cmaddonprice0000000000001",
      }),
    ).toEqual({
      addonId: "cmaddonprotocol0000000001",
      priceId: "cmaddonprice0000000000001",
    });
    expect(
      endAddonPriceFormSchema.safeParse({
        addonId: "cmaddonprotocol0000000001",
        priceId: "price-1",
      }).success,
    ).toBe(false);
  });
});
