import {
  type FieldMetadata,
  getFormProps,
  getInputProps,
  useForm,
  useInputControl,
} from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod";
import { CogIcon } from "@heroicons/react/24/outline";
import { DocumentStatus, DocumentType } from "@prisma/client";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { data } from "@remix-run/node";
import {
  redirect,
  unstable_createMemoryUploadHandler,
  unstable_parseMultipartFormData,
} from "@remix-run/node";
import { useActionData, useLoaderData } from "@remix-run/react";
import axios from "axios";
import { useState } from "react";
import { z } from "zod";
import { AutocompleteAddress } from "~/components/AutocompleteAddress";
import { Button } from "~/components/ui/button";
import { Combobox } from "~/components/ui/combobox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { banks } from "~/lib/banks";
import logger from "~/lib/logger.server";
import { useIsPending } from "~/lib/utils";
import { prisma } from "~/modules/db/db.server";
import { uploadFileToS3 } from "~/services/s3.server";
import { requireUserWithRole } from "~/utils/server/permissions.server";
import { env } from "~/utils/server/env.server";
import { validateCSRF } from "~/utils/csrf-action.server";
import { Form } from "~/components/CSRFForm";

const baseSchema = z.object({
  name: z.string({ required_error: "Name is required" }),
  phoneNumber: z
    .string({ required_error: "Phone number is required" })
    .regex(
      /^\+234[789][01]\d{8}$/,
      "Phone number must be a valid Nigerian number (e.g., +2349012341234)",
    ),
  address: z.string({ required_error: "Address is required" }),
  bankCode: z
    .string({ required_error: "Bank is required" })
    .refine((code) => banks.some((b) => b.code === code), {
      message: "Select a valid bank.",
    }),
  accountNumber: z
    .string({ required_error: "Account number is required" })
    .regex(/^\d{10}$/, "Account number must be exactly 10 digits"),
  accountName: z.string({ required_error: "Account name is required" }),
});

