import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { useFetcher } from "react-router";

import { AddonActionFeedback } from "~/admin/addons/addon-action-feedback";
import { AdminAddonPricing } from "~/admin/addons/admin-addon-pricing";
import type { AdminAddon } from "~/api/admin/addons/schema";
import { BOOKING_TYPE_LABELS, BOOKING_TYPE_OPTIONS } from "~/booking/types";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Field, FieldError, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import {
  type AddonActionData,
  createAddonFormSchema,
  updateAddonFormSchema,
} from "./addon-form-schema";

function BookingTypeCheckboxes({
  name,
  initialValues = [],
  errors,
}: {
  readonly name: string;
  readonly initialValues?: readonly string[];
  readonly errors?: string[];
}) {
  return (
    <Field data-invalid={Boolean(errors)}>
      <fieldset>
        <legend className="text-sm font-medium">Booking types</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {BOOKING_TYPE_OPTIONS.map((bookingType) => (
            <label key={bookingType} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name={name}
                value={bookingType}
                defaultChecked={initialValues.includes(bookingType)}
                className="size-4 accent-primary"
              />
              {BOOKING_TYPE_LABELS[bookingType].singular}
            </label>
          ))}
        </div>
      </fieldset>
      <FieldError errors={errors} />
    </Field>
  );
}

function CreateAddonForm() {
  const fetcher = useFetcher<AddonActionData>();
  const [form, fields] = useForm({
    id: "create-addon-form",
    lastResult: fetcher.data?.intent === "create-addon" ? fetcher.data.submission : undefined,
    constraint: getZodConstraint(createAddonFormSchema),
    shouldValidate: "onSubmit",
    shouldRevalidate: "onInput",
    defaultValue: { pricingUnit: "PER_BOOKING", financialTreatment: "PLATFORM" },
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: createAddonFormSchema });
    },
  });

  return (
    <fetcher.Form method="post" {...getFormProps(form)}>
      <input type="hidden" name="intent" value="create-addon" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field data-invalid={Boolean(fields.name.errors)}>
          <FieldLabel htmlFor={fields.name.id}>Name</FieldLabel>
          <Input
            {...getInputProps(fields.name, { type: "text" })}
            autoComplete="off"
            maxLength={100}
          />
          <FieldError errors={fields.name.errors} />
        </Field>
        <Field data-invalid={Boolean(fields.code.errors)}>
          <FieldLabel htmlFor={fields.code.id}>Code</FieldLabel>
          <Input
            {...getInputProps(fields.code, { type: "text" })}
            autoComplete="off"
            maxLength={64}
            placeholder="e.g. PROTOCOL_SERVICE…"
            spellCheck={false}
            className="uppercase"
          />
          <FieldError errors={fields.code.errors} />
        </Field>
      </div>
      <Field className="mt-4" data-invalid={Boolean(fields.description.errors)}>
        <FieldLabel htmlFor={fields.description.id}>Description (optional)</FieldLabel>
        <Input
          {...getInputProps(fields.description, { type: "text" })}
          autoComplete="off"
          maxLength={500}
        />
        <FieldError errors={fields.description.errors} />
      </Field>
      <div className="mt-4">
        <BookingTypeCheckboxes
          name={fields.bookingTypes.name}
          errors={fields.bookingTypes.errors}
        />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field data-invalid={Boolean(fields.pricingUnit.errors)}>
          <FieldLabel htmlFor={fields.pricingUnit.id}>Charge</FieldLabel>
          <select
            id={fields.pricingUnit.id}
            name={fields.pricingUnit.name}
            defaultValue={fields.pricingUnit.initialValue ?? "PER_BOOKING"}
            className="h-9 w-full rounded-md border bg-background px-3 text-sm text-foreground"
          >
            <option value="PER_BOOKING">Once per booking</option>
            <option value="PER_LEG">For every booking leg</option>
          </select>
          <FieldError errors={fields.pricingUnit.errors} />
        </Field>
        <Field data-invalid={Boolean(fields.financialTreatment.errors)}>
          <FieldLabel htmlFor={fields.financialTreatment.id}>Fulfilled by</FieldLabel>
          <select
            id={fields.financialTreatment.id}
            name={fields.financialTreatment.name}
            defaultValue={fields.financialTreatment.initialValue ?? "PLATFORM"}
            className="h-9 w-full rounded-md border bg-background px-3 text-sm text-foreground"
          >
            <option value="PLATFORM">Tripdly</option>
            <option value="FLEET_OWNER">Fleet owner</option>
          </select>
          <FieldError errors={fields.financialTreatment.errors} />
        </Field>
      </div>
      <div className="mt-4 space-y-3">
        <AddonActionFeedback
          data={fetcher.data}
          title={fetcher.data?.error ? "Add-on not created" : "Add-on created"}
        />
        <Button type="submit" disabled={fetcher.state !== "idle"}>
          {fetcher.state === "idle" ? "Create add-on" : "Creating…"}
        </Button>
      </div>
    </fetcher.Form>
  );
}

