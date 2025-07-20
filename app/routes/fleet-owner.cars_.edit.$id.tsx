import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod";
import { CogIcon } from "@heroicons/react/24/outline";
// import { Status } from "@prisma/client";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useLoaderData, useNavigation } from "@remix-run/react";
import invariant from "tiny-invariant";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useIsPending } from "~/lib/utils";
import { prisma } from "~/modules/db/db.server";

const Status = {
  AVAILABLE: "AVAILABLE",
  BOOKED: "BOOKED",
  HOLD: "HOLD",
  IN_SERVICE: "IN_SERVICE",
} as const;

const carSchema = z.object({
  dayRate: z
    .number({
      required_error: "Price is required.",
    })
    .positive("Price must be positive"),
  status: z.nativeEnum(Status).refine((status) => status !== Status.BOOKED),
  hourlyRate: z
    .number({
      required_error: "Hourly rate is required.",
    })
    .positive("Hourly rate must be positive"),
});

export async function action({ request, params }: ActionFunctionArgs) {
  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: carSchema });

  if (submission.status !== "success") {
    return json(submission.reply());
  }

  const { dayRate, status, hourlyRate } = submission.value;

  try {
    await prisma.car.update({
      where: { id: params.id },
      data: { dayRate, status, hourlyRate },
    });

    return redirect("/fleet-owner/cars");
  } catch (error) {
    console.error("Error updating car:", error);
    return json({ error: "Failed to update car" }, { status: 500 });
  }
}

export async function loader({ params }: LoaderFunctionArgs) {
  invariant(params.id, "id is required");

  const car = await prisma.car.findUnique({
    where: { id: params.id },
  });

  if (!car) {
    throw new Response("Not Found", { status: 404 });
  }

  return json({ car });
}

const STATUSES = Object.values(Status).filter((status) => status !== Status.BOOKED);

export default function EditCarForm() {
  const { car } = useLoaderData<typeof loader>();
  // const lastResult = useActionData<typeof action>();
  const navigation = useNavigation();
  const isPending = useIsPending();

  const [form, { dayRate, status }] = useForm({
    defaultValue: car,
    // lastResult,
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
      <h1 className="text-2xl font-bold mb-4">Update Car</h1>

      <Form method="post" {...getFormProps(form)}>
        <div className="mb-4">
          <label htmlFor="make" className="block mb-2">
            Make
          </label>
          <input
            id="make"
            type="text"
            value={car.make}
            disabled
            className="w-full px-3 py-2 border rounded bg-gray-50"
          />
        </div>

        <div className="mb-4">
          <label htmlFor="model" className="block mb-2">
            Model
          </label>
          <input
            id="model"
            type="text"
            value={car.model}
            disabled
            className="w-full px-3 py-2 border rounded bg-gray-50"
          />
        </div>

        <div className="mb-4">
          <label htmlFor="year" className="block mb-2">
            Year
          </label>
          <input
            id="year"
            type="number"
            value={car.year}
            disabled
            className="w-full px-3 py-2 border rounded bg-gray-50"
          />
        </div>

        <div className="mb-4">
          <label htmlFor={dayRate.id} className="block mb-2">
            Daily Rate
          </label>
          <input
            {...getInputProps(dayRate, { type: "number" })}
            step="0.01"
            className={`w-full px-3 py-2 border rounded ${
              dayRate.errors ? "border-destructive focus-visible:ring-destructive" : ""
            }`}
          />
          {dayRate.errors && (
            <p className="text-red-500 text-sm mt-1">{dayRate.errors.join(" ")}</p>
          )}
        </div>

        <div className="mb-4">
          <label htmlFor={status.id} className="block mb-2">
            Status
          </label>
          <Select {...getInputProps(status, { type: "text" })}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" defaultValue={status.value} />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((status) => (
                <SelectItem key={status} value={status} defaultValue={car.status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button type="submit" disabled={isSubmitting}>
          {isPending ? <CogIcon className="h-5 w-5 animate-spin" /> : "Save"}
        </Button>
      </Form>
    </div>
  );
}
