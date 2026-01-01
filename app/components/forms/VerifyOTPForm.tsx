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

export function VerifyOTPForm({ authEmail, authError, actionData }: VerifyOTPFormProps) {
  const { onResendOTP, isResending, hasResentSuccessfully } = useResendOTP(authEmail, actionData);
  const isPending = useIsPending();

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
                  {/* Show authError for backend OTP mismatches (from cross-route or backend errors) */}
                  {/* Hide errors after successful resend to prevent contradictory feedback */}
                  {!hasResentSuccessfully && authError && (
                    <span className="mb-2 text-sm text-destructive dark:text-destructive-foreground">
                      {getErrorMessage(authError)}
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
