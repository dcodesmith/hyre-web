import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod";
import { ActionFunctionArgs, LoaderFunctionArgs, json } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import { format } from "date-fns";
import { z } from "zod";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import logger from "~/lib/logger.server";
import { requireUserWithRole } from "~/modules/auth/auth.server";
import { prisma } from "~/modules/db/db.server";

const PlatformFeeType = {
  PLATFORM_SERVICE_FEE: "PLATFORM_SERVICE_FEE",
  FLEET_OWNER_COMMISSION: "FLEET_OWNER_COMMISSION",
} as const;

const ERROR_RING_CLASSES = "border-red-500 focus-visible:ring-red-500 focus-visible:ring-2";

type ActionData = {
  vatError?: string | Record<string, string[] | null> | null;
  vatSuccess?: boolean;
  platformFeeError?: string | Record<string, string[] | null> | null;
  platformFeeSuccess?: boolean;
  error?: string;
};

// Validation schemas
const vatRateSchema = z
  .object({
    ratePercent: z
      .string({ required_error: "Rate percentage is required" })
      .min(1, "Rate percentage is required")
      .transform((val) => Number.parseFloat(val))
      .refine((val) => val >= 0 && val <= 100, "Rate must be between 0 and 100%"),
    effectiveSince: z
      .string({ required_error: "Effective date is required" })
      .min(1, "Effective date is required")
      .transform((val) => new Date(val))
      .refine((date) => !Number.isNaN(date.getTime()), "Invalid effective date"),
    effectiveUntil: z
      .string()
      .optional()
      .transform((val) => (val ? new Date(val) : null))
      .refine((date) => !date || !Number.isNaN(date.getTime()), "Invalid end date"),
    description: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.effectiveUntil && data.effectiveSince) {
        return data.effectiveUntil > data.effectiveSince;
      }
      return true;
    },
    {
      message: "End date must be after start date",
      path: ["effectiveUntil"],
    },
  );

const platformFeeSchema = z
  .object({
    feeType: z.nativeEnum(PlatformFeeType, {
      required_error: "Fee type is required",
      invalid_type_error: "Invalid fee type selected",
    }),
    ratePercent: z
      .string({ required_error: "Rate percentage is required" })
      .min(1, "Rate percentage is required")
      .transform((val) => Number.parseFloat(val))
      .refine((val) => val >= 0 && val <= 100, "Rate must be between 0 and 100%"),
    effectiveSince: z
      .string({ required_error: "Effective date is required" })
      .min(1, "Effective date is required")
      .transform((val) => new Date(val))
      .refine((date) => !Number.isNaN(date.getTime()), "Invalid effective date"),
    effectiveUntil: z
      .string()
      .optional()
      .transform((val) => (val ? new Date(val) : null))
      .refine((date) => !date || !Number.isNaN(date.getTime()), "Invalid end date"),
    description: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.effectiveUntil && data.effectiveSince) {
        return data.effectiveUntil > data.effectiveSince;
      }
      return true;
    },
    {
      message: "End date must be after start date",
      path: ["effectiveUntil"],
    },
  );

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserWithRole(request, "admin");

  const currentVatRate = await prisma.taxRate.findFirst({
    where: {
      effectiveSince: { lte: new Date() },
      OR: [{ effectiveUntil: { gt: new Date() } }, { effectiveUntil: null }],
    },
    orderBy: { effectiveSince: "desc" },
  });

  const currentPlatformServiceFee = await prisma.platformFeeRate.findFirst({
    where: {
      feeType: "PLATFORM_SERVICE_FEE",
      effectiveSince: { lte: new Date() },
      OR: [{ effectiveUntil: { gt: new Date() } }, { effectiveUntil: null }],
    },
    orderBy: { effectiveSince: "desc" },
  });

  const currentFleetOwnerCommission = await prisma.platformFeeRate.findFirst({
    where: {
      feeType: "FLEET_OWNER_COMMISSION",
      effectiveSince: { lte: new Date() },
      OR: [{ effectiveUntil: { gt: new Date() } }, { effectiveUntil: null }],
    },
    orderBy: { effectiveSince: "desc" },
  });

  logger.info(`currentVatRate: ${JSON.stringify(currentVatRate ?? {})}`);
  logger.info(`currentPlatformServiceFee: ${JSON.stringify(currentPlatformServiceFee ?? {})}`);
  logger.info(`currentFleetOwnerCommission: ${JSON.stringify(currentFleetOwnerCommission ?? {})}`);

  return json({
    currentVatRate,
    currentPlatformServiceFee,
    currentFleetOwnerCommission,
  });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireUserWithRole(request, "admin");

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "vat") {
    const submission = parseWithZod(formData, { schema: vatRateSchema });

    if (submission.status !== "success") {
      return json<ActionData>({ vatError: submission.error });
    }

    const { effectiveSince, effectiveUntil } = submission.value;

    // Check for overlapping rates
    const overlappingRate = await prisma.taxRate.findFirst({
      where: {
        AND: [
          {
            OR: [
              // New rate starts during existing rate period
              {
                effectiveSince: { lte: effectiveSince },
                OR: [{ effectiveUntil: { gte: effectiveSince } }, { effectiveUntil: null }],
              },
              // New rate ends during existing rate period (if it has an end date)
              ...(effectiveUntil
                ? [
                    {
                      effectiveSince: { lte: effectiveUntil },
                      OR: [{ effectiveUntil: { gte: effectiveUntil } }, { effectiveUntil: null }],
                    },
                  ]
                : []),
              // Existing rate is completely within new rate period
              {
                effectiveSince: { gte: effectiveSince },
                ...(effectiveUntil
                  ? {
                      effectiveSince: { lte: effectiveUntil },
                    }
                  : {}),
              },
            ],
          },
        ],
      },
    });

    if (overlappingRate) {
      return json<ActionData>({
        vatError: "A rate already exists for the specified time period",
      });
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

      return json<ActionData>({ vatSuccess: true });
    } catch (error) {
      return json<ActionData>({ vatError: "Failed to create VAT rate" });
    }
  }

  if (intent === "platform-fee") {
    const submission = parseWithZod(formData, { schema: platformFeeSchema });

    if (submission.status !== "success") {
      return json<ActionData>({ platformFeeError: submission.error });
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

      return json<ActionData>({ platformFeeSuccess: true });
    } catch (error) {
      return json<ActionData>({ platformFeeError: "Failed to create platform fee rate" });
    }
  }

  return json<ActionData>({ error: "Invalid intent" });
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
              Current VAT Rate: {formatRate(currentVatRate.ratePercent)}% (Effective since{" "}
              {format(new Date(currentVatRate.effectiveSince), "MMM d, yyyy")})
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
              Current Platform Service Fee: {formatRate(currentPlatformServiceFee.ratePercent)}%
              (Effective since{" "}
              {format(new Date(currentPlatformServiceFee.effectiveSince), "MMM d, yyyy")})
            </div>
          )}

          {currentFleetOwnerCommission && (
            <div className="mb-4 font-semibold">
              Current Fleet Owner Commission: {formatRate(currentFleetOwnerCommission.ratePercent)}%
              (Effective since{" "}
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
