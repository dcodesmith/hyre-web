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

export function normalizeProblemDetails(input: unknown, fallback: ProblemFallback): ProblemDetails {
  const parsed = problemDetailsSchema.safeParse(input);

  if (parsed.success) {
    if (fallback.status >= 500) {
      return {
        type: "UPSTREAM_HTTP_ERROR",
        title: fallback.title,
        status: fallback.status,
        detail: fallback.detail,
        instance: fallback.instance,
      };
    }

    return {
      type: parsed.data.type,
      title: parsed.data.title,
      status: fallback.status,
      detail: parsed.data.detail,
      instance: parsed.data.instance ?? fallback.instance,
      errorCode: parsed.data.errorCode,
      errors: parsed.data.errors,
      details: parsed.data.details,
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

export function toPublicProblemDetails(problem: ProblemDetails): ProblemDetails {
  if (problem.status < 500) {
    return problem;
  }

  return {
    type: problem.type,
    title: problem.title,
    status: problem.status,
    detail: problem.detail,
    instance: problem.instance,
  };
}
