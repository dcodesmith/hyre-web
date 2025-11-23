import { type LoaderFunctionArgs, type ActionFunctionArgs, data, redirect } from "@remix-run/node";
import { useActionData, Link, useSearchParams } from "@remix-run/react";
import { requireAdminWithRedirect } from "~/modules/auth/auth.server";
import { prisma } from "~/modules/db/db.server";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Form } from "~/components/CSRFForm";
import { validateCSRF } from "~/utils/csrf-action.server";
import { attributeReferral } from "~/services/referral.server";
import {
  ArrowLeftIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  UserPlusIcon,
} from "@heroicons/react/24/outline";
import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod";
import { z } from "zod";
import logger from "~/lib/logger.server";

const ManualAttributionSchema = z.object({
  refereeEmail: z.string().email("Invalid email address"),
  referrerEmail: z.string().email("Invalid email address"),
  reason: z.string().min(1, "Reason is required"),
});

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdminWithRedirect(request);
  return null;
}

export async function action({ request }: ActionFunctionArgs) {
  await validateCSRF(request);
  await requireAdminWithRedirect(request);

  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: ManualAttributionSchema });

  if (submission.status !== "success") {
    return data(
      { success: false, error: "Invalid form data", submission: submission.reply() },
      { status: 400 },
    );
  }

  const { refereeEmail, referrerEmail, reason } = submission.value;

  try {
    // Find both users
    const [refereeUser, referrerUser] = await Promise.all([
      prisma.user.findUnique({
        where: { email: refereeEmail },
        select: { id: true, name: true, email: true, referredByUserId: true },
      }),
      prisma.user.findUnique({
        where: { email: referrerEmail },
        select: { id: true, name: true, email: true, referralCode: true },
      }),
    ]);

    if (!refereeUser) {
      return data({ success: false, error: "Referee user not found" }, { status: 404 });
    }

    if (!referrerUser) {
      return data({ success: false, error: "Referrer user not found" }, { status: 404 });
    }

    if (!referrerUser.referralCode) {
      return data(
        { success: false, error: "Referrer does not have a referral code" },
        { status: 400 },
      );
    }

    if (refereeUser.referredByUserId) {
      return data(
        { success: false, error: "Referee is already attributed to another referrer" },
        { status: 400 },
      );
    }

    if (refereeUser.id === referrerUser.id) {
      return data({ success: false, error: "Self-referrals are not allowed" }, { status: 400 });
    }

    // Create manual attribution
    await attributeReferral({
      refereeUserId: refereeUser.id,
      referralCode: referrerUser.referralCode,
      source: "MANUAL",
      ipAddress: "admin-manual",
      userAgent: "admin-interface",
      sessionId: `manual-${Date.now()}`,
    });

    // Log the manual attribution
    logger.info("Manual referral attribution created", {
      refereeId: refereeUser.id,
      referrerId: referrerUser.id,
      reason,
      adminAction: true,
    });

    return redirect("/admin/referrals/manual-attribution?success=true");
  } catch (error) {
    return data(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create manual attribution",
      },
      { status: 500 },
    );
  }
}

export default function ManualAttribution() {
  const actionData = useActionData<typeof action>();

  const [form, fields] = useForm({
    constraint: getZodConstraint(ManualAttributionSchema),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: ManualAttributionSchema });
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
            <h1 className="text-2xl font-bold">Manual Referral Attribution</h1>
            <p className="text-muted-foreground">
              Manually attribute a referral relationship between users
            </p>
          </div>
        </div>
      </div>

      {/* Success Message */}
      {showSuccess && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircleIcon className="h-5 w-5" />
              <span className="font-medium">Manual attribution created successfully!</span>
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

      {/* Manual Attribution Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlusIcon className="h-5 w-5" />
            Create Manual Attribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form method="post" {...getFormProps(form)} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="referee-email">Referee Email</Label>
                <Input
                  id="referee-email"
                  type="email"
                  placeholder="user@example.com"
                  {...getInputProps(fields.refereeEmail, { type: "email" })}
                />
                {fields.refereeEmail.errors && (
                  <p className="text-sm text-destructive mt-1">{fields.refereeEmail.errors}</p>
                )}
                <p className="text-sm text-muted-foreground">
                  Email of the user who will be referred
                </p>
              </div>

              <div>
                <Label htmlFor="referrer-email">Referrer Email</Label>
                <Input
                  id="referrer-email"
                  type="email"
                  placeholder="referrer@example.com"
                  {...getInputProps(fields.referrerEmail, { type: "email" })}
                />
                {fields.referrerEmail.errors && (
                  <p className="text-sm text-destructive mt-1">{fields.referrerEmail.errors}</p>
                )}
                <p className="text-sm text-muted-foreground">
                  Email of the existing user who referred them
                </p>
              </div>
            </div>

            <div>
              <Label htmlFor="reason">Reason for Manual Attribution</Label>
              <Input
                id="reason"
                placeholder="Customer support request, data import, etc."
                {...getInputProps(fields.reason, { type: "text" })}
              />
              {fields.reason.errors && (
                <p className="text-sm text-destructive mt-1">{fields.reason.errors}</p>
              )}
              <p className="text-sm text-muted-foreground">
                Explain why this manual attribution is being created
              </p>
            </div>

            <div className="flex justify-end gap-4">
              <Button type="button" variant="outline" asChild>
                <Link to="/admin/referrals">Cancel</Link>
              </Button>
              <Button type="submit">Create Attribution</Button>
            </div>
          </Form>
        </CardContent>
      </Card>

      {/* Warning */}
      <Card className="border-yellow-200 bg-yellow-50">
        <CardContent className="pt-4">
          <div className="flex items-start gap-2 text-yellow-800">
            <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Important Notes</p>
              <ul className="text-sm mt-1 space-y-1">
                <li>• Both users must already exist in the system</li>
                <li>• The referee cannot already be attributed to another referrer</li>
                <li>• The referrer must have a valid referral code</li>
                <li>• This action cannot be undone</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
