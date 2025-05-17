import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod";
import { CogIcon } from "@heroicons/react/24/outline";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { useIsPending } from "~/lib/utils";
import { requireUserWithRole } from "~/utils/permissions.server";
import { prisma } from "~/modules/db/db.server";
import { AutocompleteAddress } from "~/components/AutocompleteAddress";
import { useState } from "react";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { uploadFileToS3 } from "~/services/s3.server";
import { DocumentStatus, DocumentType } from "@prisma/client";

const baseSchema = z.object({
  name: z.string({ required_error: "Name is required" }),
  phoneNumber: z
    .string({ required_error: "Phone number is required" })
    .regex(/^(?:070|080|081|090|091|0809|0909)\d{8}$/, "Invalid Nigerian phone number"),
  address: z.string({ required_error: "Address is required" }),
});

const independentDriverSchema = baseSchema.extend({
  independentDriver: z.literal("true"),
  lasdriCard: z
    .instanceof(File, { message: "LASDRI card is required" })
    .refine((file) => file.size <= 5 * 1024 * 1024, "File must be less than 5MB"),
  driversLicense: z
    .instanceof(File, { message: "Driver's license is required" })
    .refine((file) => file.size <= 5 * 1024 * 1024, "File must be less than 5MB"),
});

const fleetOwnerSchema = baseSchema.extend({
  independentDriver: z.literal("false"),
  certificateOfIncorporation: z
    .instanceof(File, { message: "Certificate of Incorporation is required" })
    .refine((file) => file.size <= 5 * 1024 * 1024, "File must be less than 5MB"),
});

const onboardingSchema = z.discriminatedUnion("independentDriver", [
  fleetOwnerSchema,
  independentDriverSchema,
]);

