import type { z } from "zod";

export const MAX_UPLOAD_FILE_SIZE_BYTES = 5 * 1024 * 1024;

type FileValidationOptions = {
  readonly allowedTypes: ReadonlySet<string>;
  readonly context: z.RefinementCtx;
  readonly emptyMessage: string;
  readonly file: File | undefined;
  readonly invalidTypeMessage: string;
  readonly oversizedMessage: string;
  readonly path: ReadonlyArray<PropertyKey>;
};

export function addFileValidationIssues({
  allowedTypes,
  context,
  emptyMessage,
  file,
  invalidTypeMessage,
  oversizedMessage,
  path,
}: FileValidationOptions) {
  if (!file) {
    return;
  }
  if (file.size <= 0) {
    context.addIssue({ code: "custom", message: emptyMessage, path: [...path] });
  } else if (file.size > MAX_UPLOAD_FILE_SIZE_BYTES) {
    context.addIssue({ code: "custom", message: oversizedMessage, path: [...path] });
  }
  if (!allowedTypes.has(file.type)) {
    context.addIssue({ code: "custom", message: invalidTypeMessage, path: [...path] });
  }
}
