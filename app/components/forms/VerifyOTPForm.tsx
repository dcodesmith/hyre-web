import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { CogIcon } from "@heroicons/react/24/outline";
import { Form } from "~/components/CSRFForm";
import { Button } from "~/components/ui/button";
import { VerifySchema } from "~/schemas/otp.schema";
import { Input } from "~/components/ui/input";
import { useResendOTP } from "~/hooks/use-resend-otp";
import { useIsPending } from "~/lib/utils";

interface VerifyOTPFormProps {
  readonly authEmail?: string;
  readonly authError: unknown;
  readonly actionData: unknown;
}

type VerifyOtpLastResult = Parameters<typeof useForm>[0]["lastResult"];

function getErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return "An error occurred";
}

function getActionErrorInfo(actionData: unknown): {
  message?: string;
  isRateLimit: boolean;
  retryAfterSeconds?: number;
} {
  if (actionData && typeof actionData === "object") {
    const message = "error" in actionData ? getErrorMessage(actionData.error) : undefined;
    const isRateLimit = "isRateLimit" in actionData && actionData.isRateLimit === true;
    const retryAfterSeconds =
      "retryAfterSeconds" in actionData && typeof actionData.retryAfterSeconds === "number"
        ? actionData.retryAfterSeconds
        : undefined;
    return { message, isRateLimit, retryAfterSeconds };
  }

  return { message: undefined, isRateLimit: false, retryAfterSeconds: undefined };
}

function formatRetryAfterSeconds(seconds: number) {
  const safeSeconds = Math.max(1, Math.ceil(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  if (minutes === 0) {
    return `${safeSeconds} second${safeSeconds === 1 ? "" : "s"}`;
  }

  if (remainingSeconds === 0) {
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  }

  return `${minutes} minute${minutes === 1 ? "" : "s"} ${remainingSeconds} second${
    remainingSeconds === 1 ? "" : "s"
  }`;
}

export function VerifyOTPForm({ authEmail, authError, actionData }: VerifyOTPFormProps) {
  const { onResendOTP, isResending, hasResentSuccessfully } = useResendOTP(authEmail, actionData);
  const isPending = useIsPending();
  const actionError = getActionErrorInfo(actionData);
  const authErrorMessage = authError ? getErrorMessage(authError) : undefined;
  const shouldShowBackendError = hasResentSuccessfully === false;
  const rateLimitError =
    shouldShowBackendError && actionError.isRateLimit && actionError.message
      ? actionError
      : undefined;
  let visibleError: string | undefined;
  if (shouldShowBackendError) {
    visibleError = actionError.isRateLimit
      ? authErrorMessage
      : actionError.message || authErrorMessage;
  }

  const [codeForm, { code }] = useForm({
    lastResult:
      typeof actionData === "object" && actionData !== null && "status" in actionData
        ? (actionData as VerifyOtpLastResult)
        : null,
    constraint: getZodConstraint(VerifySchema),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: VerifySchema });
    },
  });
  const codeErrors = Array.isArray(code.errors)
    ? code.errors.filter((error): error is string => typeof error === "string")
    : [];

  return (
    <>
      <div className="fade-up anim-delay-100 mb-8">
        <h2 className="mb-1 text-[2rem] font-normal leading-snug text-[#1A1814]">
          Enter verification code
        </h2>
        <p className="text-sm font-light text-neutral-500">
          We sent a 6-digit code to {authEmail ?? "your email"}.
        </p>
      </div>

      <div className="fade-up anim-delay-200">
        <Form method="post" {...getFormProps(codeForm)}>
          <div className="flex flex-col gap-4">
            {rateLimitError && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3">
                <p className="text-sm font-medium text-destructive">{rateLimitError.message}</p>
                {typeof rateLimitError.retryAfterSeconds === "number" &&
                  rateLimitError.retryAfterSeconds > 0 && (
                    <p className="mt-1 text-xs text-destructive/80">
                      Try again in {formatRetryAfterSeconds(rateLimitError.retryAfterSeconds)}.
                    </p>
                  )}
              </div>
            )}

            <div className="space-y-1.5">
              <label
                htmlFor={code.id}
                className="block text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-500"
              >
                Verification code
              </label>
              <Input
                maxLength={6}
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                className={`h-11 rounded-lg border-neutral-200 px-4 text-[#1A1814] tracking-[0.3em] placeholder:tracking-normal placeholder:text-neutral-400 focus-visible:ring-[#B8922A]/20 ${
                  codeErrors.length > 0
                    ? "border-destructive focus-visible:ring-destructive"
                    : "focus-visible:border-[#B8922A]"
                }`}
                {...getInputProps(code, { type: "text" })}
              />
              <p className="text-xs font-light text-neutral-500">
                Enter the 6-digit code sent to your email.
              </p>
            </div>

            <div className="flex flex-col">
              {codeErrors.length > 0 && (
                <span className="mb-2 text-sm text-destructive dark:text-destructive-foreground">
                  {codeErrors.join(" ")}
                </span>
              )}
              {visibleError && (
                <span className="mb-2 text-sm text-destructive dark:text-destructive-foreground">
                  {visibleError}
                </span>
              )}
            </div>

            <Button
              type="submit"
              className="h-12 w-full rounded-lg bg-[#1A1814] px-6 py-3.5 text-xs font-medium uppercase tracking-[0.08em] text-white hover:bg-neutral-800"
              disabled={isPending}
            >
              {isPending ? <CogIcon className="h-5 w-5 animate-spin" /> : "Verify"}
            </Button>
          </div>
        </Form>
      </div>

      <div className="mt-5 space-y-2">
        <p className="text-center text-xs font-light text-neutral-500">Did not receive the code?</p>
        <Button
          type="button"
          variant="ghost"
          className="w-full text-[#B8922A] hover:bg-transparent hover:text-[#B8922A]"
          onClick={onResendOTP}
          disabled={isResending}
        >
          {isResending ? "Sending..." : "Request New Code"}
        </Button>
      </div>

      <p className="fade-up anim-delay-300 mt-6 text-center text-xs font-light leading-relaxed text-neutral-400">
        Protected by industry-standard encryption.
        <br />
        We never share your data with third parties.
      </p>
    </>
  );
}
