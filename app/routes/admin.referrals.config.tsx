import { type LoaderFunctionArgs, type ActionFunctionArgs, data, redirect } from "@remix-run/node";
import { useLoaderData, useActionData, Link, useSearchParams } from "@remix-run/react";
import { requireAdminWithRedirect } from "~/modules/auth/auth.server";
import { prisma } from "~/modules/db/db.server";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Checkbox } from "~/components/ui/checkbox";
import { Form } from "~/components/CSRFForm";
import { validateCSRF } from "~/utils/csrf-action.server";
import { getReferralConfig } from "~/services/referral.server";
import {
  ArrowLeftIcon,
  CogIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";
import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod";
import { z } from "zod";
import { ReferralReleaseCondition } from "@prisma/client";
import { CheckedState } from "@radix-ui/react-checkbox";
import logger from "~/lib/logger.server";

const ConfigSchema = z.object({
  REFERRAL_ENABLED: z.coerce.boolean().default(false),
  REFERRAL_DISCOUNT_AMOUNT: z.coerce.number().min(0).default(0),
  REFERRAL_MIN_BOOKING_AMOUNT: z.coerce.number().min(0).default(0),
  REFERRAL_ELIGIBLE_TYPES: z.array(z.enum(["DAY", "NIGHT", "FULL_DAY"])).default([]),
  REFERRAL_RELEASE_CONDITION: z.enum(["PAID", "COMPLETED"]).default("COMPLETED"),
  REFERRAL_EXPIRY_DAYS: z.coerce.number().min(0).default(0),
});

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdminWithRedirect(request);

  const config = await getReferralConfig();

  return { config };
}

export async function action({ request }: ActionFunctionArgs) {
  await validateCSRF(request);
  const user = await requireAdminWithRedirect(request);

  const formData = await request.formData();

  // Parse form data
  const submission = parseWithZod(formData, { schema: ConfigSchema });

  if (submission.status !== "success") {
    return data(
      { success: false, error: "Invalid form data", submission: submission.reply() },
      { status: 400 },
    );
  }

  const configData = submission.value;

  try {
    // Update all configuration values
    await prisma.$transaction(async (tx) => [
      tx.referralProgramConfig.upsert({
        where: { key: "REFERRAL_ENABLED" },
        update: { value: configData.REFERRAL_ENABLED, updatedAt: new Date(), updatedBy: user.id },
        create: { key: "REFERRAL_ENABLED", value: configData.REFERRAL_ENABLED, updatedBy: user.id },
      }),
      tx.referralProgramConfig.upsert({
        where: { key: "REFERRAL_DISCOUNT_AMOUNT" },
        update: {
          value: configData.REFERRAL_DISCOUNT_AMOUNT,
          updatedAt: new Date(),
          updatedBy: user.id,
        },
        create: {
          key: "REFERRAL_DISCOUNT_AMOUNT",
          value: configData.REFERRAL_DISCOUNT_AMOUNT,
          updatedBy: user.id,
        },
      }),
      tx.referralProgramConfig.upsert({
        where: { key: "REFERRAL_MIN_BOOKING_AMOUNT" },
        update: {
          value: configData.REFERRAL_MIN_BOOKING_AMOUNT,
          updatedAt: new Date(),
          updatedBy: user.id,
        },
        create: {
          key: "REFERRAL_MIN_BOOKING_AMOUNT",
          value: configData.REFERRAL_MIN_BOOKING_AMOUNT,
          updatedBy: user.id,
        },
      }),
      tx.referralProgramConfig.upsert({
        where: { key: "REFERRAL_ELIGIBLE_TYPES" },
        update: {
          value: configData.REFERRAL_ELIGIBLE_TYPES,
          updatedAt: new Date(),
          updatedBy: user.id,
        },
        create: {
          key: "REFERRAL_ELIGIBLE_TYPES",
          value: configData.REFERRAL_ELIGIBLE_TYPES,
          updatedBy: user.id,
        },
      }),
      tx.referralProgramConfig.upsert({
        where: { key: "REFERRAL_RELEASE_CONDITION" },
        update: {
          value: configData.REFERRAL_RELEASE_CONDITION as ReferralReleaseCondition,
          updatedAt: new Date(),
          updatedBy: user.id,
        },
        create: {
          key: "REFERRAL_RELEASE_CONDITION",
          value: configData.REFERRAL_RELEASE_CONDITION,
          updatedBy: user.id,
        },
      }),
      tx.referralProgramConfig.upsert({
        where: { key: "REFERRAL_EXPIRY_DAYS" },
        update: {
          value: configData.REFERRAL_EXPIRY_DAYS,
          updatedAt: new Date(),
          updatedBy: user.id,
        },
        create: {
          key: "REFERRAL_EXPIRY_DAYS",
          value: configData.REFERRAL_EXPIRY_DAYS,
          updatedBy: user.id,
        },
      }),
    ]);

    return redirect("/admin/referrals/config?success=true");
  } catch (error) {
    logger.error("Failed to update referral configuration", { error });
    return data({ success: false, error: "Failed to update configuration" }, { status: 500 });
  }
}

