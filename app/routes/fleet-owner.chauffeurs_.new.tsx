import { getFormProps, useForm } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod";
import { CogIcon } from "@heroicons/react/24/outline";
import type { ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData, useNavigation } from "@remix-run/react";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { useIsPending } from "~/lib/utils";
import { requireUser } from "~/modules/auth/auth.server";
import { createUser } from "~/services/users.server";

const chauffeurSchema = z.object({
  email: z
    .string({
      required_error: "Email is required.",
    })
    .min(1),

  name: z
    .string({
      required_error: "Name is required.",
    })
    .min(1),

  phoneNumber: z
    .string({
      required_error: "Phone is required.",
    })
    .min(1),

  address: z.string().optional(),
});

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser(request);

  const formData = await request.formData();

  const submission = parseWithZod(formData, { schema: chauffeurSchema });

  if (submission.status !== "success") {
    return json(submission.reply());
  }

  const { email, name, phoneNumber, address } = submission.value;

  try {
    await createUser({
      email,
      name,
      phoneNumber,
      address,
      roles: { connect: [{ name: "chauffeur" }] },
      fleetOwner: { connect: { id: user.id } },
    });

    return redirect("/fleet-owner");
  } catch (error) {
    console.error("Error creating new chauffeur:", error);

    return json(
      {
        error: { errors: ["Failed to create new chauffeur"] },
      },
      { status: 500 }
    );
    // return json({ error: "Failed to create new car" }, { status: 500 });
  }
}

export default function NewChauffeurForm() {
  const lastResult = useActionData<typeof action>();
  const navigation = useNavigation();
  const isPending = useIsPending();

  const serverError = lastResult?.error;

  console.log("serverError", serverError);

  const [form, { email, name, phoneNumber, address }] = useForm({
    // Sync the result of last submission
    // lastResult,
    lastResult,
    // lastResult: navigation.state === "idle" ? lastResult : null,

    // Reuse the validation logic on the client
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: chauffeurSchema });
    },

    // Validate the form on blur event triggered
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
  });

  const isSubmitting = navigation.state === "submitting";

  const errorRingClasses =
    "border-red-500 focus-visible:ring-red-500 focus-visible:ring-2";

  return (
    <div className="max-w-md mx-auto mt-8">
      <h1 className="text-2xl font-bold mb-4">Add New Chauffeur</h1>

      {serverError?.errors && (
        <p className="text-red-500 text-sm mt-1">
          {serverError.errors.join(" ")}
        </p>
      )}

      <Form method="post" {...getFormProps(form)} encType="multipart/form-data">
        <div className="space-y-1">
          <Label htmlFor={email.id}>Email</Label>
          <Input
            name="email"
            id="email"
            type="email"
            className={`${email.errors ? errorRingClasses : ""}`}
          />
          {email.errors && (
            <p className="text-red-500 text-sm">{email.errors.join(" ")}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor={name.id}>Name</Label>
          <Input
            name="name"
            id="name"
            type="text"
            className={`${name.errors ? errorRingClasses : ""}`}
          />
          {name.errors && (
            <p className="text-red-500 text-sm">{name.errors.join(" ")}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor={phoneNumber.id}>Phone Number</Label>
          <Input
            name="phoneNumber"
            id={phoneNumber.id}
            type="tel"
            className={`${phoneNumber.errors ? errorRingClasses : ""}`}
          />
          {phoneNumber.errors && (
            <p className="text-red-500 text-sm">
              {phoneNumber.errors.join(" ")}
            </p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor={address.id}>Address</Label>
          <Input
            name="address"
            id="address"
            type="text"
            className={`${address.errors ? errorRingClasses : ""}`}
          />
          {address.errors && (
            <p className="text-red-500 text-sm">{address.errors.join(" ")}</p>
          )}
        </div>

        <Button type="submit" disabled={isSubmitting}>
          {isPending ? <CogIcon className="h-5 w-5 animate-spin" /> : "Save"}
        </Button>
      </Form>
    </div>
  );
}
