import { z } from "zod";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const replacementFileSchema = z
  .file({ error: "Choose a replacement file" })
  .refine((file) => file.size > 0, "Choose a replacement file");

export const fleetCarFileReplacementFormSchema = z
  .object({
    intent: z.enum(["replace-image", "replace-document"]),
    assetId: z.string().min(1),
    file: replacementFileSchema,
  })
  .superRefine(({ file, intent }, context) => {
    const isImage = intent === "replace-image";
    const validType = isImage ? IMAGE_MIME_TYPES.has(file.type) : file.type === "application/pdf";

    if (!validType) {
      context.addIssue({
        code: "custom",
        message: isImage ? "Images must be JPEG, PNG or WebP" : "Documents must be PDF files",
        path: ["file"],
      });
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      context.addIssue({
        code: "custom",
        message: isImage
          ? "Each image must be less than 5MB"
          : "Document files must be less than 5MB",
        path: ["file"],
      });
    }
  });

export type FleetCarFileReplacementActionData = {
  readonly error?: string;
  readonly revalidate?: false;
  readonly success?: true;
};
