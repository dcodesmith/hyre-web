import { z } from "zod";
import { HTTP_STATUS } from "./http-status";

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

const PUBLIC_UPSTREAM_ERROR = {
  type: "UPSTREAM_HTTP_ERROR",
  title: "Upstream API error",
  detail: "The upstream API returned an error.",
} as const;

function toPublicUpstreamError(status: number, instance?: string): ProblemDetails {
  return {
    type: PUBLIC_UPSTREAM_ERROR.type,
    title: PUBLIC_UPSTREAM_ERROR.title,
    status,
    detail: PUBLIC_UPSTREAM_ERROR.detail,
    instance,
  };
}

export function normalizeProblemDetails(input: unknown, fallback: ProblemFallback): ProblemDetails {
  if (fallback.status >= HTTP_STATUS.INTERNAL_SERVER_ERROR) {
    return toPublicUpstreamError(fallback.status, fallback.instance);
  }

  const parsed = problemDetailsSchema.safeParse(input);

  if (parsed.success) {
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
    type: PUBLIC_UPSTREAM_ERROR.type,
    title: fallback.title,
    status: fallback.status,
    detail: fallback.detail,
    instance: fallback.instance,
  };
}

export function toPublicProblemDetails(problem: ProblemDetails): ProblemDetails {
  if (problem.status < HTTP_STATUS.INTERNAL_SERVER_ERROR) {
    return problem;
  }

  return toPublicUpstreamError(problem.status, problem.instance);
}
