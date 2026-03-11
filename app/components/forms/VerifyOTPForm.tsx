import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { CogIcon } from "@heroicons/react/24/outline";
import { Form } from "~/components/CSRFForm";
import { Button } from "~/components/ui/button";
import { VerifySchema } from "~/schemas/otp.schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { useResendOTP } from "~/hooks/use-resend-otp";
import { useIsPending } from "~/lib/utils";

interface VerifyOTPFormProps {
  readonly authEmail?: string;
  readonly authError: unknown;
  readonly actionData: unknown;
}

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
    shouldShowBackendError && actionError.isRateLimit && actionError.message ? actionError : undefined;
  let visibleError: string | undefined;
  if (shouldShowBackendError) {
    visibleError = actionError.isRateLimit ? authErrorMessage : actionError.message || authErrorMessage;
  }

  const [codeForm, { code }] = useForm({
    lastResult: actionData && "status" in actionData ? actionData : null,
    constraint: getZodConstraint(VerifySchema),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: VerifySchema });
    },
  });

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-xs">
        <Card>
          <CardHeader>
            <CardTitle>Enter verification code</CardTitle>
            <CardDescription>
              We sent a 6-digit code to {authEmail ?? "your email"}.
            </CardDescription>
          </CardHeader>
          <CardContent>
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
                <div className="space-y-2">
                  <label htmlFor={code.id} className="text-sm font-medium">
                    Verification code
                  </label>
                  <Input
                    maxLength={6}
                    required
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="000000"
                    className={`bg-transparent ${
                      code.errors ? "border-destructive focus-visible:ring-destructive" : ""
                    }`}
                    {...getInputProps(code, { type: "text" })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter the 6-digit code sent to your email.
                  </p>
                </div>

                <div className="flex flex-col">
                  {code.errors && (
                    <span className="mb-2 text-sm text-destructive dark:text-destructive-foreground">
                      {code.errors.join(" ")}
                    </span>
                  )}
                  {/* Show actionData.error first, fallback to authError for cross-route failures */}
                  {/* Hide errors after successful resend to prevent contradictory feedback */}
                  {visibleError && (
                    <span className="mb-2 text-sm text-destructive dark:text-destructive-foreground">
                      {visibleError}
                    </span>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={isPending}>
                  {isPending ? <CogIcon className="h-5 w-5 animate-spin" /> : "Verify"}
                </Button>
              </div>
            </Form>

            <div className="mt-4 space-y-2">
              <p className="text-center text-sm font-normal text-primary/60">
                Did not receive the code?
              </p>
              <Button
                type="button"
                variant="ghost"
                className="w-full hover:bg-transparent"
                onClick={onResendOTP}
                disabled={isResending}
              >
                {isResending ? "Sending..." : "Request New Code"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
