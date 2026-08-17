import { z } from "zod";

export const problemDetailsSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string(),
  instance: z.string().optional(),
  errorCode: z.string().optional(),
  errors: z.array(z.unknown()).optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});

export type ProblemDetails = z.infer<typeof problemDetailsSchema>;

type ProblemFallback = {
  status: number;
  title: string;
  detail: string;
  instance: string;
};

export function normalizeProblemDetails(
  input: unknown,
  fallback: ProblemFallback,
): ProblemDetails {
  const parsed = problemDetailsSchema.safeParse(input);

  if (parsed.success) {
    return {
      ...parsed.data,
      status: fallback.status,
      instance: parsed.data.instance ?? fallback.instance,
    };
  }

  return {
    type: "UPSTREAM_HTTP_ERROR",
    title: fallback.title,
    status: fallback.status,
    detail: fallback.detail,
    instance: fallback.instance,
  };
}