function UpdateAddonForm({ addon }: { readonly addon: AdminAddon }) {
  const fetcher = useFetcher<AddonActionData>();
  const [form, fields] = useForm({
    id: `update-addon-${addon.id}`,
    lastResult: fetcher.data?.intent === "update-addon" ? fetcher.data.submission : undefined,
    constraint: getZodConstraint(updateAddonFormSchema),
    defaultValue: {
      addonId: addon.id,
      name: addon.name,
      description: addon.description ?? "",
      bookingTypes: addon.bookingTypes,
      isActive: String(addon.isActive),
    },
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: updateAddonFormSchema });
    },
  });

  return (
    <fetcher.Form method="post" {...getFormProps(form)} className="space-y-4">
      <input type="hidden" name="intent" value="update-addon" />
      <input type="hidden" name="addonId" value={addon.id} />
      <Field data-invalid={Boolean(fields.name.errors)}>
        <FieldLabel htmlFor={fields.name.id}>Name</FieldLabel>
        <Input
          {...getInputProps(fields.name, { type: "text" })}
          autoComplete="off"
          maxLength={100}
        />
        <FieldError errors={fields.name.errors} />
      </Field>
      <Field data-invalid={Boolean(fields.description.errors)}>
        <FieldLabel htmlFor={fields.description.id}>Description (optional)</FieldLabel>
        <Input
          {...getInputProps(fields.description, { type: "text" })}
          autoComplete="off"
          maxLength={500}
        />
        <FieldError errors={fields.description.errors} />
      </Field>
      <BookingTypeCheckboxes
        name={fields.bookingTypes.name}
        initialValues={addon.bookingTypes}
        errors={fields.bookingTypes.errors}
      />
      <Field data-invalid={Boolean(fields.isActive.errors)}>
        <FieldLabel htmlFor={fields.isActive.id}>Status</FieldLabel>
        <select
          id={fields.isActive.id}
          name={fields.isActive.name}
          defaultValue={String(addon.isActive)}
          className="h-9 w-full rounded-md border bg-background px-3 text-sm text-foreground"
        >
          <option value="true">Enabled</option>
          <option value="false">Disabled</option>
        </select>
        <FieldError errors={fields.isActive.errors} />
      </Field>
      <AddonActionFeedback
        data={fetcher.data}
        title={fetcher.data?.error ? "Add-on not updated" : "Add-on updated"}
      />
      <Button type="submit" disabled={fetcher.state !== "idle"}>
        {fetcher.state === "idle" ? "Save changes" : "Saving…"}
      </Button>
    </fetcher.Form>
  );
}

function AddonCard({ addon, now }: { readonly addon: AdminAddon; readonly now: string }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="break-words">{addon.name}</CardTitle>
            <CardDescription className="break-all" translate="no">
              {addon.code}
            </CardDescription>
          </div>
          <Badge variant={addon.isActive ? "default" : "secondary"}>
            {addon.isActive ? "Enabled" : "Disabled"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {addon.description ? (
          <p className="text-sm text-muted-foreground">{addon.description}</p>
        ) : null}
        <div className="flex flex-wrap gap-2 text-xs">
          {addon.bookingTypes.map((type) => (
            <Badge key={type} variant="outline">
              {BOOKING_TYPE_LABELS[type].singular}
            </Badge>
          ))}
          <Badge variant="outline">
            {addon.pricingUnit === "PER_BOOKING" ? "Per booking" : "Per leg"}
          </Badge>
          <Badge variant="outline">
            {addon.financialTreatment === "PLATFORM" ? "Tripdly fulfilled" : "Fleet fulfilled"}
          </Badge>
        </div>
        <details className="rounded-lg border p-3">
          <summary className="cursor-pointer text-sm font-medium">Edit add-on</summary>
          <div className="mt-4 border-t pt-4">
            <UpdateAddonForm addon={addon} />
          </div>
        </details>
        <AdminAddonPricing addon={addon} now={now} />
      </CardContent>
    </Card>
  );
}

export function AdminAddonsPage({
  addons,
  now,
}: {
  readonly addons: AdminAddon[];
  readonly now: string;
}) {
  return (
    <section
      aria-labelledby="addons-heading"
      className="mx-auto flex w-full max-w-6xl flex-col gap-6"
    >
      <div>
        <h2 id="addons-heading" className="text-2xl font-semibold tracking-tight">
          Add-ons
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage optional services available during booking.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Create add-on</CardTitle>
          <CardDescription>Create the service first, then add its price window.</CardDescription>
        </CardHeader>
        <CardContent>
          <CreateAddonForm />
        </CardContent>
      </Card>
      {addons.length > 0 ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {addons.map((addon) => (
            <AddonCard key={addon.id} addon={addon} now={now} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No add-ons created yet.</p>
      )}
    </section>
  );
}
