import { getFormProps, getInputProps, type SubmissionResult, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { Loader2, MailCheck } from "lucide-react";
import { Form, Link, useNavigation } from "react-router";

import { guestBookingFormSchema } from "~/booking/guest-booking-form-schema";
import { FormError } from "~/components/forms/form-primitives";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Field, FieldError, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";

export type GuestBookingLookupActionData = {
  readonly message?: string;
  readonly result: SubmissionResult<string[]>;
};

export function GuestBookingLookupPage({
  actionData,
  statusMessage,
}: {
  readonly actionData?: GuestBookingLookupActionData;
  readonly statusMessage?: string;
}) {
  const navigation = useNavigation();
  const isSubmitting = navigation.formMethod === "POST";
  const [form, fields] = useForm({
    id: "guest-booking-lookup",
    lastResult: actionData?.result,
    constraint: getZodConstraint(guestBookingFormSchema),
    shouldValidate: "onSubmit",
    shouldRevalidate: "onInput",
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: guestBookingFormSchema });
    },
  });

  return (
    <div className="mx-auto w-full max-w-md space-y-6 px-4 py-8 sm:py-12">
      <div className="space-y-1.5">
        <h1 className="font-heading text-xl leading-snug font-medium">Find your booking</h1>
        <p className="text-sm text-muted-foreground">
          Enter the booking reference and email address used for your booking. We&apos;ll email you
          a secure link that works for 15 minutes.
        </p>
      </div>

      <Form method="post" className="space-y-5" {...getFormProps(form)}>
        {statusMessage && !actionData?.message && !form.errors?.length ? (
          <Alert variant="destructive">
            <AlertTitle>Unable to open booking</AlertTitle>
            <AlertDescription>{statusMessage}</AlertDescription>
          </Alert>
        ) : null}

        {actionData?.message ? (
          <Alert>
            <MailCheck aria-hidden="true" />
            <AlertTitle>Check your email</AlertTitle>
            <AlertDescription>{actionData.message}</AlertDescription>
          </Alert>
        ) : null}

        <Field data-invalid={Boolean(fields.bookingReference.errors)}>
          <FieldLabel htmlFor={fields.bookingReference.id}>Booking reference</FieldLabel>
          <Input
            {...getInputProps(fields.bookingReference, { type: "text" })}
            autoComplete="off"
            spellCheck={false}
            placeholder="BK-AB12CD34"
            className="h-11 uppercase"
          />
          <FieldError>{fields.bookingReference.errors}</FieldError>
        </Field>

        <Field data-invalid={Boolean(fields.email.errors)}>
          <FieldLabel htmlFor={fields.email.id}>Email address</FieldLabel>
          <Input
            {...getInputProps(fields.email, { type: "email" })}
            autoComplete="email"
            spellCheck={false}
            placeholder="you@example.com"
            className="h-11"
          />
          <FieldError>{fields.email.errors}</FieldError>
        </Field>

        <FormError id={form.errorId} errors={form.errors} />

        <Button type="submit" className="h-11 w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <span className="animate-spin motion-reduce:animate-none">
                <Loader2 aria-hidden="true" />
              </span>
              Sending access link…
            </>
          ) : (
            "Email me an access link"
          )}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Have an account?{" "}
          <Link to="/auth" className="font-medium text-foreground underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </Form>
    </div>
  );
}
