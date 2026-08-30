import { describe, expect, it } from "vitest";

import { fleetCarFileReplacementFormSchema } from "./fleet-car-file-replacement-form-schema";

const ASSET_ID = "cm12345678901234567890123";

describe("fleetCarFileReplacementFormSchema", () => {
  it.each([
    ["replace-image", "photo.jpg", "image/jpeg"],
    ["replace-document", "mot.pdf", "application/pdf"],
  ] as const)("accepts %s submissions", (intent, name, type) => {
    const file = new File(["replacement"], name, { type });

    expect(
      fleetCarFileReplacementFormSchema.parse({
        intent,
        assetId: ASSET_ID,
        file,
      }),
    ).toEqual({ intent, assetId: ASSET_ID, file });
  });

  it("uses the asset copy when the id is omitted", () => {
    const result = fleetCarFileReplacementFormSchema.safeParse({
      intent: "replace-image",
      file: new File(["replacement"], "photo.jpg", { type: "image/jpeg" }),
    });

    expect(result.error?.issues[0]?.message).toBe("Asset ID is required");
  });

  it("requires a non-empty replacement file", () => {
    const result = fleetCarFileReplacementFormSchema.safeParse({
      intent: "replace-image",
      assetId: ASSET_ID,
      file: new File([], "photo.jpg", { type: "image/jpeg" }),
    });

    expect(result.success).toBe(false);
  });

  it.each([
    ["replace-image", "photo.gif", "image/gif", "Images must be JPEG, PNG or WebP"],
    ["replace-document", "mot.jpg", "image/jpeg", "Documents must be PDF files"],
  ] as const)("rejects invalid files for %s", (intent, name, type, message) => {
    const result = fleetCarFileReplacementFormSchema.safeParse({
      intent,
      assetId: ASSET_ID,
      file: new File(["replacement"], name, { type }),
    });

    expect(result.error?.issues[0]?.message).toBe(message);
  });

  it("rejects files larger than 5 MB", () => {
    const result = fleetCarFileReplacementFormSchema.safeParse({
      intent: "replace-document",
      assetId: ASSET_ID,
      file: new File([new Uint8Array(5 * 1024 * 1024 + 1)], "mot.pdf", {
        type: "application/pdf",
      }),
    });

    expect(result.error?.issues[0]?.message).toBe("Document files must be less than 5MB");
  });
});
