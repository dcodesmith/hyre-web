import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  data,
  useActionData,
  useLoaderData,
} from "react-router";
import { format } from "date-fns";
import { z } from "zod";
import { Form } from "~/components/CSRFForm";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import logger from "~/lib/logger.server";
import { requireAdminOrStaffWithRedirect } from "~/modules/auth/auth.server";
import { prisma } from "~/modules/db/db.server";
import { validateCSRF } from "~/utils/csrf-action.server";
import { vatRateSchema, platformFeeSchema } from "~/schemas/admin.schema";

const PLATFORM_FEE_TYPES = ["PLATFORM_SERVICE_FEE", "FLEET_OWNER_COMMISSION"] as const;

const ERROR_RING_CLASSES = "border-red-500 focus-visible:ring-red-500 focus-visible:ring-2";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdminOrStaffWithRedirect(request);

  const [currentVatRate, currentPlatformServiceFee, currentFleetOwnerCommission] =
    await Promise.all([
      prisma.taxRate.findFirst({
        where: {
          effectiveSince: { lte: new Date() },
          OR: [{ effectiveUntil: { gt: new Date() } }, { effectiveUntil: null }],
        },
        orderBy: { effectiveSince: "desc" },
      }),
      prisma.platformFeeRate.findFirst({
        where: {
          feeType: "PLATFORM_SERVICE_FEE",
          effectiveSince: { lte: new Date() },
          OR: [{ effectiveUntil: { gt: new Date() } }, { effectiveUntil: null }],
        },
        orderBy: { effectiveSince: "desc" },
      }),
      prisma.platformFeeRate.findFirst({
        where: {
          feeType: "FLEET_OWNER_COMMISSION",
          effectiveSince: { lte: new Date() },
          OR: [{ effectiveUntil: { gt: new Date() } }, { effectiveUntil: null }],
        },
        orderBy: { effectiveSince: "desc" },
      }),
    ]);

  logger.info("Current rates:", {
    currentVatRate,
    currentPlatformServiceFee,
    currentFleetOwnerCommission,
  });

  return {
    currentVatRate,
    currentPlatformServiceFee,
    currentFleetOwnerCommission,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  await validateCSRF(request);
  await requireAdminOrStaffWithRedirect(request);

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "vat") {
    const submission = parseWithZod(formData, { schema: vatRateSchema });

    if (submission.status !== "success") {
      return data({ vatError: submission.reply() }, { status: 400 });
    }

    const { effectiveSince, effectiveUntil } = submission.value;

    // Check for overlapping rates
    const overlappingRate = await prisma.taxRate.findFirst({
      where: {
        // overlap exists if NOT (existing ends before new starts OR existing starts after new ends)
        NOT: {
          OR: [
            { effectiveUntil: { lt: effectiveSince } },
            ...(effectiveUntil ? [{ effectiveSince: { gt: effectiveUntil } }] : []),
          ],
        },
      },
    });

    if (overlappingRate) {
      return data(
        { vatError: "A rate already exists for the specified time period" },
        { status: 409 },
      );
    }

    try {
      await prisma.taxRate.create({
        data: {
          ratePercent: submission.value.ratePercent,
          effectiveSince: submission.value.effectiveSince,
          effectiveUntil: submission.value.effectiveUntil,
          description: submission.value.description,
        },
      });

      return data({ vatSuccess: true }, { status: 201 });
    } catch (error) {
      logger.error("Error creating VAT rate:", error);
      return data({ vatError: "Failed to create VAT rate" }, { status: 500 });
    }
  }

  if (intent === "platform-fee") {
    const submission = parseWithZod(formData, { schema: platformFeeSchema });

    if (submission.status !== "success") {
      return data({ platformFeeError: "Validation failed" }, { status: 400 });
    }

    // Prevent overlapping fee periods for the same type
    const { feeType, effectiveSince, effectiveUntil } = submission.value;

    const overlapping = await prisma.platformFeeRate.findFirst({
      where: {
        feeType,
        NOT: {
          OR: [
            { effectiveUntil: { lt: effectiveSince } },
            ...(effectiveUntil ? [{ effectiveSince: { gt: effectiveUntil } }] : []),
          ],
        },
      },
    });

    if (overlapping) {
      return data(
        { platformFeeError: "A rate already exists for the specified time period" },
        { status: 409 },
      );
    }

    try {
      await prisma.platformFeeRate.create({
        data: {
          feeType: submission.value.feeType,
          ratePercent: submission.value.ratePercent,
          effectiveSince: submission.value.effectiveSince,
          effectiveUntil: submission.value.effectiveUntil,
          description: submission.value.description,
        },
      });

      return data({ platformFeeSuccess: true }, { status: 201 });
    } catch (error) {
      logger.error("Error creating platform fee rate:", error);
      return data({ platformFeeError: "Failed to create platform fee rate" }, { status: 500 });
    }
  }

  return data({ error: "Invalid intent" }, { status: 400 });
}