const independentDriverSchema = baseSchema.extend({
  independentDriver: z.literal("true"),
  // Validate based on the presence and size of the file, not instanceof File directly
  ninFile: z
    .any()
    .refine((file) => file && file.size > 0, "NIN is required")
    .refine((file) => file.size <= 5 * 1024 * 1024, "File must be less than 5MB")
    .refine(
      (file) =>
        !file || ["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type),
      "File must be a JPEG, PNG, WebP or PDF",
    ),
  driversLicense: z
    .any()
    .refine((file) => file && file.size > 0, "Driver's license is required")
    .refine((file) => file.size <= 5 * 1024 * 1024, "File must be less than 5MB")
    .refine(
      (file) =>
        !file || ["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type),
      "File must be a JPEG, PNG, WebP or PDF",
    ),
  lasdriCard: z
    .any()
    .optional()
    .refine(
      (file) => !file || file.size === 0 || file.size <= 5 * 1024 * 1024,
      "File must be less than 5MB",
    )
    .refine(
      (file) =>
        !file ||
        file.size === 0 ||
        ["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type),
      "File must be a JPEG, PNG, WebP or PDF",
    ),
});

const fleetOwnerSchema = baseSchema.extend({
  independentDriver: z.literal("false"),
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

  return { user };
}

export async function action({ request }: ActionFunctionArgs) {
  await validateCSRF(request);
  const user = await requireUserWithRole(request, "fleetOwner");

  const uploadHandler = unstable_createMemoryUploadHandler({
    maxPartSize: 10 * 1024 * 1024,
  });

  const formData = await unstable_parseMultipartFormData(request, uploadHandler);
  const submission = parseWithZod(formData, { schema: onboardingSchema });

  if (submission.status !== "success") {
    return data(submission.reply(), { status: 400 });
  }

  const { value } = submission;

  // Verify bank details for both fleet owners and owner-drivers
  const { accountNumber, bankCode, accountName } = value;

  const masked = accountNumber.replace(/\d(?=\d{4})/g, "•");
  logger.info(`Verifying bank account: ${masked} for bank: ${bankCode}`);

  try {
    const response = await axios.post(
      "https://api.flutterwave.com/v3/accounts/resolve",
      {
        account_number: accountNumber,
        account_bank: bankCode,
      },
      {
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.FLUTTERWAVE_SECRET_KEY}`,
        },
        timeout: 15000,
      },
    );

    const result = response.data;

    if (result.status !== "success") {
      return data(submission.reply({ formErrors: ["Could not verify bank account."] }), {
        status: 400,
      });
    }

    const verifiedAccountName = result.data.account_name;

    if (verifiedAccountName.trim().toLowerCase() !== accountName.trim().toLowerCase()) {
      return data(
        submission.reply({
          fieldErrors: {
            accountName: ["Account name does not match the provided account number."],
          },
        }),
        { status: 400 },
      );
    }
  } catch (error) {
    logger.error(
      `Flutterwave API Error: ${error instanceof Error ? error.message : String(error)}`,
    );

    let errorMessage = "An error occurred during verification. Please try again later.";
    if (axios.isAxiosError(error) && error.response) {
      const { status, statusText, data } = error.response;
      logger.error("Flutterwave error", {
        status,
        statusText,
        message: data?.message,
        code: data?.code,
      });
      errorMessage = `Verification failed: ${data?.message || "Unknown API error"}`;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    return data(
      submission.reply({
        formErrors: [errorMessage],
      }),
    );
  }

  // Upload documents to S3 BEFORE the transaction (if owner-driver)
  let uploadedDocuments: { ninUrl?: string; licenseUrl?: string; lasdriUrl?: string } = {};

  if (value.independentDriver === "true") {
    const { ninFile, driversLicense, lasdriCard } = value as z.infer<
      typeof independentDriverSchema
    >;
    const timestamp = Date.now();

    try {
      const uploadPromises: Promise<string>[] = [];

      // Upload NIN
      const ninFilename = `${timestamp}-${ninFile.name.replaceAll(/[^a-zA-Z0-9.-]/g, "_")}`;
      const ninKey = `${user.id}/nin-${ninFilename}`;
      uploadPromises.push(uploadFileToS3(ninFile, ninKey));

      // Upload Driver's License
      const licenseFilename = `${timestamp}-${driversLicense.name.replaceAll(/[^a-zA-Z0-9.-]/g, "_")}`;
      const licenseKey = `${user.id}/license-${licenseFilename}`;
      uploadPromises.push(uploadFileToS3(driversLicense, licenseKey));

      // Upload LASDRI Card if provided (optional)
      if (lasdriCard && lasdriCard.size > 0) {
        const lasdriFilename = `${timestamp}-${lasdriCard.name.replaceAll(/[^a-zA-Z0-9.-]/g, "_")}`;
        const lasdriKey = `${user.id}/lasdri-${lasdriFilename}`;
        uploadPromises.push(uploadFileToS3(lasdriCard, lasdriKey));
      }
      const [ninUrl, licenseUrl, lasdriUrl] = await Promise.all(uploadPromises);
      uploadedDocuments = { ninUrl, licenseUrl, lasdriUrl: lasdriUrl || undefined };
    } catch (error) {
      logger.error("Failed to upload documents to S3", {
        error: error instanceof Error ? error.message : String(error),
        userId: user.id,
      });

      return data(
        submission.reply({
          formErrors: [
            "Failed to upload your documents. Please check your internet connection and try again.",
          ],
        }),
        { status: 500 },
      );
    }
  }

  // Create the user profile and bank details in a transaction
  try {
    await prisma.$transaction(async (tx) => {
      const { bankCode, accountNumber, accountName } = value;
      const bank = banks.find((bank) => bank.code === bankCode);

      if (!bank) {
        throw new Error("Invalid bank code. Please select a valid bank.");
      }

      // Create Bank Details for both fleet owners and owner-drivers
      await tx.bankDetails.create({
        data: {
          userId: user.id,
          bankName: bank.name,
          bankCode,
          accountNumber,
          accountName,
          isVerified: true,
        },
      });

      // Update user profile
      await tx.user.update({
        where: { id: user.id },
        data: {
          name: value.name,
          phoneNumber: value.phoneNumber,
          address: value.address,
          hasOnboarded: true,
          isOwnerDriver: value.independentDriver === "true",
          // If owner-driver, set chauffeur approval status to PENDING
          ...(value.independentDriver === "true" && {
            chauffeurApprovalStatus: "PENDING",
          }),
        },
      });

      // If owner-driver, create document approval records
      if (value.independentDriver === "true") {
        // Create NIN document record
        if (uploadedDocuments.ninUrl) {
          await tx.documentApproval.create({
            data: {
              documentType: DocumentType.NIN,
              documentUrl: uploadedDocuments.ninUrl,
              status: DocumentStatus.PENDING,
              userId: user.id,
            },
          });
        }

        // Create Driver's License document record
        if (uploadedDocuments.licenseUrl) {
          await tx.documentApproval.create({
            data: {
              documentType: DocumentType.DRIVERS_LICENSE,
              documentUrl: uploadedDocuments.licenseUrl,
              status: DocumentStatus.PENDING,
              userId: user.id,
            },
          });
        }

        // Create LASDRI Card document record (if uploaded)
        if (uploadedDocuments.lasdriUrl) {
          await tx.documentApproval.create({
            data: {
              documentType: DocumentType.LASDRI,
              documentUrl: uploadedDocuments.lasdriUrl,
              status: DocumentStatus.PENDING,
              userId: user.id,
            },
          });
        }
      }
    });
  } catch (error) {
    logger.error("Failed to create user profile and bank details", {
      error: error instanceof Error ? error.message : String(error),
      userId: user.id,
    });

    return data(
      submission.reply({
        formErrors: [
          "Failed to complete onboarding. Please try again or contact support if the issue persists.",
        ],
      }),
      { status: 500 },
    );
  }

  return redirect("/fleet-owner");
}

const roleOptions = {
  fleetOwner: {
    label: "Fleet Owner",
    description: "You have a fleet of vehicles",
  },
  independentDriver: {
    label: "Owner-Driver",
    description: "You drive for yourself",
  },
};

function RoleSelectionField({
  independentDriver,
  onValueChange,
}: {
  readonly independentDriver: FieldMetadata<string>;
  readonly onValueChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-base font-semibold">Account Type</Label>
      <RadioGroup
        onValueChange={onValueChange}
        defaultValue="fleetOwner"
        className="grid grid-cols-2 gap-4"
      >
        {Object.entries(roleOptions).map(([value, { label, description }]) => (
          <div key={value}>
            <RadioGroupItem value={value} id={value} className="peer sr-only" aria-label={label} />
            <Label
              htmlFor={value}
              className={`flex flex-col items-center justify-between rounded-md border-2 p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer ${
                independentDriver.errors ? "border-red-500 focus-visible:ring-red-500" : ""
              }`}
            >
              <span className="text-sm font-semibold mb-1">{label}</span>
              <span className="text-xs text-muted-foreground text-center">{description}</span>
            </Label>
          </div>
        ))}
      </RadioGroup>
      {independentDriver.errors && (
        <p className="text-red-500 text-sm">{independentDriver.errors}</p>
      )}
    </div>
  );
}

function OwnerDriverDocuments({
  ninFile,
  driversLicense,
  lasdriCard,
  getInputProps,
}: {
  readonly ninFile: FieldMetadata<any>;
  readonly driversLicense: FieldMetadata<any>;
  readonly lasdriCard: FieldMetadata<any>;
  readonly getInputProps: any;
}) {
  return (
    <>
      <div className="space-y-1">
        <Label htmlFor={ninFile.id}>NIN (National Identification Number)</Label>
        <Input
          {...getInputProps(ninFile, { type: "file" })}
          key={ninFile.key}
          accept="image/*,application/pdf"
          className={ninFile.errors ? "border-red-500" : ""}
        />
        {ninFile.errors?.map((error) => (
          <p key={error} className="text-red-500 text-sm">
            {error}
          </p>
        ))}
      </div>
      <div className="space-y-1">
        <Label htmlFor={driversLicense.id}>Driver's License</Label>
        <Input
          {...getInputProps(driversLicense, { type: "file" })}
          key={driversLicense.key}
          accept="image/*,application/pdf"
          className={driversLicense.errors ? "border-red-500" : ""}
        />
        {driversLicense.errors?.map((error) => (
          <p key={error} className="text-red-500 text-sm">
            {error}
          </p>
        ))}
      </div>
      <div className="space-y-1">
        <Label htmlFor={lasdriCard.id}>LASDRI Card (Optional)</Label>
        <Input
          {...getInputProps(lasdriCard, { type: "file" })}
          key={lasdriCard.key}
          accept="image/*,application/pdf"
          className={lasdriCard.errors ? "border-red-500" : ""}
        />
        {lasdriCard.errors?.map((error) => (
          <p key={error} className="text-red-500 text-sm">
            {error}
          </p>
        ))}
        <p className="text-xs text-muted-foreground">
          Lagos State Drivers' Refresher Institute Card
        </p>
      </div>
    </>
  );
}

function BankDetailsFields({
  bankCode,
  accountNumber,
  accountName,
}: {
  readonly bankCode: FieldMetadata<string>;
  readonly accountNumber: FieldMetadata<string>;
  readonly accountName: FieldMetadata<string>;
}) {
  const control = useInputControl(bankCode);

  return (
    <>
      <div className="space-y-1">
        <Label htmlFor={bankCode.id}>Bank</Label>
        <Combobox
          options={banks.map((b) => ({ value: b.code, label: b.name }))}
          value={control.value}
          onChange={(value) => control.change(value)}
          placeholder="Select a bank"
          searchPlaceholder="Search for a bank..."
          noResultsMessage="No banks found."
          triggerClassName="w-full"
        />
        {bankCode.errors?.map((error) => (
          <p key={error} className="text-red-600 text-sm">
            {error}
          </p>
        ))}
      </div>
      <div className="space-y-1">
        <Label htmlFor={accountNumber.id}>Account Number</Label>
        <Input
          {...getInputProps(accountNumber, { type: "text" })}
          inputMode="numeric"
          pattern="^[0-9]{10}$"
          minLength={10}
          maxLength={10}
          key={accountNumber.key}
          placeholder="Your 10-digit account number"
          className={accountNumber.errors ? "border-red-500" : ""}
        />
        {accountNumber.errors?.map((error) => (
          <p key={error} className="text-red-500 text-sm">
            {error}
          </p>
        ))}
      </div>
      <div className="space-y-1">
        <Label htmlFor={accountName.id}>Account Name</Label>
        <Input
          {...getInputProps(accountName, { type: "text" })}
          key={accountName.key}
          placeholder="The name on your bank account"
          className={accountName.errors ? "border-red-500" : ""}
        />
        {accountName.errors?.map((error) => (
          <p key={error} className="text-red-500 text-sm">
            {error}
          </p>
        ))}
      </div>
    </>
  );
}

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
      ninFile,
      driversLicense,
      lasdriCard,
      bankCode,
      accountNumber,
      accountName,
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

  // Handle role change - reset form when switching between roles
  const handleRoleChange = (value: string) => {
    setIsIndependentDriver(value === "independentDriver");
    form.reset();
  };

  return (
    <div className="mx-auto mt-8 max-w-md rounded border border-gray-200 bg-white p-6 shadow-xl inset-shadow-sm">
      <h1 className="mb-6 text-2xl font-bold">Complete Your Profile</h1>
      <p className="mb-6 text-gray-600">
        Please provide the following information to complete your registration.
      </p>

      <Form
        method="post"
        {...getFormProps(form)}
        className="space-y-4"
        encType="multipart/form-data"
      >
        <RoleSelectionField
          independentDriver={independentDriver}
          onValueChange={handleRoleChange}
        />

        <input
          type="hidden"
          name={independentDriver.name}
          value={isIndependentDriver ? "true" : "false"}
        />

        <div className="space-y-1">
          <Label htmlFor={name.id}>{isIndependentDriver ? "Name" : "Business Name"}</Label>
          <Input
            {...getInputProps(name, { type: "text" })}
            placeholder={isIndependentDriver ? "Your name" : "Your business name"}
            className={name.errors ? "border-red-500 focus-visible:ring-red-500" : ""}
          />
          {name.errors && <p className="text-red-500 text-sm">{name.errors}</p>}
        </div>

        <div className="space-y-1">
          <Label htmlFor={phoneNumber.id}>Phone Number</Label>
          <Input
            {...getInputProps(phoneNumber, { type: "tel" })}
            placeholder="+2349012341234"
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

        {isIndependentDriver && (
          <OwnerDriverDocuments
            ninFile={ninFile}
            driversLicense={driversLicense}
            lasdriCard={lasdriCard}
            getInputProps={getInputProps}
          />
        )}

        <BankDetailsFields
          bankCode={bankCode}
          accountNumber={accountNumber}
          accountName={accountName}
        />

        <Button className="w-full" type="submit" disabled={isPending}>
          {isPending ? <CogIcon className="h-5 w-5 animate-spin" /> : "Complete Onboarding"}
        </Button>
      </Form>
    </div>
  );
}
