import { parseWithZod } from "@conform-to/zod";
import { ActionFunctionArgs, type LoaderFunctionArgs, redirect, data } from "@remix-run/node";
import { useActionData, useLoaderData } from "@remix-run/react";
import { AddonType } from "~/types";
import { z } from "zod";
import { Form } from "~/components/CSRFForm";
import { validateCSRF } from "~/utils/csrf-action.server";
import { requireAdminOrStaffWithRedirect } from "~/modules/auth/auth.server";
import { prisma } from "~/modules/db/db.server";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { formatCurrency } from "~/lib/utils";
import logger from "~/lib/logger.server";

const createAddonRateSchema = z.object({
  addonType: z.nativeEnum(AddonType),
  rateAmount: z.coerce.number().positive("Rate amount must be a positive number"),
  description: z.string().optional(),
  effectiveSince: z.coerce.date(),
});

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdminOrStaffWithRedirect(request);

  const addonRates = await prisma.addonRate.findMany({
    orderBy: [{ addonType: "asc" }, { effectiveSince: "desc" }],
  });

  return { addonRates };
}

export async function action({ request }: ActionFunctionArgs) {
  await validateCSRF(request);
  await requireAdminOrStaffWithRedirect(request);

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    const submission = parseWithZod(formData, { schema: createAddonRateSchema });

    if (submission.status !== "success") {
      return data({ success: false, message: "Validation failed" }, { status: 400 });
    }

    const { addonType, rateAmount, description, effectiveSince } = submission.value;

    try {
      // End previous rates for this addon type
      await prisma.addonRate.updateMany({
        where: {
          addonType,
          effectiveUntil: null, // Only update rates that are currently active
        },
        data: {
          effectiveUntil: effectiveSince,
        },
      });

      // Create new rate
      await prisma.addonRate.create({
        data: {
          addonType,
          rateAmount,
          description,
          effectiveSince,
        },
      });

      return redirect("/admin/addon-rates");
    } catch (error) {
      logger.error("Error creating addon rate:", error);
      return data({ success: false, message: "Failed to create addon rate" }, { status: 400 });
    }
  }

  if (intent === "end") {
    const id = formData.get("id") as string;

    try {
      await prisma.addonRate.update({
        where: { id },
        data: { effectiveUntil: new Date() },
      });

      return redirect("/admin/addon-rates");
    } catch (error) {
      logger.error("Error ending addon rate:", error);
      return data({ success: false, message: "Failed to end addon rate" }, { status: 400 });
    }
  }

  return data({ success: false, message: "Invalid action" }, { status: 400 });
}

export default function AdminAddonRates() {
  const { addonRates } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const { success, message } = actionData ?? {};

  const groupedRates = addonRates.reduce(
    (acc, rate) => {
      if (!acc[rate.addonType]) {
        acc[rate.addonType] = [];
      }
      acc[rate.addonType].push(rate);
      return acc;
    },
    {} as Record<AddonType, typeof addonRates>,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Addon Rates Management</h1>
      </div>

      {actionData && (
        <div
          className={`p-4 rounded ${success ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
        >
          {message}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Create New Rate Form */}
        <Card>
          <CardHeader>
            <CardTitle>Create New Addon Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <Form method="post" className="space-y-4">
              <input type="hidden" name="intent" value="create" />

              <div className="space-y-2">
                <Label htmlFor="addonType">Addon Type</Label>
                <Select name="addonType" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select addon type" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(AddonType).map((type) => (
                      <SelectItem key={type} value={type}>
                        {type.replace("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rateAmount">Rate Amount (₦)</Label>
                <Input
                  id="rateAmount"
                  name="rateAmount"
                  type="number"
                  step="0.01"
                  required
                  placeholder="30000.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="effectiveSince">Effective From</Label>
                <Input
                  id="effectiveSince"
                  name="effectiveSince"
                  type="datetime-local"
                  required
                  defaultValue={new Date().toISOString().slice(0, 16)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Security detail service per day"
                />
              </div>

              <Button type="submit" className="w-fit">
                Create Addon Rate
              </Button>
            </Form>
          </CardContent>
        </Card>

        {/* Current Rates Display */}
        <div className="space-y-4">
          {Object.entries(groupedRates).map(([addonType, rates]) => (
            <Card key={addonType}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {addonType.replace("_", " ")}
                  <span className="text-sm font-normal text-gray-500">
                    {rates.length} rate{rates.length !== 1 ? "s" : ""}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {rates.map((rate) => {
                    const now = new Date();
                    const isCurrentlyActive =
                      new Date(rate.effectiveSince) <= now &&
                      (!rate.effectiveUntil || new Date(rate.effectiveUntil) > now);

                    return (
                      <div
                        key={rate.id}
                        className={`p-3 border rounded-lg ${
                          isCurrentlyActive
                            ? "bg-green-50 border-green-200"
                            : "bg-gray-50 border-gray-200"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold">
                              {formatCurrency(Number(rate.rateAmount as unknown as string))}
                            </div>
                            <div className="text-sm text-gray-600">
                              Effective: {new Date(rate.effectiveSince).toLocaleDateString()}
                              {rate.effectiveUntil && (
                                <> - {new Date(rate.effectiveUntil).toLocaleDateString()}</>
                              )}
                            </div>
                            {rate.description && (
                              <div className="text-sm text-gray-500">{rate.description}</div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-1 rounded text-xs ${
                                isCurrentlyActive
                                  ? "bg-green-100 text-green-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {isCurrentlyActive ? "Active" : "Inactive"}
                            </span>
                            {isCurrentlyActive && (
                              <Form method="post" style={{ display: "inline" }}>
                                <input type="hidden" name="intent" value="end" />
                                <input type="hidden" name="id" value={rate.id} />
                                <Button type="submit" variant="outline" size="sm">
                                  End Now
                                </Button>
                              </Form>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
