import { useState } from "react";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import type { ActionFunction, LoaderFunctionArgs } from "@remix-run/node";
import { requireAdminUser, requireUserWithRole } from "~/utils/permissions.server";
import { z } from "zod";
import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod";
import { prisma } from "~/modules/db/db.server";
import { useIsPending } from "~/lib/utils";
import { CogIcon } from "@heroicons/react/24/outline";
import { Status } from "@prisma/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Button } from "~/components/ui/button";

const carSchema = z.object({
  make: z
    .string({
      required_error: "Make is required.",
    })
    .min(1),
  model: z
    .string({
      required_error: "Model is required.",
    })
    .min(1),
  year: z
    .number({
      required_error: "Year is required.",
    })
    .int()
    .min(2000, "Year must be 2000 or later")
    .max(new Date().getFullYear() + 1, "Year cannot be in the future"),
  price: z
    .number({
      required_error: "Price is required.",
    })
    .positive("Price must be positive"),
  status: z.nativeEnum(Status, {
    required_error: "Status is required.",
  }),
});

export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: carSchema });

  if (submission.status !== "success") {
    return json(submission.reply());
  }

  try {
    await prisma.car.create({
      data: {
        make: submission.value.make,
        model: submission.value.model,
        year: submission.value.year,
        price: submission.value.price,
        color: "red",
        status: submission.value.status,
      },
    });

    return redirect("/fleet-owner/cars");
  } catch (error) {
    console.error("Error creating new car:", error);
    return json({ error: "Failed to create new car" }, { status: 500 });
  }
};

export async function loader({ request }: LoaderFunctionArgs) {
  // const user = await requireUserWithRole(request, "admin");
  return json({ user: [] });
}

export default function NewCarForm() {
  const { user } = useLoaderData<typeof loader>();
  const lastResult = useActionData<typeof action>();
  const navigation = useNavigation();
  const isPending = useIsPending();

  const [form, { make, model, year, price, status }] = useForm({
    // Sync the result of last submission
    lastResult,

    // Reuse the validation logic on the client
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: carSchema });
    },

    // Validate the form on blur event triggered
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
  });

  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="max-w-md mx-auto mt-8">
      <h1 className="text-2xl font-bold mb-4">Add New Car</h1>

      <Form method="post" {...getFormProps(form)}>
        <div className="mb-4">
          <label htmlFor={make.id} className="block mb-2">
            Make
          </label>
          <input
            {...getInputProps(make, { type: "text" })}
            className="w-full px-3 py-2 border rounded"
          />
          {make.errors && <p className="text-red-500 text-sm mt-1">{make.errors.join(" ")}</p>}
        </div>

        <div className="mb-4">
          <label htmlFor={model.id} className="block mb-2">
            Model
          </label>
          <input
            {...getInputProps(model, { type: "text" })}
            className="w-full px-3 py-2 border rounded"
          />
          {model.errors && <p className="text-red-500 text-sm mt-1">{model.errors.join(" ")}</p>}
        </div>

        <div className="mb-4">
          <label htmlFor={year.id} className="block mb-2">
            Year
          </label>
          <input
            {...getInputProps(year, { type: "number" })}
            className="w-full px-3 py-2 border rounded"
          />
          {year.errors && <p className="text-red-500 text-sm mt-1">{year.errors.join(" ")}</p>}
        </div>

        <div className="mb-4">
          <label htmlFor={price.id} className="block mb-2">
            Price
          </label>
          <input
            {...getInputProps(price, { type: "number" })}
            step="0.01"
            className="w-full px-3 py-2 border rounded"
          />
          {price.errors && <p className="text-red-500 text-sm mt-1">{price.errors.join(" ")}</p>}
        </div>

        <div className="mb-4">
          <label htmlFor={status.id} className="block mb-2">
            Status
          </label>
          <Select {...getInputProps(status, { type: "text" })}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {Object.values(Status).map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {status.errors && <p className="text-red-500 text-sm mt-1">{status.errors.join(" ")}</p>}
        </div>

        <Button type="submit" disabled={isSubmitting}>
          {isPending ? <CogIcon className="h-5 w-5 animate-spin" /> : "Save"}
        </Button>
      </Form>
    </div>
  );
}
