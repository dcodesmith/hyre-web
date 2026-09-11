import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { CheckCircle2Icon, PlusCircleIcon, UserRoundIcon, UsersIcon } from "lucide-react";
import { Form, Link, useLocation, useNavigate, useNavigation } from "react-router";

import type { FleetOwnerChauffeur } from "~/api/chauffeurs/schema";
import { FormError } from "~/components/forms/form-primitives";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty";
import { Field, FieldDescription, FieldError, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";
import type { ChauffeurActionData } from "./chauffeur-form-schema";
import { inviteChauffeurFormSchema } from "./chauffeur-form-schema";
import { ChauffeurList } from "./chauffeur-list";
import { chauffeurPagePath } from "./chauffeurs-url";

type FleetChauffeursPageProps = {
  readonly actionData?: ChauffeurActionData;
  readonly chauffeurs: FleetOwnerChauffeur[];
  readonly complianceRequirements: ReadonlyArray<{
    readonly label: string;
    readonly required: boolean;
  }>;
  readonly idempotencyKey: string;
  readonly isOwnerDriver: boolean;
  readonly page: number;
  readonly total: number;
  readonly totalPages: number;
};

function InviteChauffeurForm({
  actionData,
  idempotencyKey,
}: {
  readonly actionData?: ChauffeurActionData;
  readonly idempotencyKey: string;
}) {
  const navigation = useNavigation();
  const pending = navigation.formData?.get("intent") === "invite";
  const inviteResult = actionData?.intent === "invite" ? actionData : undefined;
  const [form, fields] = useForm({
    id: "invite-chauffeur",
    lastResult: inviteResult?.submission,
    constraint: getZodConstraint(inviteChauffeurFormSchema),
    shouldValidate: "onSubmit",
    shouldRevalidate: "onInput",
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: inviteChauffeurFormSchema });
    },
  });

  return (
    <Form
      method="post"
      action="/fleet-owner/chauffeurs?invite=1"
      {...getFormProps(form)}
      className="space-y-5"
    >
      <input type="hidden" name="intent" value="invite" />
      <input
        type="hidden"
        name="idempotencyKey"
        value={inviteResult?.idempotencyKey ?? idempotencyKey}
      />
      <Field data-invalid={Boolean(fields.name.errors)}>
        <FieldLabel htmlFor={fields.name.id}>Full name</FieldLabel>
        <Input {...getInputProps(fields.name, { type: "text" })} autoComplete="name" />
        <FieldError
          id={fields.name.errorId}
          errors={fields.name.errors?.map((message) => ({ message }))}
        />
      </Field>
      <Field data-invalid={Boolean(fields.email.errors)}>
        <FieldLabel htmlFor={fields.email.id}>Email address</FieldLabel>
        <Input
          {...getInputProps(fields.email, { type: "email" })}
          autoComplete="email"
          spellCheck={false}
        />
        <FieldError
          id={fields.email.errorId}
          errors={fields.email.errors?.map((message) => ({ message }))}
        />
      </Field>
      <Field data-invalid={Boolean(fields.phoneNumber.errors)}>
        <FieldLabel htmlFor={fields.phoneNumber.id}>Phone number</FieldLabel>
        <Input
          {...getInputProps(fields.phoneNumber, { type: "tel" })}
          autoComplete="tel"
          inputMode="tel"
          placeholder="+234 801 234 5678…"
        />
        <FieldDescription>Use international format, including the country code.</FieldDescription>
        <FieldError
          id={fields.phoneNumber.errorId}
          errors={fields.phoneNumber.errors?.map((message) => ({ message }))}
        />
      </Field>
      <FormError id={form.errorId} errors={form.errors} />
      {inviteResult?.error ? <FormError id="invite-error" errors={[inviteResult.error]} /> : null}
      <Button type="submit" className="w-full" disabled={pending} aria-live="polite">
        {pending ? "Sending invitation…" : "Send invitation"}
      </Button>
    </Form>
  );
}

export function FleetChauffeursPage(props: FleetChauffeursPageProps) {
  const navigation = useNavigation();
  const location = useLocation();
  const navigate = useNavigate();
  const inviteOpen = new URLSearchParams(location.search).get("invite") === "1";
  const pending = navigation.state !== "idle";

  return (
    <section aria-labelledby="chauffeurs-heading" aria-busy={pending} className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="chauffeurs-heading" className="text-2xl font-semibold tracking-tight">
            Chauffeurs
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Invite drivers and manage who can receive your bookings.
          </p>
        </div>
        {!props.isOwnerDriver ? (
          <Sheet
            open={inviteOpen}
            onOpenChange={(open) => {
              if (!open) void navigate("/fleet-owner/chauffeurs", { replace: true });
            }}
          >
            <SheetTrigger asChild>
              <Button asChild className="w-full sm:w-auto">
                <Link to="?invite=1" preventScrollReset>
                  <PlusCircleIcon data-icon="inline-start" />
                  Invite chauffeur
                </Link>
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full overflow-y-auto overscroll-contain sm:max-w-md">
              <SheetHeader className="pr-12">
                <SheetTitle>Invite a chauffeur</SheetTitle>
                <SheetDescription>
                  They will receive a secure link to verify their phone, NIN, licence, and photo.
                </SheetDescription>
              </SheetHeader>
              <div className="px-4 pb-4">
                <InviteChauffeurForm
                  actionData={props.actionData}
                  idempotencyKey={props.idempotencyKey}
                />
              </div>
            </SheetContent>
          </Sheet>
        ) : null}
      </div>

      {props.isOwnerDriver ? (
        <Alert>
          <UserRoundIcon aria-hidden="true" />
          <AlertTitle>Your account is set up as owner-driver</AlertTitle>
          <AlertDescription>
            Chauffeur invitations are unavailable because you are the driver for this fleet.
          </AlertDescription>
        </Alert>
      ) : null}

      {props.chauffeurs.length ? (
        <ChauffeurList chauffeurs={props.chauffeurs} />
      ) : (
        <Empty className="min-h-72 border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UsersIcon />
            </EmptyMedia>
            <EmptyTitle>No chauffeurs yet</EmptyTitle>
            <EmptyDescription>
              {props.isOwnerDriver
                ? "You are currently the driver for this fleet."
                : "Invite your first chauffeur to begin their verification."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {props.complianceRequirements.some(({ required }) => !required) ? (
        <Alert>
          <CheckCircle2Icon aria-hidden="true" />
          <AlertTitle>Additional Lagos documents are optional for now</AlertTitle>
          <AlertDescription>
            {props.complianceRequirements
              .filter(({ required }) => !required)
              .map(({ label }) => label)
              .join(", ")}
            . We will notify you if these become required.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Page {props.page} of {Math.max(1, props.totalPages)} · {props.total} chauffeurs
        </p>
        <div className="flex gap-2">
          {props.page > 1 ? (
            <Button asChild variant="outline" size="sm">
              <Link to={chauffeurPagePath(props.page - 1)}>Previous</Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              Previous
            </Button>
          )}
          {props.page < props.totalPages ? (
            <Button asChild variant="outline" size="sm">
              <Link to={chauffeurPagePath(props.page + 1)}>Next</Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              Next
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