// This prevents the parent loader from running for this route
export function shouldRevalidate() {
  return false;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUserWithRole(request, "fleetOwner");

  if (user.hasOnboarded) {
    return redirect("/fleet-owner");
  }

  return json({ user });
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUserWithRole(request, "fleetOwner");

  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: onboardingSchema });

  if (submission.status !== "success") {
    return json(submission.reply());
  }

  // Create the user profile and document approval record in a transaction
  await prisma.$transaction(async (tx) => {
    // Get the file from the submission
    const certificateFile = !submission.value.independentDriver
      ? (submission.value as z.infer<typeof fleetOwnerSchema>).certificateOfIncorporation
      : null;

    // Update user profile
    await tx.user.update({
      where: { id: user.id },
      data: {
        name: submission.value.name,
        phoneNumber: submission.value.phoneNumber,
        address: submission.value.address,
        hasOnboarded: true,
      },
    });

    // Create document approval record for Certificate of Incorporation
    if (certificateFile) {
      const timestamp = Date.now();
      const safeFilename = `${timestamp}-${certificateFile.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const key = `${user.id}/cac-${safeFilename}`;

      const documentUrl = await uploadFileToS3(certificateFile, key);

      await tx.documentApproval.create({
        data: {
          documentType: DocumentType.CERTIFICATE_OF_INCORPORATION,
          documentUrl,
          status: DocumentStatus.PENDING,
          userId: user.id,
        },
      });
    }
  });

  return redirect("/fleet-owner");
}

const roleOptions = {
  fleetOwner: { label: "Fleet Owner", description: "You have a fleet of vehicles" },
  independentDriver: { label: "Independent Driver", description: "You drive for yourself" },
};

export default function FleetOwnerOnboarding() {
  const isPending = useIsPending();
  const lastResult = useActionData<typeof action>();
  const { user } = useLoaderData<typeof loader>();
  const [isIndependentDriver, setIsIndependentDriver] = useState(false);

  const [
    form,
    {
      independentDriver,
      name,
      phoneNumber,
      address,
      lasdriCard,
      driversLicense,
      certificateOfIncorporation,
    },
  ] = useForm<z.infer<typeof onboardingSchema>>({
    lastResult,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: onboardingSchema });
    },
    defaultValue: {
      name: user.name,
      phoneNumber: user.phoneNumber,
      address: user.address || "",
    },
    shouldValidate: "onInput",
    shouldRevalidate: "onInput",
  });

  return (
    <div className="max-w-md mx-auto mt-8 p-6 bg-white border border-gray-200 rounded shadow-xl inset-shadow-sm">
      <h1 className="text-2xl font-bold mb-6">Complete Your Profile</h1>
      <p className="text-gray-600 mb-6">
        Please provide the following information to complete your registration.
      </p>

      <Form
        method="post"
        {...getFormProps(form)}
        className="space-y-4"
        encType="multipart/form-data"
      >
        <div className="space-y-1">
          <RadioGroup
            onValueChange={(value) => {
              const isDriver = value === "independentDriver";
              setIsIndependentDriver(isDriver);
              form.reset();
              form.update({
                [independentDriver.name]: isDriver ? "true" : "false",
              });
            }}
            defaultValue="fleetOwner"
            className="grid grid-cols-2"
          >
            {Object.entries(roleOptions).map(([value, { label, description }]) => (
              <div key={value}>
                <RadioGroupItem
                  value={value}
                  id={value}
                  className="peer sr-only"
                  aria-label={label}
                />
                <Label
                  htmlFor={value}
                  className={`flex flex-col items-center justify-between rounded-md border p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary ${
                    independentDriver.errors ? "border-red-500 focus-visible:ring-red-500" : ""
                  }`}
                >
                  <span className="text-sm font-medium">{label}</span>
                  <span className="text-xs text-muted-foreground">{description}</span>
                </Label>
              </div>
            ))}
          </RadioGroup>
          {independentDriver.errors && (
            <p className="text-red-500 text-sm">{independentDriver.errors}</p>
          )}
        </div>

        <input
          type="hidden"
          name={independentDriver.name}
          value={isIndependentDriver ? "true" : "false"}
        />

        <div className="space-y-1">
          <Label htmlFor={name.id}>{isIndependentDriver ? "Name" : "Business Name"}</Label>
          <Input
            {...getInputProps(name, { type: "text" })}
            key={undefined}
            placeholder={isIndependentDriver ? "Your name" : "Your business name"}
            className={name.errors ? "border-red-500 focus-visible:ring-red-500" : ""}
          />
          {name.errors && <p className="text-red-500 text-sm">{name.errors}</p>}
        </div>

        <div className="space-y-1">
          <Label htmlFor={phoneNumber.id}>Phone Number</Label>
          <Input
            {...getInputProps(phoneNumber, { type: "tel" })}
            key={undefined}
            placeholder="Your phone number"
            className={phoneNumber.errors ? "border-red-500 focus-visible:ring-red-500" : ""}
          />
          {phoneNumber.errors && <p className="text-red-500 text-sm">{phoneNumber.errors}</p>}
        </div>

        <div className="space-y-1">
          <Label htmlFor={address.id}>{isIndependentDriver ? "Address" : "Business Address"}</Label>
          <AutocompleteAddress
            id="address"
            inputProps={{
              name: address.name,
              id: address.id,
              placeholder: isIndependentDriver
                ? "Enter your address"
                : "Enter your business address",
            }}
            onSelect={(place) => {
              // Handle place selection if needed
            }}
            className={address.errors ? "border-red-500 focus-visible:ring-red-500" : ""}
          />
          {address.errors && <p className="text-red-500 text-sm">{address.errors}</p>}
        </div>

        {isIndependentDriver ? (
          <>
            <div className="space-y-1">
              <Label htmlFor={lasdriCard.id}>LASDRI Card</Label>
              <Input
                {...getInputProps(lasdriCard, { type: "file" })}
                key={undefined}
                accept="image/*"
                className={lasdriCard.errors ? "border-red-500" : ""}
              />
              {lasdriCard.errors && <p className="text-red-500 text-sm">{lasdriCard.errors}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor={driversLicense.id}>Driver's License</Label>
              <Input
                {...getInputProps(driversLicense, { type: "file" })}
                key={undefined}
                accept="image/*"
                className={driversLicense.errors ? "border-red-500" : ""}
              />
              {driversLicense.errors && (
                <p className="text-red-500 text-sm">{driversLicense.errors}</p>
              )}
            </div>
          </>
        ) : (
          <div className="space-y-1">
            <Label htmlFor={certificateOfIncorporation.id}>Certificate of Incorporation</Label>
            <Input
              accept="application/pdf"
              {...getInputProps(certificateOfIncorporation, { type: "file" })}
              key={undefined}
              className={certificateOfIncorporation.errors ? "border-red-500" : ""}
            />
            {certificateOfIncorporation.errors && (
              <p className="text-red-500 text-sm">{certificateOfIncorporation.errors}</p>
            )}
          </div>
        )}

        <Button className="w-full" type="submit" disabled={isPending}>
          {isPending ? <CogIcon className="h-5 w-5 animate-spin" /> : "Complete Onboarding"}
        </Button>
      </Form>
    </div>
  );
}