export default function AdminReferralConfig() {
  const { config } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  const [form, fields] = useForm({
    constraint: getZodConstraint(ConfigSchema),
    defaultValue: {
      REFERRAL_ENABLED: config.REFERRAL_ENABLED as boolean,
      REFERRAL_DISCOUNT_AMOUNT: config.REFERRAL_DISCOUNT_AMOUNT,
      REFERRAL_MIN_BOOKING_AMOUNT: config.REFERRAL_MIN_BOOKING_AMOUNT,
      REFERRAL_ELIGIBLE_TYPES: config.REFERRAL_ELIGIBLE_TYPES as string[],
      REFERRAL_RELEASE_CONDITION: config.REFERRAL_RELEASE_CONDITION as ReferralReleaseCondition,
      REFERRAL_EXPIRY_DAYS: config.REFERRAL_EXPIRY_DAYS,
    },
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: ConfigSchema });
    },
  });

  // Check for success message in URL

  const [searchParams] = useSearchParams();
  const showSuccess = searchParams.get("success") === "true";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/referrals">
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Back to Overview
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Referral Program Configuration</h1>
            <p className="text-muted-foreground">Configure referral program settings and rules</p>
          </div>
        </div>
      </div>

      {/* Success Message */}
      {showSuccess && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircleIcon className="h-5 w-5" />
              <span className="font-medium">Configuration updated successfully!</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Message */}
      {actionData?.error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-red-700">
              <ExclamationTriangleIcon className="h-5 w-5" />
              <span className="font-medium">{actionData.error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CogIcon className="h-5 w-5" />
            Current Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Badge variant={config.REFERRAL_ENABLED ? "default" : "secondary"}>
              {config.REFERRAL_ENABLED ? "ACTIVE" : "DISABLED"}
            </Badge>
            <div className="text-sm text-muted-foreground">
              Last updated: {new Date().toLocaleDateString()}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configuration Form */}
      <Form method="post" {...getFormProps(form)} className="space-y-6">
        {/* Program Enable/Disable */}
        <Card>
          <CardHeader>
            <CardTitle>Program Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="referral-enabled"
                name={fields.REFERRAL_ENABLED.name}
                defaultChecked={Boolean(fields.REFERRAL_ENABLED.initialValue)}
              />
              <Label
                htmlFor="referral-enabled"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Enable referral program
              </Label>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              When disabled, no new referral attributions or discounts will be processed
            </p>
          </CardContent>
        </Card>

        {/* Discount Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Discount Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="discount-amount">Discount Amount (NGN)</Label>
                <Input
                  min="0"
                  step="100"
                  {...getInputProps(fields.REFERRAL_DISCOUNT_AMOUNT, { type: "number" })}
                />
                <p className="text-sm text-muted-foreground">
                  Fixed discount amount for referred users
                </p>
              </div>

              <div>
                <Label htmlFor="min-booking">Minimum Booking Amount (NGN)</Label>
                <Input
                  min="0"
                  step="1000"
                  {...getInputProps(fields.REFERRAL_MIN_BOOKING_AMOUNT, { type: "number" })}
                />
                <p className="text-sm text-muted-foreground">
                  Minimum booking amount to qualify for discount
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Eligibility Rules */}
        <Card>
          <CardHeader>
            <CardTitle>Eligibility Rules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Eligible Booking Types</Label>
              <div className="flex gap-4 mt-2">
                {["DAY", "NIGHT", "FULL_DAY"].map((type) => (
                  <div key={type} className="flex items-center space-x-2">
                    <input
                      {...getInputProps(fields.REFERRAL_ELIGIBLE_TYPES, {
                        type: "checkbox",
                        value: type,
                      })}
                      defaultChecked={config.REFERRAL_ELIGIBLE_TYPES.includes(type)}
                    />
                    <Label htmlFor={`type-${type}`} className="text-sm">
                      {type.replace("_", " ")}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="expiry-days">Discount Expiry (Days)</Label>
                <Input
                  min="0"
                  {...getInputProps(fields.REFERRAL_EXPIRY_DAYS, { type: "number" })}
                />
                <p className="text-sm text-muted-foreground">
                  Days after signup to use discount (0 = no expiry)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Reward Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Reward Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="release-condition">Reward Release Condition</Label>
              <select
                id="release-condition"
                name={fields.REFERRAL_RELEASE_CONDITION.name}
                defaultValue={fields.REFERRAL_RELEASE_CONDITION.initialValue}
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="PAID">When booking is paid</option>
                <option value="COMPLETED">When booking is completed</option>
              </select>
              <p className="text-sm text-muted-foreground">
                When to release the reward to the referrer
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Warning */}
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-4">
            <div className="flex items-start gap-2 text-yellow-800">
              <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Warning</p>
                <p className="text-sm mt-1">
                  Configuration changes take effect immediately and will affect all new referral
                  activities. Existing pending rewards will continue to use their original settings.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" asChild>
            <Link to="/admin/referrals">Cancel</Link>
          </Button>
          <Button type="submit">Update Configuration</Button>
        </div>
      </Form>
    </div>
  );
}
