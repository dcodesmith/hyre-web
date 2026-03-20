import {
  type FieldMetadata,
  type SubmissionResult,
  getFormProps,
  getInputProps,
  useForm,
  useInputControl,
} from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { CogIcon } from "@heroicons/react/24/outline";
import { parseFormData } from "@remix-run/form-data-parser";
import { DocumentStatus, DocumentType } from "@prisma/client";
import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  data,
  redirect,
  useActionData,
  useFetcher,
  useLoaderData,
} from "react-router";
import axios from "axios";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { AutocompleteAddress } from "~/components/AutocompleteAddress";
import { Form } from "~/components/CSRFForm";
import {
  ACCOUNT_TYPE_OPTIONS,
  ACCOUNT_TYPE_OPTIONS_MAP,
  FLEET_OWNER_TYPE,
  OWNER_DRIVER_TYPE,
} from "~/components/accountTypes";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Combobox } from "~/components/ui/combobox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { banks } from "~/lib/banks";
import logger from "~/lib/logger.server";
import { useIsPending } from "~/lib/utils";
import { prisma } from "~/modules/db/db.server";
import { onboardingSchema, ownerDriverSchema } from "~/schemas/onboarding.schema";
import { uploadFileToS3 } from "~/services/s3.server";
import { validateCSRF } from "~/utils/csrf-action.server";
import { env } from "~/utils/server/env.server";
import { requireUserWithRole } from "~/utils/server/permissions.server";
import { useAuthenticityToken } from "remix-utils/csrf/react";

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

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Onboarding action handles resolve intent and final submission in one route.
export async function action({ request }: ActionFunctionArgs) {
  await validateCSRF(request);
  const user = await requireUserWithRole(request, "fleetOwner");
  const isLocalDev = env.NODE_ENV === "development" || env.NODE_ENV === "test";
  const forcedDevBankCode = "044";

  const formDataForIntent = await request.clone().formData();
  const intent = formDataForIntent.get("intent");

  if (intent === "resolve-account") {
    const bankCode = isLocalDev
      ? forcedDevBankCode
      : formDataForIntent.get("bankCode")?.toString().trim() || "";
    const accountNumber = formDataForIntent.get("accountNumber")?.toString().trim() || "";

    if (!bankCode || !banks.some((bank) => bank.code === bankCode)) {
      return data({ error: "Please select a valid bank." }, { status: 400 });
    }

    if (!/^\d{10}$/.test(accountNumber)) {
      return data({ error: "Enter a valid 10-digit account number." }, { status: 400 });
    }

    const masked = accountNumber.replaceAll(/\d(?=\d{4})/g, "•");
    logger.info(`Resolving bank account name: ${masked} for bank: ${bankCode}`);

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
      if (result.status !== "success" || !result.data?.account_name) {
        return data({ error: "Could not verify bank account." }, { status: 400 });
      }

      return data({ resolvedAccountName: result.data.account_name });
    } catch (error) {
      logger.error(
        `Flutterwave resolve error: ${error instanceof Error ? error.message : String(error)}`,
      );
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        return data(
          { error: `Verification failed: ${error.response.data.message}` },
          { status: 400 },
        );
      }

      return data(
        { error: "An error occurred during verification. Please try again later." },
        { status: 500 },
      );
    }
  }

  let formData: FormData;
  try {
    formData = await parseFormData(
      request,
      { maxFiles: 5 },
      (file) => file,
    );
  } catch (error) {
    logger.error({ error }, "Failed to parse onboarding multipart form data");
    const message = "Unable to process uploaded documents. Please try again.";
    return data({ error: message }, { status: 400 });
  }
  const submission = parseWithZod(formData, { schema: onboardingSchema });

  if (submission.status !== "success") {
    return data(submission.reply(), { status: 400 });
  }

  const { value } = submission;

  // Verify bank details for both fleet owners and owner-drivers
  const accountNumber = value.accountNumber;
  const bankCode = isLocalDev ? forcedDevBankCode : value.bankCode;
  const accountOwnershipConfirmed = value.accountOwnershipConfirmed;

  const masked = accountNumber.replaceAll(/\d(?=\d{4})/g, "•");
  logger.info(`Verifying bank account: ${masked} for bank: ${bankCode}`);

  let resolvedAccountName = "";

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
    resolvedAccountName = verifiedAccountName;
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

  if (value.ownerDriver === "true") {
    const { ninFile, driversLicense, lasdriCard } = value as z.infer<typeof ownerDriverSchema>;
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
      const accountNumber = value.accountNumber;
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
          accountName: resolvedAccountName,
          isVerified: true,
          lastVerifiedAt: new Date(),
          verificationResponse: {
            provider: "flutterwave",
            resolvedAccountName,
            ownershipConfirmed: accountOwnershipConfirmed === "on",
            ownershipConfirmedAt: new Date().toISOString(),
          },
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
          isOwnerDriver: value.ownerDriver === "true",
          // If owner-driver, set chauffeur approval status to PENDING
          ...(value.ownerDriver === "true" && {
            chauffeurApprovalStatus: "PENDING",
          }),
        },
      });

      // If owner-driver, create document approval records
      if (value.ownerDriver === "true") {
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

function RoleSelectionField({
  currentValue,
  onValueChange,
}: {
  readonly currentValue: string;
  readonly onValueChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-base font-semibold">Select your account type</Label>
      <Tabs value={currentValue} onValueChange={onValueChange} className="w-full">
        <TabsList className="py-4 gap-2 tabs-list-slider w-full h-auto before:w-[calc((100%-0.5rem)/2)]">
          {ACCOUNT_TYPE_OPTIONS.map((type) => {
            const option = ACCOUNT_TYPE_OPTIONS_MAP[type];
            return (
              <TabsTrigger
                key={option.value}
                value={option.value}
                className="flex flex-col data-[state=active]:shadow-none tabs-trigger-slider data-[state=active]:bg-transparent"
              >
                <span className="text-sm font-bold">{option.label}</span>
                <span className="text-xs text-muted-foreground">{option.description}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>
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
  accountOwnershipConfirmed,
  resolvedAccountName,
  resolveError,
  isResolving,
  forceDevBankCode,
}: {
  readonly bankCode: FieldMetadata<string>;
  readonly accountNumber: FieldMetadata<string>;
  readonly accountOwnershipConfirmed: FieldMetadata<string>;
  readonly resolvedAccountName: string;
  readonly resolveError: string | null;
  readonly isResolving: boolean;
  readonly forceDevBankCode: boolean;
}) {
  const control = useInputControl(bankCode);
  const devBankOption = banks.find((bank) => bank.code === "044");

  useEffect(() => {
    if (forceDevBankCode && control.value !== "044") {
      control.change("044");
    }
  }, [forceDevBankCode, control]);

  return (
    <>
      <div className="space-y-1">
        <Label htmlFor={bankCode.id}>Bank</Label>
        <Combobox
          options={
            forceDevBankCode && devBankOption
              ? [{ value: devBankOption.code, label: devBankOption.name }]
              : banks.map((b) => ({ value: b.code, label: b.name }))
          }
          value={forceDevBankCode ? "044" : control.value}
          onChange={(value) => control.change(forceDevBankCode ? "044" : value)}
          placeholder="Select a bank"
          searchPlaceholder="Search for a bank..."
          noResultsMessage="No banks found."
          triggerClassName="w-full"
        />
        {forceDevBankCode && (
          <p className="text-xs text-muted-foreground">
            Local/dev mode: bank is fixed to {devBankOption?.name ?? "bank code 044"}.
          </p>
        )}
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
      <div className="space-y-2">
        {isResolving && <p className="text-sm text-muted-foreground">Verifying account...</p>}
        {!isResolving && resolveError && <p className="text-red-500 text-sm">{resolveError}</p>}
        {!isResolving && resolvedAccountName && (
          <>
            <div className="inline-flex h-10 items-center rounded w-full bg-green-50 px-3 py-1 text-sm font-semibold text-green-800">
              {resolvedAccountName}
            </div>
            <div className="space-y-2 rounded-md border border-neutral-200 p-3">
              <div className="flex items-start gap-3">
                <Checkbox
                  id={accountOwnershipConfirmed.id}
                  name={accountOwnershipConfirmed.name}
                  defaultChecked={accountOwnershipConfirmed.initialValue === "on"}
                  className="mt-1"
                />
                <Label
                  htmlFor={accountOwnershipConfirmed.id}
                  className="block cursor-pointer text-sm leading-4"
                >
                  I confirm this bank account belongs to me and I am authorized to receive payouts
                  into it.
                </Label>
              </div>
              {accountOwnershipConfirmed.errors?.map((error) => (
                <p key={error} className="text-red-500 text-sm">
                  {error}
                </p>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}

export default function FleetOwnerOnboarding() {
  const isLocalDev = import.meta.env.DEV;
  const isPending = useIsPending();
  const actionData = useActionData<typeof action>();
  const lastResult =
    actionData && typeof actionData === "object" && "status" in actionData
      ? (actionData as SubmissionResult<string[]>)
      : undefined;
  const { user } = useLoaderData<typeof loader>();
  const [isOwnerDriver, setIsOwnerDriver] = useState(false);
  const csrfToken = useAuthenticityToken();
  const resolveFetcher = useFetcher<{ resolvedAccountName?: string; error?: string }>();
  const [resolvedAccountName, setResolvedAccountName] = useState("");
  const [resolveError, setResolveError] = useState<string | null>(null);
  const lastLookupKeyRef = useRef<string | null>(null);

  const [
    form,
    {
      ownerDriver,
      name,
      phoneNumber,
      address,
      ninFile,
      driversLicense,
      lasdriCard,
      bankCode,
      accountNumber,
      accountOwnershipConfirmed,
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
      bankCode: isLocalDev ? "044" : undefined,
    },
    shouldValidate: "onInput",
    shouldRevalidate: "onInput",
  });

  // Handle role change - reset form when switching between roles
  const handleRoleChange = (value: string) => {
    setIsOwnerDriver(value === OWNER_DRIVER_TYPE);
    form.reset();
  };

  const bankCodeValue = bankCode.value ?? "";
  const accountNumberValue = accountNumber.value ?? "";

  useEffect(() => {
    if (resolveFetcher.data?.resolvedAccountName) {
      setResolvedAccountName(resolveFetcher.data.resolvedAccountName);
      setResolveError(null);
      return;
    }

    if (resolveFetcher.data?.error) {
      setResolvedAccountName("");
      setResolveError(resolveFetcher.data.error);
    }
  }, [resolveFetcher.data]);

  useEffect(() => {
    if (!bankCodeValue || !/^\d{10}$/.test(accountNumberValue)) {
      setResolvedAccountName("");
      setResolveError(null);
      lastLookupKeyRef.current = null;
      return;
    }

    const lookupKey = `${bankCodeValue}:${accountNumberValue}`;
    if (lookupKey === lastLookupKeyRef.current) {
      return;
    }

    const timer = setTimeout(() => {
      setResolveError(null);
      setResolvedAccountName("");
      lastLookupKeyRef.current = lookupKey;
      resolveFetcher.submit(
        {
          intent: "resolve-account",
          bankCode: bankCodeValue,
          accountNumber: accountNumberValue,
          csrf: csrfToken,
        },
        { method: "post", action: "." },
      );
    }, 500);

    return () => clearTimeout(timer);
  }, [bankCodeValue, accountNumberValue, resolveFetcher, csrfToken]);

  return (
    <div className="mx-auto mt-4 max-w-md rounded border border-gray-200 p-6 shadow-xl inset-shadow-sm">
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
          currentValue={isOwnerDriver ? OWNER_DRIVER_TYPE : FLEET_OWNER_TYPE}
          onValueChange={handleRoleChange}
        />

        <input type="hidden" name={ownerDriver.name} value={isOwnerDriver ? "true" : "false"} />

        <div className="space-y-1">
          <Label htmlFor={name.id}>{isOwnerDriver ? "Name" : "Business Name"}</Label>
          <Input
            {...getInputProps(name, { type: "text" })}
            placeholder={isOwnerDriver ? "Your name" : "Your business name"}
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
          <Label htmlFor={address.id}>{isOwnerDriver ? "Address" : "Business Address"}</Label>
          <AutocompleteAddress
            id="address"
            inputProps={{
              name: address.name,
              id: address.id,
              placeholder: isOwnerDriver ? "Enter your address" : "Enter your business address",
            }}
            onSelect={(place) => {
              // Handle place selection if needed
            }}
            className={address.errors ? "border-red-500 focus-visible:ring-red-500" : ""}
          />
          {address.errors && <p className="text-red-500 text-sm">{address.errors}</p>}
        </div>

        {isOwnerDriver && (
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
          accountOwnershipConfirmed={accountOwnershipConfirmed}
          resolvedAccountName={resolvedAccountName}
          resolveError={resolveError}
          isResolving={resolveFetcher.state !== "idle"}
          forceDevBankCode={isLocalDev}
        />

        <Button
          className="w-full"
          type="submit"
          disabled={isPending || !resolvedAccountName || resolveFetcher.state !== "idle"}
        >
          {isPending ? <CogIcon className="h-5 w-5 animate-spin" /> : "Complete Onboarding"}
        </Button>
      </Form>
    </div>
  );
}