export default function AdminFees() {
  const { currentVatRate, currentPlatformServiceFee, currentFleetOwnerCommission } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  const [
    vatForm,
    {
      ratePercent: vatRate,
      effectiveSince: vatEffectiveSince,
      effectiveUntil: vatEffectiveUntil,
      description: vatDescription,
    },
  ] = useForm({
    id: "vat-form",
    lastSubmission:
      actionData?.vatError && typeof actionData.vatError !== "string"
        ? actionData.vatError
        : undefined,
    defaultValue: {
      ratePercent: "",
      effectiveSince: "",
      effectiveUntil: "",
      description: "",
    },
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: vatRateSchema });
    },
  });

  const [
    platformFeeForm,
    {
      feeType,
      ratePercent: platformFeeRate,
      effectiveSince: platformFeeEffectiveSince,
      effectiveUntil: platformFeeEffectiveUntil,
      description: platformFeeDescription,
    },
  ] = useForm({
    id: "platform-fee-form",
    defaultValue: {
      feeType: "PLATFORM_SERVICE_FEE",
      ratePercent: "",
      effectiveSince: "",
      effectiveUntil: "",
      description: "",
    },
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: platformFeeSchema });
    },
  });

  const formatRate = (rate: number | string | null | undefined) => {
    if (rate == null) return "0.0";
    const numRate = typeof rate === "string" ? Number.parseFloat(rate) : rate;
    return numRate.toFixed(1);
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Fee Management</h1>

      <div className="grid gap-6 md:grid-cols-2">
        {/* VAT Rate Form */}

        <div>
          {currentVatRate && (
            <div className="mb-4 font-semibold">
              Current VAT Rate: {formatRate(Number(currentVatRate.ratePercent))}% (Effective since{" "}
              {format(new Date(currentVatRate?.effectiveSince), "MMM d, yyyy")})
            </div>
          )}
          <Card>
            <CardHeader>
              <CardTitle>VAT Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <Form method="post" className="space-y-4" {...getFormProps(vatForm)}>
                <div className="space-y-2">
                  <Label htmlFor={vatRate.id}>Rate Percentage</Label>
                  <Input
                    {...getInputProps(vatRate, { type: "number", ariaAttributes: true })}
                    step="0.01"
                    min="0"
                    max="100"
                    required
                    placeholder="e.g., 7.5"
                    className={vatRate.errors ? ERROR_RING_CLASSES : ""}
                  />
                  {vatRate.errors && <p className="text-sm text-red-500">{vatRate.errors[0]}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor={vatEffectiveSince.id}>Effective Since</Label>
                  <Input
                    {...getInputProps(vatEffectiveSince, {
                      type: "datetime-local",
                      ariaAttributes: true,
                    })}
                    required
                    className={vatEffectiveSince.errors ? ERROR_RING_CLASSES : ""}
                  />
                  {vatEffectiveSince.errors && (
                    <p className="text-sm text-red-500">{vatEffectiveSince.errors[0]}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor={vatEffectiveUntil.id}>Effective Until (Optional)</Label>
                  <Input
                    {...getInputProps(vatEffectiveUntil, {
                      type: "datetime-local",
                      ariaAttributes: true,
                    })}
                    className={vatEffectiveUntil.errors ? ERROR_RING_CLASSES : ""}
                  />
                  {vatEffectiveUntil.errors && (
                    <p className="text-sm text-red-500">{vatEffectiveUntil.errors[0]}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor={vatDescription.id}>Description (Optional)</Label>
                  <Input
                    {...getInputProps(vatDescription, { type: "text", ariaAttributes: true })}
                    className={vatDescription.errors ? ERROR_RING_CLASSES : ""}
                  />
                  {vatDescription.errors && (
                    <p className="text-sm text-red-500">{vatDescription.errors[0]}</p>
                  )}
                </div>

                <Button type="submit" name="intent" value="vat">
                  Save VAT Rate
                </Button>

                {actionData?.vatError && typeof actionData.vatError === "string" && (
                  <Alert variant="destructive">
                    <AlertDescription>{actionData.vatError}</AlertDescription>
                  </Alert>
                )}

                {actionData?.vatSuccess && (
                  <Alert>
                    <AlertDescription>VAT rate saved successfully!</AlertDescription>
                  </Alert>
                )}
              </Form>
            </CardContent>
          </Card>
        </div>

        {/* Platform Fee Form */}
        <div>
          {currentPlatformServiceFee && (
            <div className="mb-4 font-semibold">
              Current Platform Service Fee:{" "}
              {formatRate(Number(currentPlatformServiceFee.ratePercent))}% (Effective since{" "}
              {format(new Date(currentPlatformServiceFee.effectiveSince), "MMM d, yyyy")})
            </div>
          )}

          {currentFleetOwnerCommission && (
            <div className="mb-4 font-semibold">
              Current Fleet Owner Commission:{" "}
              {formatRate(Number(currentFleetOwnerCommission.ratePercent))}% (Effective since{" "}
              {format(new Date(currentFleetOwnerCommission.effectiveSince), "MMM d, yyyy")})
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Platform Fees</CardTitle>
            </CardHeader>
            <CardContent>
              <Form method="post" className="space-y-4" {...getFormProps(platformFeeForm)}>
                <div className="space-y-2">
                  <Label htmlFor={feeType.id}>Fee Type</Label>
                  <select
                    {...getInputProps(feeType, { type: "text", ariaAttributes: true })}
                    className={`w-full rounded-md border border-input bg-background px-3 py-2 ${
                      feeType.errors ? ERROR_RING_CLASSES : ""
                    }`}
                    required
                  >
                    <option value="PLATFORM_SERVICE_FEE">Platform Service Fee</option>
                    <option value="FLEET_OWNER_COMMISSION">Fleet Owner Commission</option>
                  </select>
                  {feeType.errors && <p className="text-sm text-red-500">{feeType.errors[0]}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor={platformFeeRate.id}>Rate Percentage</Label>
                  <Input
                    {...getInputProps(platformFeeRate, { type: "number", ariaAttributes: true })}
                    step="0.01"
                    min="0"
                    max="100"
                    required
                    placeholder="e.g., 15"
                    className={platformFeeRate.errors ? ERROR_RING_CLASSES : ""}
                  />
                  {platformFeeRate.errors && (
                    <p className="text-sm text-red-500">{platformFeeRate.errors[0]}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor={platformFeeEffectiveSince.id}>Effective Since</Label>
                  <Input
                    {...getInputProps(platformFeeEffectiveSince, {
                      type: "datetime-local",
                      ariaAttributes: true,
                    })}
                    required
                    className={platformFeeEffectiveSince.errors ? ERROR_RING_CLASSES : ""}
                  />
                  {platformFeeEffectiveSince.errors && (
                    <p className="text-sm text-red-500">{platformFeeEffectiveSince.errors[0]}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor={platformFeeEffectiveUntil.id}>Effective Until (Optional)</Label>
                  <Input
                    {...getInputProps(platformFeeEffectiveUntil, {
                      type: "datetime-local",
                      ariaAttributes: true,
                    })}
                    className={platformFeeEffectiveUntil.errors ? ERROR_RING_CLASSES : ""}
                  />
                  {platformFeeEffectiveUntil.errors && (
                    <p className="text-sm text-red-500">{platformFeeEffectiveUntil.errors[0]}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor={platformFeeDescription.id}>Description (Optional)</Label>
                  <Input
                    {...getInputProps(platformFeeDescription, {
                      type: "text",
                      ariaAttributes: true,
                    })}
                    className={platformFeeDescription.errors ? ERROR_RING_CLASSES : ""}
                  />
                  {platformFeeDescription.errors && (
                    <p className="text-sm text-red-500">{platformFeeDescription.errors[0]}</p>
                  )}
                </div>

                <Button type="submit" name="intent" value="platform-fee">
                  Save Platform Fee
                </Button>

                {actionData?.platformFeeError &&
                  typeof actionData.platformFeeError === "string" && (
                    <Alert variant="destructive">
                      <AlertDescription>{actionData.platformFeeError}</AlertDescription>
                    </Alert>
                  )}

                {actionData?.platformFeeSuccess && (
                  <Alert>
                    <AlertDescription>Platform fee saved successfully!</AlertDescription>
                  </Alert>
                )}
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
