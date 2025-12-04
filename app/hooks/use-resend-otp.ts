import { useCallback, useEffect, useRef, useState } from "react";
import { authClient } from "~/lib/auth-client";
import { useToast } from "~/hooks/use-toast";

/**
 * Hook for handling OTP resend with rate limiting
 *
 * Provides a consistent interface for resending OTP codes across all verify routes
 * with proper error handling, rate limit detection, and user feedback via toasts.
 *
 * @param email - The email address to send the OTP to
 * @param actionData - Optional actionData from Remix to detect new form submissions
 * @returns Object containing the resend handler, loading state, and error cleared flag
 *
 * @example
 * ```tsx
 * const actionData = useActionData<typeof action>();
 * const { onResendOTP, isResending, hasResentSuccessfully } = useResendOTP(authEmail, actionData);
 *
 * <Button onClick={onResendOTP} disabled={isResending}>
 *   {isResending ? "Sending..." : "Request New Code"}
 * </Button>
 *
 * {!hasResentSuccessfully && actionData?.error && (
 *   <div>{actionData.error}</div>
 * )}
 * ```
 */
export function useResendOTP(email: string | undefined, actionData?: unknown) {
  const { toast } = useToast();
  const [isResending, setIsResending] = useState(false);
  const [hasResentSuccessfully, setHasResentSuccessfully] = useState(false);
  const previousActionDataRef = useRef<typeof actionData>(actionData);

  // Reset hasResentSuccessfully when a new form submission happens (actionData changes)
  // This ensures that new errors are shown, but errors are cleared after successful resend
  useEffect(() => {
    // Only reset if actionData actually changed (new form submission)
    if (actionData !== previousActionDataRef.current) {
      previousActionDataRef.current = actionData;
      // Only reset if there's a new error (new form submission with error)
      // Check for error property that is a string (backend OTP errors)
      if (
        actionData &&
        typeof actionData === "object" &&
        "error" in actionData &&
        typeof actionData.error === "string" &&
        actionData.error
      ) {
        setHasResentSuccessfully(false);
      }
    }
  }, [actionData]);

  const onResendOTP = useCallback(async () => {
    if (isResending) return;

    if (!email) {
      toast({
        title: "Error",
        description: "Email address is required",
        variant: "destructive",
      });
      return;
    }

    setIsResending(true);

    try {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: "sign-in",
      });

      if (result.error) {
        // Check if it's a rate limit error (429)
        const errorMessage = result.error.message || String(result.error);
        const isRateLimitError = result.error.status === 429;

        const displayMessage = isRateLimitError ? errorMessage : "Failed to send verification code";

        toast({
          title: isRateLimitError ? "Rate limit exceeded" : "Error",
          description: displayMessage,
          variant: "destructive",
        });
        // Don't clear errors on failed resend
        setHasResentSuccessfully(false);
      } else {
        toast({
          title: "Code sent",
          description: "A new verification code has been sent to your email.",
        });
        // Clear previous verification errors on successful resend
        setHasResentSuccessfully(true);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send verification code",
        variant: "destructive",
      });
      // Don't clear errors on failed resend
      setHasResentSuccessfully(false);
    } finally {
      setIsResending(false);
    }
  }, [email, toast, isResending]);

  return {
    onResendOTP,
    isResending,
    hasResentSuccessfully,
  };
}
